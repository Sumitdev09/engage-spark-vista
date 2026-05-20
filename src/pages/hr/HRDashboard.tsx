import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertTriangle, TrendingDown, TrendingUp, Users, Activity, RefreshCw,
  Sparkles, Search, Download, ArrowUpRight, Flame, ShieldCheck, Building2, Zap, Target,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend, RadialBar, RadialBarChart, PolarAngleAxis,
} from "recharts";

type EmpRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  risk_score: number | null;
  risk_level: string | null;
  submitted: boolean;
  updated_at: string | null;
  insights?: any;
};

const COLORS = { low: "hsl(var(--success))", medium: "hsl(var(--warning))", high: "hsl(var(--danger))" };

const HRDashboard = () => {
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const reloadTimer = useRef<number | null>(null);

  const load = async () => {
    const [{ data: profiles }, { data: subs }, { data: risks }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,department"),
      supabase.from("submissions").select("user_id,responses,updated_at"),
      supabase.from("risk_assessments").select("user_id,risk_score,risk_level,insights"),
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
        updated_at: s?.updated_at ?? null,
        insights: r?.insights ?? null,
      };
    });
    setRows(merged);
    setLastSync(new Date());
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      toast.success("Dashboard refreshed");
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
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

  // Tick every 15s so relative timestamps stay fresh
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((r) => r.submitted).length;
    const high = rows.filter((r) => r.risk_level === "high").length;
    const med = rows.filter((r) => r.risk_level === "medium").length;
    const low = rows.filter((r) => r.risk_level === "low").length;
    const avg = rows.filter((r) => r.risk_score !== null).reduce((a, r) => a + Number(r.risk_score), 0) / Math.max(1, rows.filter((r) => r.risk_score !== null).length);
    const responseRate = total ? Math.round((submitted / total) * 100) : 0;
    const engagement = Math.max(0, Math.min(100, Math.round(100 - (isNaN(avg) ? 0 : avg))));
    return { total, submitted, high, med, low, avg: isNaN(avg) ? 0 : avg, responseRate, engagement };
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

  const trend = useMemo(() => {
    // Build 14-day submission trend from updated_at
    const days: { date: string; label: string; submissions: number; risk: number; n: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        submissions: 0,
        risk: 0,
        n: 0,
      });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    rows.forEach((r) => {
      if (!r.updated_at) return;
      const k = new Date(r.updated_at).toISOString().slice(0, 10);
      const i = idx.get(k);
      if (i === undefined) return;
      days[i].submissions += 1;
      if (r.risk_score !== null) {
        days[i].risk = (days[i].risk * days[i].n + Number(r.risk_score)) / (days[i].n + 1);
        days[i].n += 1;
      }
    });
    return days;
  }, [rows]);

  const topRiskDepts = useMemo(() => {
    return [...byDept]
      .map((d) => ({ ...d, total: d.low + d.medium + d.high, pct: (d.high / Math.max(1, d.low + d.medium + d.high)) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [byDept]);

  const departments = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.department || "—")))], [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQ = !search || (r.full_name || "").toLowerCase().includes(search.toLowerCase()) || (r.email || "").toLowerCase().includes(search.toLowerCase());
      const matchD = deptFilter === "all" || (r.department || "—") === deptFilter;
      return matchQ && matchD;
    });
  }, [rows, search, deptFilter]);

  const aiHighlights = useMemo(() => {
    const items: { user: string; text: string; level: string }[] = [];
    rows.forEach((r) => {
      const ins = r.insights;
      const list = Array.isArray(ins) ? ins : Array.isArray(ins?.insights) ? ins.insights : [];
      list.slice(0, 1).forEach((t: any) => items.push({ user: r.full_name || r.email || "Employee", text: String(t), level: r.risk_level || "low" }));
    });
    return items.slice(0, 4);
  }, [rows]);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Department", "Risk Score", "Risk Level", "Submitted", "Last Updated"];
    const lines = rows.map((r) => [r.full_name ?? "", r.email ?? "", r.department ?? "", r.risk_score ?? "", r.risk_level ?? "", r.submitted ? "Yes" : "No", r.updated_at ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attrition-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

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
      <div className="space-y-6 animate-fade-in">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl border border-border shadow-elegant">
          <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative p-6 md:p-8 text-white">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium mb-3">
                  <Sparkles className="h-3.5 w-3.5" /> AI-powered attrition intelligence
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Attrition Command Center</h1>
                <p className="text-white/80 mt-1 max-w-xl">Real-time pulse on engagement, retention risk, and team health across your organization.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  Live · {formatRelative(lastSync?.toISOString() ?? null)}
                </div>
                <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing} className="bg-white text-foreground hover:bg-white/90">
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Syncing…" : "Refresh"}
                </Button>
                <Button variant="secondary" size="sm" onClick={exportCsv} className="bg-white/15 text-white hover:bg-white/25 border border-white/20">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </div>
            </div>

            {/* Hero KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <HeroKpi icon={Users} label="Employees" value={stats.total} sub="active profiles" />
              <HeroKpi icon={Activity} label="Response rate" value={`${stats.responseRate}%`} sub={`${stats.submitted} of ${stats.total} responded`} />
              <HeroKpi icon={Target} label="Engagement" value={`${stats.engagement}`} sub="health index /100" />
              <HeroKpi icon={Flame} label="At risk" value={stats.high} sub={`${stats.med} medium · ${stats.low} low`} accent />
            </div>
          </div>
        </div>

        {/* SECONDARY METRICS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Avg. risk score" value={stats.avg.toFixed(1)} suffix="/100" trend={stats.avg < 50 ? "down" : "up"} icon={TrendingDown} tone="warning" />
          <MetricCard label="Stable employees" value={stats.low} suffix={` of ${stats.total}`} icon={ShieldCheck} tone="success" />
          <MetricCard label="Watch list" value={stats.med} suffix=" medium risk" icon={AlertTriangle} tone="warning" />
          <MetricCard label="Critical" value={stats.high} suffix=" high risk" icon={Zap} tone="danger" />
        </div>

        {/* CHARTS */}
        <div className="grid lg:grid-cols-6 gap-4">
          <Card className="p-6 shadow-soft lg:col-span-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Engagement trend</h3>
                <Badge variant="outline" className="gap-1"><TrendingUp className="h-3 w-3" /> 14 days</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Daily submissions and average risk score</p>
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                    <Legend />
                    <Area type="monotone" dataKey="submissions" name="Submissions" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gSub)" />
                    <Area type="monotone" dataKey="risk" name="Avg risk" stroke="hsl(var(--danger))" strokeWidth={2} fill="url(#gRisk)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-soft lg:col-span-2 relative overflow-hidden">
            <h3 className="font-semibold mb-1">Risk distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">Across the entire organization</p>
            <div className="h-56 relative">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                    {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">employees</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {distribution.map((d) => (
                <div key={d.name} className="text-center p-2 rounded-lg bg-secondary/40">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs text-muted-foreground">{d.name.split(" ")[0]}</span>
                  </div>
                  <div className="text-lg font-semibold mt-0.5">{d.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* DEPT + HEALTH */}
        <div className="grid lg:grid-cols-6 gap-4">
          <Card className="p-6 shadow-soft lg:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Risk by department</h3>
              <Badge variant="outline">{byDept.length} teams</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Stacked composition of risk levels per team</p>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byDept} barSize={36}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend />
                  <Bar dataKey="low" stackId="a" fill={COLORS.low} />
                  <Bar dataKey="medium" stackId="a" fill={COLORS.medium} />
                  <Bar dataKey="high" stackId="a" fill={COLORS.high} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-soft lg:col-span-2 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full" style={{ background: "var(--gradient-primary)", opacity: 0.08 }} />
            <h3 className="font-semibold relative">Organization health</h3>
            <p className="text-xs text-muted-foreground mb-4 relative">Composite engagement score</p>
            <div className="h-48 relative">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ name: "score", value: stats.engagement, fill: "hsl(var(--primary))" }]} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--secondary))" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">{stats.engagement}</div>
                <div className="text-xs text-muted-foreground">out of 100</div>
              </div>
            </div>
            <div className="space-y-2 mt-3 relative">
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Response rate</span><span className="font-medium">{stats.responseRate}%</span></div>
                <Progress value={stats.responseRate} className="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Retention strength</span><span className="font-medium">{100 - Math.round((stats.high / Math.max(1, stats.total)) * 100)}%</span></div>
                <Progress value={100 - Math.round((stats.high / Math.max(1, stats.total)) * 100)} className="h-1.5" />
              </div>
            </div>
          </Card>
        </div>

        {/* INSIGHTS + TOP DEPTS */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-6 shadow-soft relative overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 bg-accent/10 rounded-full blur-2xl" />
            <div className="flex items-center justify-between mb-4 relative">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </span>
                AI insights
              </h3>
              <Badge variant="outline" className="text-xs">Auto-generated</Badge>
            </div>
            <div className="space-y-3 relative">
              {aiHighlights.length === 0 && (
                <p className="text-sm text-muted-foreground">No AI insights yet. Insights appear after employees complete the survey.</p>
              )}
              {aiHighlights.map((it, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    it.level === "high" ? "bg-danger/15 text-danger" : it.level === "medium" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                  }`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{it.user}</div>
                    <div className="text-sm leading-snug line-clamp-2">{it.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-danger" /> Departments to watch</h3>
              <Badge variant="outline" className="text-xs">Top {topRiskDepts.length}</Badge>
            </div>
            <div className="space-y-3">
              {topRiskDepts.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.total} people</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">avg {d.avg.toFixed(0)}</span>
                      <Badge className={d.pct > 30 ? "bg-danger text-danger-foreground" : d.pct > 10 ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}>
                        {d.pct.toFixed(0)}% high
                      </Badge>
                    </div>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                    <div style={{ width: `${(d.low / Math.max(1, d.total)) * 100}%`, background: COLORS.low }} />
                    <div style={{ width: `${(d.medium / Math.max(1, d.total)) * 100}%`, background: COLORS.medium }} />
                    <div style={{ width: `${(d.high / Math.max(1, d.total)) * 100}%`, background: COLORS.high }} />
                  </div>
                </div>
              ))}
              {topRiskDepts.length === 0 && <p className="text-sm text-muted-foreground">No department data yet.</p>}
            </div>
          </Card>
        </div>

        {/* EMPLOYEE EXPLORER */}
        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="font-semibold">Employee explorer</h3>
              <p className="text-xs text-muted-foreground">Filter and triage your workforce by risk</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-8 h-9 w-56" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {departments.slice(0, 6).map((d) => (
                  <Button key={d} variant={deptFilter === d ? "default" : "outline"} size="sm" onClick={() => setDeptFilter(d)} className="h-8">
                    {d === "all" ? "All" : d}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Tabs defaultValue="high" className="w-full">
            <TabsList>
              <TabsTrigger value="high">High risk ({rows.filter(r => r.risk_level === "high").length})</TabsTrigger>
              <TabsTrigger value="medium">Medium ({rows.filter(r => r.risk_level === "medium").length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({rows.filter(r => !r.submitted).length})</TabsTrigger>
              <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
            </TabsList>

            {(["high", "medium", "pending", "all"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <div className="grid sm:grid-cols-2 gap-2">
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    filtered
                      .filter((r) =>
                        tab === "all" ? true :
                        tab === "pending" ? !r.submitted :
                        r.risk_level === tab
                      )
                      .slice(0, 12)
                      .map((r) => <EmployeeRow key={r.user_id} r={r} />)
                  )}
                  {!loading && filtered.filter((r) => tab === "all" ? true : tab === "pending" ? !r.submitted : r.risk_level === tab).length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2 py-6 text-center">Nothing here. 🎉</p>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </AppLayout>
  );
};

const HeroKpi = ({ icon: Icon, label, value, sub, accent }: any) => (
  <div className={`p-4 rounded-xl backdrop-blur-sm border border-white/15 ${accent ? "bg-white/20" : "bg-white/10"} hover:bg-white/20 transition-colors`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs uppercase tracking-wider text-white/70">{label}</span>
      <Icon className="h-4 w-4 text-white/80" />
    </div>
    <div className="text-3xl font-bold tracking-tight">{value}</div>
    <div className="text-xs text-white/70 mt-0.5">{sub}</div>
  </div>
);

const toneMap: any = {
  success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
  warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
  danger: { bg: "bg-danger/10", text: "text-danger", ring: "ring-danger/20" },
  primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
};

const MetricCard = ({ label, value, suffix, icon: Icon, tone = "primary", trend }: any) => {
  const t = toneMap[tone];
  return (
    <Card className="p-5 shadow-soft hover:shadow-elegant transition-all hover:-translate-y-0.5 relative overflow-hidden group">
      <div className={`absolute -top-6 -right-6 h-24 w-24 rounded-full ${t.bg} blur-2xl group-hover:scale-110 transition-transform`} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold mt-1 tracking-tight">{value}<span className="text-sm font-normal text-muted-foreground">{suffix}</span></div>
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${t.bg} ${t.text} ${t.ring}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className={`mt-3 inline-flex items-center gap-1 text-xs ${trend === "down" ? "text-success" : "text-danger"}`}>
          {trend === "down" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          vs. last period
        </div>
      )}
    </Card>
  );
};

const EmployeeRow = ({ r }: { r: EmpRow }) => {
  const level = r.risk_level;
  const tone = level === "high" ? "danger" : level === "medium" ? "warning" : level === "low" ? "success" : "primary";
  const t = toneMap[tone];
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:shadow-soft hover:border-primary/30 transition-all group">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${t.bg} ${t.text}`}>
          {(r.full_name || r.email || "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{r.full_name || r.email}</div>
          <div className="text-xs text-muted-foreground truncate">{r.department} · {r.submitted ? `updated ${formatRelative(r.updated_at)}` : "no response yet"}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.risk_score !== null ? (
          <span className={`text-sm font-semibold ${t.text}`}>{Number(r.risk_score).toFixed(0)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <Badge variant="outline" className={`capitalize ${t.text} ${level ? "border-current" : ""}`}>
          {level ?? "pending"}
        </Badge>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default HRDashboard;