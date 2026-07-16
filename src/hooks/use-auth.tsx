import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type OrganizerStatus = Database["public"]["Enums"]["organizer_status"];

interface AuthState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  organizerStatus: OrganizerStatus | null;
  suspended: boolean;
  loading: boolean;
  isApprovedOrganizer: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({
  session: null,
  user: null,
  role: null,
  organizerStatus: null,
  suspended: false,
  loading: true,
  isApprovedOrganizer: false,
  isAdmin: false,
  signOut: async () => {},
  refreshRole: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [organizerStatus, setOrganizerStatus] = useState<OrganizerStatus | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRole = async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      setOrganizerStatus(null);
      setSuspended(false);
      return;
    }
    const [{ data: rRow }, { data: pRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("organizer_status, suspended").eq("id", userId).maybeSingle(),
    ]);
    setRole((rRow?.role as AppRole) ?? null);
    setOrganizerStatus((pRow?.organizer_status as OrganizerStatus) ?? null);
    setSuspended(!!pRow?.suspended);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => loadRole(s?.user.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRole(data.session?.user.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Live-refresh role + organizer status when profile/user_roles change
  useEffect(() => {
    if (!session?.user) return;
    const uid = session.user.id;
    const ch = supabase
      .channel(`auth-watch-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        () => loadRole(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
        () => loadRole(uid))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
    setOrganizerStatus(null);
    setSuspended(false);
  };

  const refreshRole = async () => loadRole(session?.user.id);

  const isAdmin = role === "admin";
  const isApprovedOrganizer =
    role === "organizer" && (organizerStatus === "approved" || organizerStatus === null) && !suspended;

  return (
    <AuthCtx.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        organizerStatus,
        suspended,
        loading,
        isApprovedOrganizer,
        isAdmin,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
