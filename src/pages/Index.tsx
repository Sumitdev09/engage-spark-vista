import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, BarChart3, Brain, Shield, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, role } = useAuth();
  const target = user ? (role === "hr" ? "/hr" : "/employee") : "/auth";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur sticky top-0 bg-background/70 z-40">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-elegant">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold tracking-tight leading-none">Pulse</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HR Analytics</div>
            </div>
          </div>
          <Link to={target}>
            <Button className="bg-gradient-primary border-0 shadow-elegant">
              {user ? "Open dashboard" : "Sign in"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.07] pointer-events-none" />
        <div className="container py-24 sm:py-32 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <Sparkles className="h-3 w-3 text-primary" /> AI-powered employee attrition prediction
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.02]">
              Read the room.{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">Keep your team.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl">
              Pulse turns employee surveys into a real-time attrition risk dashboard — so HR can act early, not after exit interviews.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary border-0 shadow-elegant text-base h-12 px-6">
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to={target}>
                <Button size="lg" variant="outline" className="text-base h-12 px-6">
                  {user ? "Go to dashboard" : "I already have an account"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-24">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Users, title: "For employees", text: "A short, private survey. Update anytime. Simple engagement summary." },
            { icon: Brain, title: "AI risk insights", text: "Hybrid model: rule-based scoring + Lovable AI insights for high-risk cases." },
            { icon: BarChart3, title: "Live HR analytics", text: "Department breakdowns, risk distribution, and a high-risk watchlist." },
          ].map((c) => (
            <div key={c.title} className="p-6 rounded-2xl bg-card border border-border shadow-soft hover:shadow-elegant transition-shadow">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center mb-4 shadow-elegant">
                <c.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg">{c.title}</h3>
              <p className="text-muted-foreground text-sm mt-1">{c.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 p-8 sm:p-12 rounded-3xl bg-gradient-hero text-primary-foreground shadow-elegant grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Build a fully-customizable survey in minutes.</h2>
            <p className="opacity-90 mt-2">HR controls every field — type, options, weight, and risk direction.</p>
          </div>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-base h-12 px-6 shadow-soft">
              Launch Pulse <Shield className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Built with Pulse · Smart HR analytics
      </footer>
    </div>
  );
};

export default Index;
