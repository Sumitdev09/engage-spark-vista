import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DynamicFormRenderer, FormField } from "@/components/DynamicFormRenderer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  ShieldCheck,
  Flame,
  Coffee,
  Sun,
  Moon,
  Sunrise,
  Heart,
  Zap,
} from "lucide-react";

const MOODS = [
  { key: "great", label: "Great", emoji: "🤩", color: "from-emerald-400 to-teal-500" },
  { key: "good", label: "Good", emoji: "🙂", color: "from-sky-400 to-indigo-500" },
  { key: "okay", label: "Okay", emoji: "😐", color: "from-amber-400 to-orange-500" },
  { key: "low", label: "Low", emoji: "😕", color: "from-rose-400 to-pink-500" },
  { key: "stressed", label: "Stressed", emoji: "😣", color: "from-red-500 to-fuchsia-600" },
];

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [risk, setRisk] = useState<{ risk_score: number; risk_level: string } | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: f }, { data: s }, { data: r }] = await Promise.all([
      supabase.from("form_fields").select("*").eq("active", true).order("position"),
      supabase.from("submissions").select("responses").eq("user_id", user!.id).maybeSingle(),
      supabase.from("risk_assessments").select("risk_score,risk_level").eq("user_id", user!.id).maybeSingle(),
    ]);
    setFields((f as any) ?? []);
    setValues((s?.responses as any) ?? {});
    setHasSubmission(!!s);
    setRisk(r ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const grouped = useMemo(() => {
    const map = new Map<string, FormField[]>();
    fields.forEach((f) => {
      const cat = f.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [fields]);

  const totalSteps = grouped.length;
  const currentGroup = grouped[step];

  const completion = useMemo(() => {
    if (!fields.length) return 0;
    const required = fields.filter((f) => f.required);
    const filled = required.filter((f) => values[f.field_key] !== undefined && values[f.field_key] !== "" && values[f.field_key] !== null);
    return Math.round((filled.length / Math.max(required.length, 1)) * 100);
  }, [fields, values]);

  const stepCompletion = useMemo(() => {
    if (!currentGroup) return 0;
    const req = currentGroup.items.filter((f) => f.required);
    if (!req.length) {
      const filled = currentGroup.items.filter((f) => values[f.field_key] !== undefined && values[f.field_key] !== "" && values[f.field_key] !== null);
      return Math.round((filled.length / Math.max(currentGroup.items.length, 1)) * 100);
    }
    const filled = req.filter((f) => values[f.field_key] !== undefined && values[f.field_key] !== "" && values[f.field_key] !== null);
    return Math.round((filled.length / req.length) * 100);
  }, [currentGroup, values]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return { text: "Working late", Icon: Moon };
    if (h < 12) return { text: "Good morning", Icon: Sunrise };
    if (h < 17) return { text: "Good afternoon", Icon: Sun };
    if (h < 21) return { text: "Good evening", Icon: Coffee };
    return { text: "Good night", Icon: Moon };
  }, []);

  const firstName = (user?.email?.split("@")[0] ?? "there").replace(/[._-]+/g, " ").split(" ")[0];
  const initials = firstName.slice(0, 2).toUpperCase();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const missing = fields.filter((f) => f.required && (values[f.field_key] === undefined || values[f.field_key] === "" || values[f.field_key] === null));
      if (missing.length) {
        toast.error(`Please fill: ${missing.map((m) => m.label).join(", ")}`);
        const firstMissing = missing[0];
        const idx = grouped.findIndex((g) => g.items.some((it) => it.field_key === firstMissing.field_key));
        if (idx >= 0) setStep(idx);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("submissions")
        .upsert({ user_id: user!.id, responses: values, submitted_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;

      const { data: fnRes, error: fnErr } = await supabase.functions.invoke("analyze-risk", { body: {} });
      if (fnErr) console.warn(fnErr);
      if (fnRes) setRisk({ risk_score: fnRes.score, risk_level: fnRes.level });
      setHasSubmission(true);
      setLastSavedAt(new Date());
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);
      toast.success("Your responses have been saved.");
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .upsert({ user_id: user.id, responses: values }, { onConflict: "user_id" });
      if (error) throw error;
      setLastSavedAt(new Date());
      toast.success("Draft saved");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save draft");
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const goPrev = () => {
    if (step > 0) {
      setStep(step - 1);
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const engagement = risk ? Math.max(0, 100 - Number(risk.risk_score)) : null;
  const ringValue = engagement ?? completion;
  const ringDash = 2 * Math.PI * 52;
  const ringOffset = ringDash - (ringDash * ringValue) / 100;

  return (
    <AppLayout
      nav={
        <>
          <NavItem to="/employee" label="My Pulse" />
        </>
      }
    >
      <div className="space-y-8 max-w-6xl mx-auto pb-28">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-border shadow-elegant">
          <div className="absolute inset-0 bg-gradient-hero opacity-95" />
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/40 blur-3xl animate-pulse" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />

          <div className="relative p-6 sm:p-10 grid lg:grid-cols-[1fr_auto] gap-8 items-center text-primary-foreground">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/30 grid place-items-center text-lg font-bold shadow-lg">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-80">
                    <greeting.Icon className="h-3.5 w-3.5" />
                    {greeting.text}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight capitalize leading-tight">
                    {firstName}, how's your day?
                  </h1>
                </div>
              </div>
              <p className="max-w-xl text-sm sm:text-base opacity-90">
                Your pulse stays private. A few honest answers help your team support you better — and shape a healthier workplace for everyone.
              </p>

              {/* MOOD ORBS */}
              <div className="flex flex-wrap gap-2 pt-1">
                {MOODS.map((m) => {
                  const active = mood === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMood(m.key)}
                      className={`group relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                        active
                          ? "bg-white text-foreground border-white shadow-lg scale-105"
                          : "bg-white/10 border-white/20 hover:bg-white/20 hover:scale-105"
                      }`}
                    >
                      <span className="mr-1.5 text-base">{m.emoji}</span>
                      {m.label}
                      {active && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RING */}
            <div className="relative grid place-items-center">
              <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90 drop-shadow-2xl">
                <circle cx="60" cy="60" r="52" stroke="white" strokeOpacity="0.18" strokeWidth="10" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="white"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ringDash}
                  strokeDashoffset={ringOffset}
                  style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-4xl font-bold leading-none">{Math.round(ringValue)}%</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] opacity-80">
                    {engagement !== null ? "Engagement" : "Progress"}
                  </div>
                </div>
              </div>
              {justSubmitted && (
                <div className="absolute inset-0 rounded-full animate-ping bg-white/30" />
              )}
            </div>
          </div>
        </div>

        {/* STAT STRIP */}
        <div className="grid sm:grid-cols-4 gap-4">
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="primary"
            label="Completion"
            value={`${completion}%`}
            sub={<div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${completion}%` }} /></div>}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            tone="success"
            label="Engagement"
            value={engagement === null ? "—" : `${engagement.toFixed(0)}%`}
            sub={<p className="text-xs text-muted-foreground mt-2">Based on your latest pulse signals.</p>}
          />
          <StatCard
            icon={<Flame className="h-5 w-5" />}
            tone="warning"
            label="Current step"
            value={`${Math.min(step + 1, Math.max(totalSteps, 1))}/${Math.max(totalSteps, 1)}`}
            sub={<p className="text-xs text-muted-foreground mt-2 truncate">{currentGroup?.category ?? "—"}</p>}
          />
          <StatCard
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="accent"
            label="Status"
            value=""
            sub={
              <div className="flex items-center gap-2 mt-1">
                {hasSubmission ? (
                  <Badge className="bg-success text-success-foreground">Submitted</Badge>
                ) : (
                  <Badge variant="secondary">Not started</Badge>
                )}
                {lastSavedAt && (
                  <span className="text-[10px] text-muted-foreground">saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            }
          />
        </div>

        {/* MAIN GRID */}
        <div ref={formTopRef} className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* STEP RAIL */}
          <Card className="p-4 h-fit lg:sticky lg:top-24 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections</div>
              <Badge variant="outline" className="text-[10px]">{totalSteps} steps</Badge>
            </div>
            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sections yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {grouped.map((g, i) => {
                  const req = g.items.filter((f) => f.required);
                  const done = req.every((f) => values[f.field_key] !== undefined && values[f.field_key] !== "" && values[f.field_key] !== null);
                  const active = i === step;
                  return (
                    <li key={g.category}>
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                          active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-transparent hover:border-border hover:bg-secondary/60"
                        }`}
                      >
                        <div
                          className={`h-7 w-7 rounded-full grid place-items-center text-[11px] font-semibold transition ${
                            done
                              ? "bg-success text-success-foreground"
                              : active
                              ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{g.category}</div>
                          <div className="text-[10px] text-muted-foreground">{g.items.length} questions</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Overall</span>
                <span className="font-semibold">{completion}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </Card>

          {/* FORM CARD */}
          <Card className="relative p-6 sm:p-8 shadow-soft overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
              <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${stepCompletion}%` }} />
            </div>

            <form onSubmit={onSubmit} className="space-y-8">
              {loading ? (
                <div className="grid place-items-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : fields.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-secondary grid place-items-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No survey fields yet — please check back later.</p>
                </div>
              ) : currentGroup ? (
                <div key={currentGroup.category} className="animate-fade-in space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        Step {step + 1} of {totalSteps}
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        {currentGroup.category}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentGroup.items.length} question{currentGroup.items.length === 1 ? "" : "s"} • takes about a minute
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{stepCompletion}% done</Badge>
                  </div>

                  <DynamicFormRenderer
                    fields={currentGroup.items}
                    values={values}
                    onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
                  />
                </div>
              ) : null}

              {/* INLINE NAV */}
              {totalSteps > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                  <Button type="button" variant="ghost" onClick={goPrev} disabled={step === 0}>
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {grouped.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === step ? "w-6 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-secondary"
                        }`}
                      />
                    ))}
                  </div>
                  {step < totalSteps - 1 ? (
                    <Button type="button" onClick={goNext} className="bg-gradient-primary border-0 shadow-elegant">
                      Next <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={saving} className="bg-gradient-primary border-0 shadow-elegant">
                      <Send className="h-4 w-4" />
                      {saving ? "Saving…" : hasSubmission ? "Update responses" : "Submit"}
                    </Button>
                  )}
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>

      {/* STICKY ACTION BAR */}
      {!loading && fields.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(96vw,720px)]">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-elegant px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Heart className={`h-4 w-4 ${justSubmitted ? "text-destructive animate-ping" : "text-primary"}`} />
              <span className="text-xs font-medium hidden sm:inline">
                {completion < 100 ? `${100 - completion}% to go` : "All set — ready to send"}
              </span>
            </div>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${completion}%` }} />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={saveDraft} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save draft</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={(e) => onSubmit(e as any)}
              disabled={saving}
              className="bg-gradient-primary border-0 shadow-elegant"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{hasSubmission ? "Update" : "Submit"}</span>
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone: "primary" | "success" | "warning" | "accent";
}) => {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    accent: "bg-accent/15 text-accent-foreground",
  };
  return (
    <Card className="p-5 shadow-soft hover:shadow-elegant transition-all hover:-translate-y-0.5 group">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          {value && <div className="text-2xl font-bold mt-1">{value}</div>}
        </div>
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${tones[tone]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      {sub}
    </Card>
  );
};

export default EmployeeDashboard;