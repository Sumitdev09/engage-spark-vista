import { useEffect, useMemo, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  GraduationCap,
  HeartHandshake,
  Home,
  IdCard,
  Info,
  Loader2,
  Plane,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";

const SCALES = {
  satisfaction: ["", "Low", "Medium", "High", "Very High"],
  balance: ["", "Poor", "Fair", "Good", "Excellent"],
  generic: ["", "Low", "Medium", "High", "Very High"],
} as const;

type Profile = {
  employee_code?: string | null;
  full_name?: string | null;
  email?: string | null;
  gender?: string | null;
  age?: number | null;
  department?: string | null;
  job_role?: string | null;
  education?: string | null;
  monthly_income?: number | null;
  years_at_company?: number | null;
  years_in_current_role?: number | null;
  years_since_last_promotion?: number | null;
  total_working_years?: number | null;
  marital_status?: string | null;
  business_travel?: string | null;
  overtime?: string | null;
};

type Prediction = {
  score: number;
  level: "low" | "medium" | "high";
  factors: { key: string; label: string; impact: number; value: any }[];
  insights?: string;
  recommendations?: string;
};

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [factors, setFactors] = useState<Record<string, any>>({
    job_satisfaction: 3,
    work_life_balance: 3,
    environment_satisfaction: 3,
    distance_from_home: 5,
    age: null,
    job_involvement: 3,
    relationship_satisfaction: 3,
  });
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: s }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("submissions").select("responses").eq("user_id", user.id).maybeSingle(),
        supabase.from("risk_assessments").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setProfile((p as any) ?? {});
      if (s?.responses) {
        setFactors((prev) => ({ ...prev, ...(s.responses as any) }));
      }
      setFactors((prev) => ({ ...prev, age: prev.age ?? (p as any)?.age ?? null }));
      if (r) {
        setPrediction({
          score: Number(r.risk_score),
          level: r.risk_level as any,
          factors: [],
          insights: r.insights ?? undefined,
          recommendations: r.recommendations ?? undefined,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const displayName = useMemo(
    () => profile?.full_name || (user?.email?.split("@")[0] ?? "Employee"),
    [profile, user]
  );
  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "E",
    [displayName]
  );

  const handlePredict = async () => {
    if (!user) return;
    setPredicting(true);
    try {
      const payload = { ...factors, age: factors.age ?? profile?.age ?? null };
      const { error } = await supabase
        .from("submissions")
        .upsert(
          { user_id: user.id, responses: payload, submitted_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;

      const { data: fnRes, error: fnErr } = await supabase.functions.invoke("analyze-risk", { body: {} });
      if (fnErr) throw fnErr;
      setPrediction(fnRes as Prediction);
      toast.success("Attrition prediction complete.");
    } catch (err: any) {
      toast.error(err.message ?? "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout nav={<NavItem to="/employee" label="My Pulse" />}>
        <div className="grid place-items-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout nav={<NavItem to="/employee" label="My Pulse" />}>
      <TooltipProvider delayDuration={150}>
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
          {/* HERO */}
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-elegant">
            <div className="absolute inset-0 bg-gradient-hero opacity-95" />
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
            <div className="relative p-6 sm:p-8 flex flex-wrap items-center gap-5 text-primary-foreground">
              <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/30 grid place-items-center text-xl font-bold shadow-lg">
                {initials}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs uppercase tracking-[0.18em] opacity-80">Attrition Prediction</div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">{displayName}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs opacity-90">
                  {profile?.employee_code && <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20">ID {profile.employee_code}</span>}
                  {profile?.department && <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20">{profile.department}</span>}
                  {profile?.job_role && <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20">{profile.job_role}</span>}
                </div>
              </div>
              <Button
                size="lg"
                onClick={handlePredict}
                disabled={predicting}
                className="bg-white text-foreground hover:bg-white/90 shadow-elegant border-0"
              >
                {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {predicting ? "Analyzing…" : "Predict Attrition"}
              </Button>
            </div>
          </div>

          {/* AUTO-FILLED INFO */}
          <Card className="p-6 shadow-soft">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Employee Information</h2>
                  <p className="text-xs text-muted-foreground">Auto-filled from the employee database — read only</p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1"><Check className="h-3 w-3" /> Verified</Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ReadField icon={<IdCard className="h-4 w-4" />} label="Employee ID" value={profile?.employee_code} />
              <ReadField icon={<User className="h-4 w-4" />} label="Employee Name" value={profile?.full_name} />
              <ReadField icon={<User className="h-4 w-4" />} label="Gender" value={profile?.gender} />
              <ReadField icon={<CalendarClock className="h-4 w-4" />} label="Age" value={profile?.age} />
              <ReadField icon={<Building2 className="h-4 w-4" />} label="Department" value={profile?.department} />
              <ReadField icon={<Briefcase className="h-4 w-4" />} label="Job Role" value={profile?.job_role} />
              <ReadField icon={<GraduationCap className="h-4 w-4" />} label="Education" value={profile?.education} />
              <ReadField icon={<Wallet className="h-4 w-4" />} label="Monthly Income" value={profile?.monthly_income ? `₹ ${Number(profile.monthly_income).toLocaleString()}` : null} />
              <ReadField icon={<CalendarClock className="h-4 w-4" />} label="Years at Company" value={profile?.years_at_company} />
              <ReadField icon={<CalendarClock className="h-4 w-4" />} label="Years in Current Role" value={profile?.years_in_current_role} />
              <ReadField icon={<CalendarClock className="h-4 w-4" />} label="Years Since Last Promotion" value={profile?.years_since_last_promotion} />
              <ReadField icon={<CalendarClock className="h-4 w-4" />} label="Total Working Years" value={profile?.total_working_years} />
              <ReadField icon={<HeartHandshake className="h-4 w-4" />} label="Marital Status" value={profile?.marital_status} />
              <ReadField icon={<Plane className="h-4 w-4" />} label="Business Travel" value={profile?.business_travel} />
              <ReadField icon={<Activity className="h-4 w-4" />} label="Overtime" value={profile?.overtime} />
            </div>
          </Card>

          {/* EDITABLE FACTORS */}
          <Card className="relative p-6 shadow-elegant border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-accent/[0.04]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary rounded-t-xl" />
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-elegant">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Employee Retention & Satisfaction Factors</h2>
                  <p className="text-xs text-muted-foreground">Update the inputs below before running the prediction</p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">Editable</Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <ScaleField
                label="Job Satisfaction"
                tooltip="How satisfied are you with your current role?"
                value={factors.job_satisfaction}
                onChange={(v) => setFactors((f) => ({ ...f, job_satisfaction: v }))}
                labels={SCALES.satisfaction}
              />
              <ScaleField
                label="Work-Life Balance"
                tooltip="Balance between professional and personal life."
                value={factors.work_life_balance}
                onChange={(v) => setFactors((f) => ({ ...f, work_life_balance: v }))}
                labels={SCALES.balance}
              />
              <ScaleField
                label="Environment Satisfaction"
                tooltip="Unhappy work environment increases attrition risk."
                value={factors.environment_satisfaction}
                onChange={(v) => setFactors((f) => ({ ...f, environment_satisfaction: v }))}
                labels={SCALES.satisfaction}
              />
              <NumberField
                label="Distance From Home (KM)"
                tooltip="Long commuting distances may increase employee attrition."
                icon={<Home className="h-4 w-4" />}
                value={factors.distance_from_home}
                onChange={(v) => setFactors((f) => ({ ...f, distance_from_home: v }))}
              />
              <NumberField
                label="Age"
                tooltip="Younger employees tend to switch jobs more frequently."
                icon={<CalendarClock className="h-4 w-4" />}
                value={factors.age}
                onChange={(v) => setFactors((f) => ({ ...f, age: v }))}
              />
              <ScaleField
                label="Job Involvement"
                tooltip="Low job involvement may indicate employee disengagement."
                value={factors.job_involvement}
                onChange={(v) => setFactors((f) => ({ ...f, job_involvement: v }))}
                labels={SCALES.generic}
              />
              <ScaleField
                label="Relationship Satisfaction"
                tooltip="Poor workplace relationships may contribute to employee turnover."
                value={factors.relationship_satisfaction}
                onChange={(v) => setFactors((f) => ({ ...f, relationship_satisfaction: v }))}
                labels={SCALES.satisfaction}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Your inputs will be combined with your profile data to generate the prediction.
              </p>
              <Button onClick={handlePredict} disabled={predicting} className="bg-gradient-primary border-0 shadow-elegant">
                {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {predicting ? "Analyzing…" : "Predict Attrition"}
              </Button>
            </div>
          </Card>

          {/* PREDICTION RESULT */}
          {prediction && <PredictionCard p={prediction} />}
        </div>
      </TooltipProvider>
    </AppLayout>
  );
};

/* ============== SUB-COMPONENTS ============== */

const ReadField = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: any;
}) => {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary/70">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-semibold mt-1 truncate">{display}</div>
    </div>
  );
};

const ScaleField = ({
  label,
  tooltip,
  value,
  onChange,
  labels,
}: {
  label: string;
  tooltip: string;
  value: number | null | undefined;
  onChange: (v: number) => void;
  labels: readonly string[];
}) => {
  const v = Number(value ?? 0);
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/40 hover:shadow-soft">
      <div className="flex items-center justify-between mb-2.5">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          {label}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">{tooltip}</TooltipContent>
          </Tooltip>
        </Label>
        <Badge variant="outline" className="text-[10px]">
          {v ? `${v} · ${labels[v] ?? ""}` : "—"}
        </Badge>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((n) => {
          const active = v === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`relative rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                active
                  ? "border-primary bg-gradient-primary text-primary-foreground shadow-elegant scale-[1.02]"
                  : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <div className="text-sm font-bold leading-none">{n}</div>
              <div className="text-[10px] mt-0.5 opacity-90 truncate">{labels[n]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const NumberField = ({
  label,
  tooltip,
  icon,
  value,
  onChange,
}: {
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) => (
  <div className="rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/40 hover:shadow-soft">
    <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2.5">
      <span className="text-primary">{icon}</span>
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px]">{tooltip}</TooltipContent>
      </Tooltip>
    </Label>
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="h-10"
    />
  </div>
);

const PredictionCard = ({ p }: { p: Prediction }) => {
  const willAttrite = p.score >= 50;
  const probability = Math.round(p.score);
  const toneMap = {
    low: { ring: "hsl(var(--success))", chip: "bg-success/10 text-success border-success/30", text: "Low" },
    medium: { ring: "hsl(var(--warning))", chip: "bg-warning/10 text-warning border-warning/30", text: "Medium" },
    high: { ring: "hsl(var(--destructive))", chip: "bg-destructive/10 text-destructive border-destructive/30", text: "High" },
  } as const;
  const tone = toneMap[p.level] ?? toneMap.low;
  const recItems = (p.recommendations ?? "")
    .split("\n")
    .map((s) => s.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);

  return (
    <Card className="p-6 shadow-elegant overflow-hidden border-primary/20">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent-foreground grid place-items-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Attrition Risk Analysis</h2>
            <p className="text-xs text-muted-foreground">Model output based on profile + satisfaction factors</p>
          </div>
        </div>
        <Badge className={tone.chip} variant="outline">{tone.text} Risk</Badge>
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
        <div className="relative grid place-items-center">
          <div
            className="h-36 w-36 rounded-full grid place-items-center"
            style={{ background: `conic-gradient(${tone.ring} ${probability * 3.6}deg, hsl(var(--secondary)) 0)` }}
          >
            <div className="h-28 w-28 rounded-full bg-card grid place-items-center text-center">
              <div>
                <div className="text-3xl font-bold leading-none">{probability}%</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Probability</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <KPI
              label="Prediction"
              icon={willAttrite ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              value={willAttrite ? "Yes" : "No"}
              tone={willAttrite ? "danger" : "success"}
            />
            <KPI label="Risk Score" icon={<Activity className="h-4 w-4" />} value={`${probability}/100`} tone="primary" />
            <KPI label="Risk Level" icon={<Target className="h-4 w-4" />} value={tone.text} tone={p.level === "high" ? "danger" : p.level === "medium" ? "warning" : "success"} />
          </div>

          {p.insights && (
            <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Insights</div>
              <p className="text-sm leading-relaxed">{p.insights}</p>
            </div>
          )}
        </div>
      </div>

      {p.factors?.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Contributing Factors</div>
          <div className="space-y-2">
            {p.factors.map((f) => {
              const max = Math.max(...p.factors.map((x) => x.impact), 1);
              const w = Math.round((f.impact / max) * 100);
              return (
                <div key={f.key} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">impact {f.impact.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recItems.length > 0 && (
        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" /> Retention Recommendations
          </div>
          <ul className="space-y-1.5">
            {recItems.map((r, i) => (
              <li key={i} className="text-sm flex gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

const KPI = ({
  label,
  icon,
  value,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  tone: "primary" | "success" | "warning" | "danger";
}) => {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`h-7 w-7 rounded-lg grid place-items-center ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
};

export default EmployeeDashboard;