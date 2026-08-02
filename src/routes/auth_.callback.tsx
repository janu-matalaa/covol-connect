import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Verifying your email | CoVol" },
      { name: "description", content: "Confirming your CoVol account email address." },
      { property: "og:title", content: "Verifying your email | CoVol" },
      { property: "og:description", content: "Confirming your CoVol account email address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = "working" | "ok" | "error";

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      const errDesc =
        params.get("error_description") ?? hash.get("error_description") ?? params.get("error") ?? hash.get("error");

      try {
        if (errDesc) throw new Error(decodeURIComponent(errDesc.replace(/\+/g, " ")));

        const tokenHash = params.get("token_hash") ?? hash.get("token_hash");
        const type = (params.get("type") ?? hash.get("type")) as
          | "signup"
          | "email"
          | "recovery"
          | "invite"
          | "email_change"
          | "magiclink"
          | null;
        const code = params.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("This verification link is invalid or has already been used.");
        }

        if (cancelled) return;
        setStatus("ok");
        setMessage("Email verified successfully. You can now log in.");
        toast.success("Email verified successfully. You can now log in.");

        const { data } = await supabase.auth.getSession();
        window.history.replaceState({}, "", "/auth/callback");
        setTimeout(() => {
          if (cancelled) return;
          if (data.session) navigate({ to: "/dashboard" });
          else navigate({ to: "/auth", search: { verified: "1" } as never });
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        const raw =
          err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message ?? "") : "";
        const friendly = /expired|invalid|otp/i.test(raw)
          ? "This verification link is invalid or has expired. Request a new confirmation email from the sign-in page."
          : raw || "We couldn't verify your email. Please try again.";
        setStatus("error");
        setMessage(friendly);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 gradient-hero opacity-15" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">CoVol</span>
          </Link>

          <div className="glass rounded-2xl p-8 text-center shadow-card">
            {status === "working" && (
              <>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <h1 className="mt-4 text-xl font-semibold">Verifying your email…</h1>
              </>
            )}
            {status === "ok" && (
              <>
                <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
                <h1 className="mt-4 text-xl font-semibold">Email verified</h1>
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              </>
            )}
            {status === "error" && (
              <>
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <h1 className="mt-4 text-xl font-semibold">Verification failed</h1>
                <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                <Button asChild className="mt-6 w-full gradient-primary text-white border-0 hover:opacity-90">
                  <Link to="/auth">Back to sign in</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
