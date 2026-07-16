import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin-login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { session, loading, isAdmin, refreshRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session && isAdmin) return <Navigate to="/admin" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // verify role
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign-in failed");
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized for admin access.");
      }
      await refreshRole();
      toast.success("Welcome, admin.");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 gradient-hero opacity-15" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">CoVol Admin</span>
          </Link>

          <div className="glass rounded-2xl p-8 shadow-card">
            <h1 className="text-2xl font-bold tracking-tight">Admin sign-in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Restricted access. Admin accounts are pre-authorized only.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full gradient-primary text-white border-0 hover:opacity-90" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Not an admin?{" "}
              <Link to="/auth" className="text-primary hover:underline">
                Regular sign-in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
