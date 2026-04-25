import { useEffect, useMemo, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DynamicFormRenderer, FormField } from "@/components/DynamicFormRenderer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, TrendingUp } from "lucide-react";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [risk, setRisk] = useState<{ risk_score: number; risk_level: string } | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);

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

  const completion = useMemo(() => {
    if (!fields.length) return 0;
    const required = fields.filter((f) => f.required);
    const filled = required.filter((f) => values[f.field_key] !== undefined && values[f.field_key] !== "" && values[f.field_key] !== null);
    return Math.round((filled.length / Math.max(required.length, 1)) * 100);
  }, [fields, values]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const missing = fields.filter((f) => f.required && (values[f.field_key] === undefined || values[f.field_key] === "" || values[f.field_key] === null));
      if (missing.length) {
        toast.error(`Please fill: ${missing.map((m) => m.label).join(", ")}`);
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
      toast.success("Your responses have been saved.");
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const engagement = risk ? Math.max(0, 100 - Number(risk.risk_score)) : null;

  return (
    <AppLayout
      nav={
        <>
          <NavItem to="/employee" label="My Pulse" />
        </>
      }
    >
      <div className="space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hi there 👋</h1>
          <p className="text-muted-foreground">Share your pulse — it stays private and helps your team support you better.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Form completion</div>
                <div className="text-3xl font-bold mt-1">{completion}%</div>
              </div>
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${completion}%` }} />
            </div>
          </Card>
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Engagement level</div>
                <div className="text-3xl font-bold mt-1">
                  {engagement === null ? "—" : `${engagement.toFixed(0)}%`}
                </div>
              </div>
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">A simple gauge of your overall well-being signals.</p>
          </Card>
          <Card className="p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="mt-1">
                  {hasSubmission ? (
                    <Badge className="bg-success text-success-foreground">Submitted</Badge>
                  ) : (
                    <Badge variant="secondary">Not started</Badge>
                  )}
                </div>
              </div>
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">You can update your responses anytime.</p>
          </Card>
        </div>

        <Card className="p-6 sm:p-8 shadow-soft">
          <form onSubmit={onSubmit} className="space-y-8">
            {loading ? (
              <div className="grid place-items-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No survey fields yet — please check back later.</p>
            ) : (
              <DynamicFormRenderer
                fields={fields}
                values={values}
                onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="submit" disabled={saving || loading} className="bg-gradient-primary border-0 shadow-elegant">
                {saving ? "Saving…" : hasSubmission ? "Update responses" : "Submit responses"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
};

export default EmployeeDashboard;