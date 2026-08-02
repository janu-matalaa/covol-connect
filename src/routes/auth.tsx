import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (search: Record<string, unknown>) => ({
    verified: typeof search.verified === "string" ? search.verified : undefined,
  }),
});

type Mode = "signin" | "signup";

function AuthPage() {
  const { session, loading, refreshRole } = useAuth();
  const navigate = useNavigate();
  const { verified } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"volunteer" | "organizer">("volunteer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (verified === "1") toast.success("Email verified successfully. You can now log in.");
  }, [verified]);

  if (!loading && session) return <Navigate to="/dashboard" />;


  const errMessage = (err: unknown) => {
    const m =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message ?? "")
        : "";
    if (/already registered|already exists|User already/i.test(m))
      return "This email is already registered. Try signing in instead.";
    if (/Invalid login credentials/i.test(m)) return "Incorrect email or password.";
    if (/Email not confirmed/i.test(m))
      return "Please confirm your email first — check your inbox for the confirmation link.";
    return m || "Something went wrong. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;

        // Supabase returns a user with no identities when the email already exists.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          toast.error("This email is already registered. Try signing in instead.");
          setMode("signin");
          return;
        }

        if (!data.session) {
          toast.success("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
          setPassword("");
          return;
        }

        toast.success("Account created! You're signed in.");
        await refreshRole();
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        await refreshRole();
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 gradient-hero opacity-15" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="mb-8 flex items-center justify-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">CoVol</span>
          </Link>

          <div className="glass rounded-2xl p-8 shadow-card">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-bold tracking-tight">
                  {mode === "signin" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Sign in to continue your journey."
                    : "Pick a role — this is permanent."}
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">Full name</Label>
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signin" ? "current-password" : "new-password"} />
                  </div>

                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label>I am a...</Label>
                      <RadioGroup value={role} onValueChange={(v) => setRole(v as "volunteer" | "organizer")} className="grid grid-cols-2 gap-3">
                        {(["volunteer", "organizer"] as const).map((r) => (
                          <label
                            key={r}
                            className={`cursor-pointer rounded-lg border p-3 text-sm transition-all ${
                              role === r ? "border-primary bg-accent shadow-glow" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <RadioGroupItem value={r} className="sr-only" />
                            <div className="font-medium capitalize">{r}</div>
                            <div className="text-xs text-muted-foreground">
                              {r === "volunteer" ? "Join events" : "Create events"}
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  <Button type="submit" className="w-full gradient-primary text-white border-0 hover:opacity-90" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === "signin" ? "Sign in" : "Create account"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "New to CoVol?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    className="font-medium text-primary hover:underline"
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
