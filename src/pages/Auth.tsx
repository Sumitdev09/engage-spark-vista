import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Briefcase, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupRole, setSignupRole] = useState<"employee" | "hr">("employee");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role) navigate(role === "hr" ? "/hr" : "/employee", { replace: true });
  }, [user, role, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.user) {
          const { error: rErr } = await supabase
            .from("user_roles")
            .insert({ user_id: data.user.id, role: signupRole });
          if (rErr) console.warn(rErr);
          toast.success("Account created!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-hero p-12 flex-col justify-between text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight">Pulse</div>
            <div className="text-xs opacity-80 uppercase tracking-widest">HR Analytics</div>
          </div>
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-5xl font-bold tracking-tight leading-[1.05]">
            Predict attrition before it happens.
          </h1>
          <p className="text-lg opacity-90">
            A smart engagement platform where employees share their pulse and HR turns it into actionable insight.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-md">
          {[
            { v: "92%", l: "Insight accuracy" },
            { v: "<2m", l: "Survey time" },
            { v: "Live", l: "Risk dashboard" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-white/10 backdrop-blur p-4">
              <div className="text-2xl font-bold">{s.v}</div>
              <div className="text-xs opacity-80">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 shadow-soft">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to your Pulse workspace." : "Choose your role to get started."}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" required />
                </div>
                <div className="space-y-2">
                  <Label>I am an...</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSignupRole("employee")}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        signupRole === "employee" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Users className="h-4 w-4 mb-1 text-primary" />
                      <div className="font-medium text-sm">Employee</div>
                      <div className="text-xs text-muted-foreground">Share my pulse</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupRole("hr")}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        signupRole === "hr" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Briefcase className="h-4 w-4 mb-1 text-primary" />
                      <div className="font-medium text-sm">HR / Admin</div>
                      <div className="text-xs text-muted-foreground">Manage insights</div>
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary border-0 shadow-elegant" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Auth;