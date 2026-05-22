import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Search,
  RefreshCw,
  Trash2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Activity,
  LayoutGrid,
  List as ListIcon,
  Download,
  Mail,
  Building2,
  ArrowUpDown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type SortKey = "name" | "risk_desc" | "risk_asc" | "recent" | "department";

const HREmployees = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<any | null>(null);
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low" | "pending">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("risk_desc");
  const reloadTimer = useRef<number | null>(null);

  const load = async () => {
    const [{ data: profiles }, { data: subs }, { data: risks }, { data: ff }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,department"),
      supabase.from("submissions").select("user_id,responses,updated_at"),
      supabase.from("risk_assessments").select("user_id,risk_score,risk_level,insights,recommendations,ai_generated,updated_at"),
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
        updated_at: s?.updated_at ?? r?.updated_at,
        ...r,
      };
    });
    setRows(merged);
    setFields(ff ?? []);
    setActive((prev: any) => (prev ? merged.find((m) => m.user_id === prev.user_id) ?? prev : prev));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      toast.success("Employee data refreshed");
    } catch (e: any) {
      toast.error(e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (employee: any) => {
    if (!employee?.user_id) return;
    setDeleting(true);
    try {
      const uid = employee.user_id;
      await supabase.from("risk_assessments").delete().eq("user_id", uid);
      await supabase.from("submissions").delete().eq("user_id", uid);
      await supabase.from("user_roles").delete().eq("user_id", uid);
      const { error } = await supabase.from("profiles").delete().eq("user_id", uid);
      if (error) throw error;
      toast.success(`Removed ${employee.full_name || employee.email}`);
      setConfirmDelete(null);
      setActive((prev: any) => (prev?.user_id === uid ? null : prev));
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove employee");
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Name", "Email", "Department", "Status", "Risk Score", "Risk Level", "Last Updated"];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      const row = [
        r.full_name || "",
        r.email || "",
        r.department || "",
        r.responses ? "Submitted" : "Pending",
        r.risk_score ?? "",
        r.risk_level ?? "",
        r.updated_at ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  useEffect(() => {
    load();
    const debouncedReload = () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => load(), 300);
    };
    const channel = supabase
      .channel("hr-employees-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "risk_assessments" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, debouncedReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const departments = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.department && r.department !== "—" && s.add(r.department));
    return Array.from(s).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter((r) => r.responses).length;
    const high = rows.filter((r) => r.risk_level === "high").length;
    const medium = rows.filter((r) => r.risk_level === "medium").length;
    const low = rows.filter((r) => r.risk_level === "low").length;
    const scored = rows.filter((r) => r.risk_score != null);
    const avg = scored.length ? scored.reduce((a, r) => a + Number(r.risk_score), 0) / scored.length : 0;
    return { total, submitted, high, medium, low, avg, pending: total - submitted };
  }, [rows]);

  const filtered = useMemo(() => {
    let f = rows.filter((r) => {
      if (q) {
        const ql = q.toLowerCase();
        if (!(r.full_name?.toLowerCase().includes(ql) || r.email?.toLowerCase().includes(ql) || r.department?.toLowerCase().includes(ql))) return false;
      }
      if (riskFilter === "pending" && r.responses) return false;
      if (riskFilter !== "all" && riskFilter !== "pending" && r.risk_level !== riskFilter) return false;
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      return true;
    });
    f = [...f].sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
        case "risk_asc":
          return (a.risk_score ?? -1) - (b.risk_score ?? -1);
        case "risk_desc":
          return (b.risk_score ?? -1) - (a.risk_score ?? -1);
        case "recent":
          return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
        case "department":
          return (a.department || "").localeCompare(b.department || "");
      }
    });
    return f;
  }, [rows, q, riskFilter, deptFilter, sort]);

  const activeFilterCount = (riskFilter !== "all" ? 1 : 0) + (deptFilter !== "all" ? 1 : 0) + (q ? 1 : 0);

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
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 md:p-8 text-primary-foreground shadow-elegant">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary-glow)) 0, transparent 40%), radial-gradient(circle at 80% 80%, hsl(var(--accent)) 0, transparent 40%)" }} />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80 mb-2">
                <Sparkles className="h-3.5 w-3.5" /> People intelligence
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Employees</h1>
              <p className="opacity-90 mt-1 max-w-xl">Browse your team, monitor attrition risk in real time, and act before signals turn into resignations.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportCsv} className="bg-white/15 text-primary-foreground border-white/20 hover:bg-white/25">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing} className="bg-white text-primary hover:bg-white/90">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>
          {/* Stats strip */}
          <div className="relative mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
            <HeroStat icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
            <HeroStat icon={<Activity className="h-4 w-4" />} label="Submitted" value={stats.submitted} sub={`${stats.pending} pending`} />
            <HeroStat icon={<ShieldAlert className="h-4 w-4" />} label="High risk" value={stats.high} tone="danger" />
            <HeroStat icon={<AlertTriangle className="h-4 w-4" />} label="Medium" value={stats.medium} tone="warning" />
            <HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Avg score" value={stats.avg.toFixed(1)} />
          </div>
        </div>

        {/* Toolbar */}
        <Card className="p-3 md:p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, department…" className="pl-9" />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-1">
              {(["all", "high", "medium", "low", "pending"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRiskFilter(k)}
                  className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors ${
                    riskFilter === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "all" ? "All risk" : k}
                </button>
              ))}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  {deptFilter === "all" ? "All departments" : deptFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
                <DropdownMenuLabel>Department</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeptFilter("all")}>All departments</DropdownMenuItem>
                {departments.map((d) => (
                  <DropdownMenuItem key={d} onClick={() => setDeptFilter(d)}>{d}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4 mr-2" /> Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSort("risk_desc")}>Risk: high → low</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("risk_asc")}>Risk: low → high</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("name")}>Name (A–Z)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("department")}>Department</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("recent")}>Most recent</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setView("grid")}
                className={`p-2 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-2 ${view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                title="List view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {rows.length}
            </span>
            {activeFilterCount > 0 && (
              <>
                <span>·</span>
                <button
                  onClick={() => { setQ(""); setRiskFilter("all"); setDeptFilter("all"); }}
                  className="text-primary hover:underline"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Content */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center shadow-soft">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">No employees match your filters</div>
            <p className="text-sm text-muted-foreground mt-1">Try clearing search or filters to see more results.</p>
          </Card>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <EmployeeCard
                key={r.user_id}
                emp={r}
                onOpen={() => setActive(r)}
                onDelete={() => setConfirmDelete(r)}
              />
            ))}
          </div>
        ) : (
          <Card className="shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-4 font-medium">Employee</th>
                    <th className="text-left p-4 font-medium">Department</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Risk</th>
                    <th className="text-left p-4 font-medium">Level</th>
                    <th className="text-left p-4 font-medium">Updated</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.user_id} className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => setActive(r)}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.full_name || r.email} />
                          <div>
                            <div className="font-medium">{r.full_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{r.department}</td>
                      <td className="p-4">
                        {r.responses ? <Badge variant="secondary">Submitted</Badge> : <Badge variant="outline">Pending</Badge>}
                      </td>
                      <td className="p-4">
                        <RiskBar score={r.risk_score} />
                      </td>
                      <td className="p-4"><RiskBadge level={r.risk_level} /></td>
                      <td className="p-4 text-muted-foreground text-xs">{formatRelative(r.updated_at)}</td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(r)}
                          title="Remove employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <Avatar name={active.full_name || active.email} size="lg" />
                  <div className="flex-1">
                    <DialogTitle>{active.full_name || active.email}</DialogTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Mail className="h-3.5 w-3.5" /> {active.email}
                      <span>·</span>
                      <Building2 className="h-3.5 w-3.5" /> {active.department}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap pt-3">
                  {active.responses ? (
                    <Badge className="bg-success text-success-foreground gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-foreground" />
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-warning text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Not submitted
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    {active.updated_at ? (
                      <span title={new Date(active.updated_at).toLocaleString()}>
                        Updated {formatRelative(active.updated_at)}
                      </span>
                    ) : (
                      <span>No submission yet</span>
                    )}
                  </div>
                </div>
              </DialogHeader>
              <div className="flex justify-end -mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(active)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove employee
                </Button>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <RiskGauge score={active.risk_score} level={active.risk_level} />
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

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium text-foreground">{confirmDelete?.full_name || confirmDelete?.email}</span>'s
              profile, submission, risk assessment, and role assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(confirmDelete); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

const HeroStat = ({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "danger" | "warning" }) => (
  <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-3">
    <div className="flex items-center gap-2 text-xs opacity-90">{icon}<span>{label}</span></div>
    <div className={`text-2xl font-bold mt-1 ${tone === "danger" ? "text-white" : ""}`}>{value}</div>
    {sub && <div className="text-[11px] opacity-75">{sub}</div>}
  </div>
);

const EmployeeCard = ({ emp, onOpen, onDelete }: { emp: any; onOpen: () => void; onDelete: () => void }) => {
  const level = emp.risk_level as "high" | "medium" | "low" | undefined;
  const borderTone =
    level === "high" ? "before:bg-danger" :
    level === "medium" ? "before:bg-warning" :
    level === "low" ? "before:bg-success" :
    "before:bg-muted";
  return (
    <Card
      className={`group relative overflow-hidden cursor-pointer transition-all hover:shadow-elegant hover:-translate-y-0.5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${borderTone}`}
      onClick={onOpen}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={emp.full_name || emp.email} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{emp.full_name || "—"}</div>
            <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{emp.department}</span>
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={onDelete} title="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <RiskRing score={emp.risk_score} level={level} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <RiskBadge level={level} />
              {emp.ai_generated && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {emp.responses ? "Submitted" : "Awaiting submission"}
              <span className="mx-1">·</span>
              {formatRelative(emp.updated_at)}
            </div>
          </div>
        </div>

        {emp.insights && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 border-t border-border pt-3">
            {emp.insights}
          </p>
        )}
      </div>
    </Card>
  );
};

const Avatar = ({ name, size = "md" }: { name?: string; size?: "md" | "lg" }) => {
  const initials = (name || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const hue = Array.from(name || "?").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const cls = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-sm";
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 50%))` }}
    >
      {initials || "?"}
    </div>
  );
};

const RiskBadge = ({ level }: { level?: string }) => {
  if (level === "high") return <Badge className="bg-danger text-danger-foreground">High risk</Badge>;
  if (level === "medium") return <Badge className="bg-warning text-warning-foreground">Medium</Badge>;
  if (level === "low") return <Badge className="bg-success text-success-foreground">Low</Badge>;
  return <Badge variant="outline">No score</Badge>;
};

const RiskBar = ({ score }: { score?: number | null }) => {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const v = Math.max(0, Math.min(100, Number(score)));
  const color = v >= 66 ? "bg-danger" : v >= 33 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{v.toFixed(0)}</span>
    </div>
  );
};

const RiskRing = ({ score, level }: { score?: number | null; level?: string }) => {
  const v = Math.max(0, Math.min(100, Number(score ?? 0)));
  const color = level === "high" ? "hsl(var(--danger))" : level === "medium" ? "hsl(var(--warning))" : level === "low" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))";
  return (
    <div
      className="relative h-14 w-14 rounded-full grid place-items-center shrink-0"
      style={{ background: `conic-gradient(${color} ${v * 3.6}deg, hsl(var(--secondary)) 0)` }}
    >
      <div className="h-11 w-11 rounded-full bg-card grid place-items-center">
        <span className="text-sm font-bold tabular-nums">{score == null ? "—" : v.toFixed(0)}</span>
      </div>
    </div>
  );
};

const RiskGauge = ({ score, level }: { score?: number | null; level?: string }) => {
  const v = Math.max(0, Math.min(100, Number(score ?? 0)));
  const color = level === "high" ? "hsl(var(--danger))" : level === "medium" ? "hsl(var(--warning))" : level === "low" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))";
  return (
    <div className="p-3 rounded-lg bg-secondary/50 flex items-center gap-3">
      <div
        className="relative h-12 w-12 rounded-full grid place-items-center"
        style={{ background: `conic-gradient(${color} ${v * 3.6}deg, hsl(var(--border)) 0)` }}
      >
        <div className="h-9 w-9 rounded-full bg-card grid place-items-center text-xs font-bold">
          {score == null ? "—" : v.toFixed(0)}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk score</div>
        <div className="font-semibold">{score == null ? "—" : `${v.toFixed(0)} / 100`}</div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-3 rounded-lg bg-secondary/50">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-semibold capitalize">{value}</div>
  </div>
);

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

export default HREmployees;
