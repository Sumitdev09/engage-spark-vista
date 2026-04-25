import { useEffect, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const HREmployees = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: subs }, { data: risks }, { data: ff }] = await Promise.all([
        supabase.from("profiles").select("user_id,full_name,email,department"),
        supabase.from("submissions").select("user_id,responses,updated_at"),
        supabase.from("risk_assessments").select("user_id,risk_score,risk_level,insights,recommendations,ai_generated"),
        supabase.from("form_fields").select("*").order("position"),
      ]);
      const subMap = new Map((subs ?? []).map((s: any) => [s.user_id, s]));
      const riskMap = new Map((risks ?? []).map((r: any) => [r.user_id, r]));
      const merged = (profiles ?? []).map((p: any) => {
        const r = riskMap.get(p.user_id);
        const s = subMap.get(p.user_id);
        return {
          ...p,
          department: p.department || s?.responses?.department || "—",
          responses: s?.responses ?? null,
          updated_at: s?.updated_at,
          ...r,
        };
      });
      setRows(merged);
      setFields(ff ?? []);
    })();
  }, []);

  const filtered = rows.filter((r) =>
    !q || (r.full_name?.toLowerCase().includes(q.toLowerCase()) || r.email?.toLowerCase().includes(q.toLowerCase()) || r.department?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AppLayout
      nav={
        <>
          <NavItem to="/hr" label="Overview" />
          <NavItem to="/hr/employees" label="Employees" />
          <NavItem to="/hr/form-builder" label="Form Builder" />
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">Click a row to view detailed responses and AI insights.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 w-72" />
          </div>
        </div>

        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-4 font-medium">Employee</th>
                  <th className="text-left p-4 font-medium">Department</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Risk score</th>
                  <th className="text-left p-4 font-medium">Risk level</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user_id} className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => setActive(r)}>
                    <td className="p-4">
                      <div className="font-medium">{r.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="p-4">{r.department}</td>
                    <td className="p-4">
                      {r.responses ? <Badge variant="secondary">Submitted</Badge> : <Badge variant="outline">Pending</Badge>}
                    </td>
                    <td className="p-4">{r.risk_score !== undefined && r.risk_score !== null ? Number(r.risk_score).toFixed(0) : "—"}</td>
                    <td className="p-4">
                      {r.risk_level === "high" && <Badge className="bg-danger text-danger-foreground">High</Badge>}
                      {r.risk_level === "medium" && <Badge className="bg-warning text-warning-foreground">Medium</Badge>}
                      {r.risk_level === "low" && <Badge className="bg-success text-success-foreground">Low</Badge>}
                      {!r.risk_level && <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No employees yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.full_name || active.email}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Risk score" value={active.risk_score !== null ? Number(active.risk_score).toFixed(0) : "—"} />
                  <Stat label="Level" value={active.risk_level || "—"} />
                  <Stat label="Department" value={active.department} />
                </div>
                {active.insights && (
                  <Card className="p-4 bg-gradient-subtle">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                      Insights {active.ai_generated && <Badge variant="outline" className="text-xs">AI</Badge>}
                    </div>
                    <p className="text-sm">{active.insights}</p>
                    {active.recommendations && (
                      <>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-1">Recommendations</div>
                        <pre className="text-sm whitespace-pre-wrap font-sans">{active.recommendations}</pre>
                      </>
                    )}
                  </Card>
                )}
                {active.responses && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Responses</div>
                    <div className="space-y-2">
                      {fields.map((f) => (
                        <div key={f.id} className="flex justify-between gap-4 text-sm border-b border-border py-2">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className="font-medium text-right">{String(active.responses?.[f.field_key] ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!active.responses && <p className="text-sm text-muted-foreground">No responses submitted yet.</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 rounded-lg bg-secondary/50">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-semibold capitalize">{value}</div>
  </div>
);

export default HREmployees;