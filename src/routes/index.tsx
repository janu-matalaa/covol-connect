import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Heart, BarChart3, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 gradient-hero opacity-20" />
      <div className="relative">
        <header className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold">CoVol</span>
          </div>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        </header>

        <main className="container mx-auto px-4 pt-16 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 glass px-4 py-1.5 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Volunteer Management, reimagined
            </div>
            <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
              Do good.{" "}
              <span className="gradient-primary bg-clip-text text-transparent">Track impact.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              CoVol connects volunteers with meaningful events, tracks service hours, and issues verified certificates — all in one beautiful platform.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="gradient-primary text-white border-0 hover:opacity-90 shadow-glow">
                  Get started
                </Button>
              </Link>
            </div>
          </motion.div>

          <div className="mt-24 grid gap-6 md:grid-cols-3">
            {[
              { icon: Heart, title: "For Volunteers", body: "Browse events, register instantly, and grow your impact." },
              { icon: BarChart3, title: "For Organizers", body: "Create events, manage rosters, and view live analytics." },
              { icon: Award, title: "Verified Certificates", body: "Auto-issued after attendance verification. Downloadable." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="glass rounded-2xl p-6 text-left shadow-card"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
