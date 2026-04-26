import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Users, Activity } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type EmpRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  risk_score: number | null;
  risk_level: string | null;
  submitted: boolean;
};

const COLORS = { low: "hsl(var(--success))", medium: "hsl(var(--warning))", high: "hsl(var(--danger))" };

const HRDashboard = () => {
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reloadTimer = useRef<number | null>(null);

  const load = async () => {
    const [{ data: profiles }, { data: subs }, { data: risks }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,department"),
      supabase.from("submissions").select("user_id,responses"),
      supabase.from("risk_assessments").select("user_id,risk_score,risk_level"),
    ]);
    const subMap = new Map((subs ?? []).map((s: any) => [s.user_id, s]));
    const riskMap = new Map((risks ?? []).map((r: any) => [r.user_id, r]));
    const merged: EmpRow[] = (profiles ?? []).map((p: any) => {
      const r = riskMap.get(p.user_id);
      const s = subMap.get(p.user_id);
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        department: p.department || s?.responses?.department || "—",
        risk_score: r?.risk_score ?? null,
        risk_level: r?.risk_level ?? null,
        submitted: !!s,
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const debouncedReload = () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => load(), 300);
    };

    const channel = supabase
      .channel("hr-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_assessments" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debouncedReload)
      .subscribe();

    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((r) => r.submitted).length;
    const high = rows.filter((r) => r.risk_level === "high").length;
    const med = rows.filter((r) => r.risk_level === "medium").length;
    const low = rows.filter((r) => r.risk_level === "low").length;
    const avg = rows.filter((r) => r.risk_score !== null).reduce((a, r) => a + Number(r.risk_score), 0) / Math.max(1, rows.filter((r) => r.risk_score !== null).length);
    return { total, submitted, high, med, low, avg: isNaN(avg) ? 0 : avg };
  }, [rows]);

  const byDept = useMemo(() => {
    const map = new Map<string, { name: string; low: number; medium: number; high: number; avg: number; n: number }>();
    rows.forEach((r) => {
      const d = r.department || "—";
      const e = map.get(d) ?? { name: d, low: 0, medium: 0, high: 0, avg: 0, n: 0 };
      if (r.risk_level === "low") e.low++;
      if (r.risk_level === "medium") e.medium++;
      if (r.risk_level === "high") e.high++;
      if (r.risk_score !== null) {
        e.avg = (e.avg * e.n + Number(r.risk_score)) / (e.n + 1);
        e.n++;
      }
      map.set(d, e);
    });
    return Array.from(map.values());
  }, [rows]);

  const distribution = [
    { name: "Low risk", value: stats.low, color: COLORS.low },
    { name: "Medium risk", value: stats.med, color: COLORS.medium },
    { name: "High risk", value: stats.high, color: COLORS.high },
  ];

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
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attrition Overview</h1>
          <p className="text-muted-foreground">Real-time view of engagement and risk across your team.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Employees" value={stats.total.toString()} icon={Users} color="text-primary" />
          <StatCard label="Responses received" value={`${stats.submitted}/${stats.total}`} icon={Activity} color="text-accent" />
          <StatCard label="Avg. risk score" value={`${stats.avg.toFixed(1)}`} icon={TrendingDown} color="text-warning" />
          <StatCard label="High-risk employees" value={stats.high.toString()} icon={AlertTriangle} color="text-danger" />
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <Card className="p-6 shadow-soft lg:col-span-2">
            <h3 className="font-semibold mb-4">Risk distribution</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-soft lg:col-span-3">
            <h3 className="font-semibold mb-4">By department</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byDept}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="low" stackId="a" fill={COLORS.low} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="medium" stackId="a" fill={COLORS.medium} />
                  <Bar dataKey="high" stackId="a" fill={COLORS.high} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold mb-4">High-risk employees</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              {rows.filter((r) => r.risk_level === "high").slice(0, 6).map((r) => (
                <div key={r.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="font-medium">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.department}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-danger">{Number(r.risk_score).toFixed(0)}/100</div>
                    <Badge className="bg-danger text-danger-foreground">High</Badge>
                  </div>
                </div>
              ))}
              {rows.filter((r) => r.risk_level === "high").length === 0 && (
                <p className="text-sm text-muted-foreground">No high-risk employees right now. 🎉</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <Card className="p-5 shadow-soft">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-3xl font-bold mt-1 tracking-tight">{value}</div>
      </div>
      <Icon className={`h-6 w-6 ${color}`} />
    </div>
  </Card>
);

export default HRDashboard;