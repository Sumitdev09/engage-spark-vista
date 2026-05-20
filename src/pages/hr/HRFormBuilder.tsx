import { useEffect, useMemo, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlignLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Copy,
  Eye,
  GripVertical,
  Hash,
  ListChecks,
  Mail,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Type,
  Gauge,
  TrendingUp,
  Info,
} from "lucide-react";
import { DynamicFormRenderer, FormField } from "@/components/DynamicFormRenderer";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Field = {
  id?: string;
  field_key: string;
  label: string;
  description: string | null;
  field_type: string;
  options: any;
  required: boolean;
  position: number;
  category: string | null;
  active: boolean;
  risk_weight: number | null;
  risk_direction: string | null;
};

const TYPES: { v: string; l: string; icon: any; hint: string }[] = [
  { v: "text", l: "Short text", icon: Type, hint: "Single-line input" },
  { v: "textarea", l: "Long text", icon: AlignLeft, hint: "Paragraphs / feedback" },
  { v: "number", l: "Number", icon: Hash, hint: "Numeric value" },
  { v: "email", l: "Email", icon: Mail, hint: "Validated email address" },
  { v: "date", l: "Date", icon: CalendarIcon, hint: "Date picker" },
  { v: "rating", l: "Rating", icon: Star, hint: "Star rating scale" },
  { v: "yesno", l: "Yes / No", icon: Check, hint: "Binary toggle" },
  { v: "dropdown", l: "Dropdown", icon: ChevronDown, hint: "Single choice list" },
  { v: "multiselect", l: "Multi-select", icon: ListChecks, hint: "Multiple choice" },
];

const typeMeta = (v: string) => TYPES.find((t) => t.v === v) ?? TYPES[0];

const empty: Field = {
  field_key: "",
  label: "",
  description: "",
  field_type: "text",
  options: null,
  required: false,
  position: 999,
  category: "General",
  active: true,
  risk_weight: null,
  risk_direction: null,
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const HRFormBuilder = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [editing, setEditing] = useState<Field | null>(null);
  const [optionsText, setOptionsText] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    const { data } = await supabase.from("form_fields").select("*").order("position");
    setFields((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    fields.forEach((f) => set.add(f.category || "General"));
    return ["all", ...Array.from(set)];
  }, [fields]);

  const filtered = useMemo(() => {
    return fields.filter((f) => {
      const matchCat = activeCategory === "all" || (f.category || "General") === activeCategory;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.field_key.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [fields, activeCategory, search]);

  const stats = useMemo(() => {
    const active = fields.filter((f) => f.active).length;
    const required = fields.filter((f) => f.required).length;
    const scored = fields.filter((f) => f.risk_weight && f.risk_weight > 0).length;
    return { total: fields.length, active, required, scored };
  }, [fields]);

  // Risk scoring helper — compute how each field contributes to the overall attrition score.
  const riskBreakdown = useMemo(() => {
    const scored = fields.filter((f) => f.active && f.risk_weight && f.risk_weight > 0);
    const totalWeight = scored.reduce((a, f) => a + Number(f.risk_weight ?? 0), 0);
    const items = scored
      .map((f) => ({
        field: f,
        weight: Number(f.risk_weight ?? 0),
        share: totalWeight ? (Number(f.risk_weight ?? 0) / totalWeight) * 100 : 0,
      }))
      .sort((a, b) => b.weight - a.weight);
    const missingDirection = scored.filter((f) => !f.risk_direction).length;
    return { items, totalWeight, missingDirection };
  }, [fields]);

  // Live impact for the field currently being edited
  const editingImpact = useMemo(() => {
    if (!editing) return null;
    const w = Number(editing.risk_weight ?? 0);
    if (!w) return { share: 0, totalAfter: riskBreakdown.totalWeight, rank: null as number | null };
    const others = riskBreakdown.items
      .filter((it) => it.field.id !== editing.id)
      .map((it) => it.weight);
    const totalAfter = others.reduce((a, x) => a + x, 0) + w;
    const share = totalAfter ? (w / totalAfter) * 100 : 0;
    const sorted = [...others, w].sort((a, b) => b - a);
    const rank = sorted.indexOf(w) + 1;
    return { share, totalAfter, rank };
  }, [editing, riskBreakdown]);

  const openNew = (type?: string) => {
    setEditing({
      ...empty,
      field_type: type ?? "text",
      position: (fields[fields.length - 1]?.position ?? 0) + 1,
    });
    setOptionsText("");
  };

  const openEdit = (f: Field) => {
    setEditing({ ...f });
    setOptionsText(
      Array.isArray(f.options)
        ? f.options.join("\n")
        : f.field_type === "rating" && f.options?.max
        ? String(f.options.max)
        : ""
    );
  };

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (
      editing.field_type === "dropdown" ||
      editing.field_type === "select" ||
      editing.field_type === "multiselect"
    ) {
      payload.options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (editing.field_type === "rating") {
      payload.options = { max: Number(optionsText) || 5 };
    } else {
      payload.options = null;
    }
    if (!payload.field_key) payload.field_key = slugify(payload.label);
    if (!payload.field_key || !payload.label) return toast.error("Label is required");

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("form_fields").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("form_fields").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Field updated" : "Field added");
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this field? Existing responses are preserved.")) return;
    const { error } = await supabase.from("form_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Field deleted");
    load();
  };

  const duplicate = async (f: Field) => {
    const { id, ...rest } = f;
    const copy: any = {
      ...rest,
      label: `${f.label} (copy)`,
      field_key: `${f.field_key}_copy_${Math.random().toString(36).slice(2, 6)}`,
      position: (fields[fields.length - 1]?.position ?? 0) + 1,
    };
    const { error } = await supabase.from("form_fields").insert(copy);
    if (error) return toast.error(error.message);
    toast.success("Field duplicated");
    load();
  };

  const toggleActive = async (f: Field) => {
    await supabase.from("form_fields").update({ active: !f.active }).eq("id", f.id!);
    load();
  };

  const toggleRequired = async (f: Field) => {
    await supabase.from("form_fields").update({ required: !f.required }).eq("id", f.id!);
    load();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);
    await Promise.all(
      reordered.map((f, idx) =>
        supabase.from("form_fields").update({ position: idx + 1 }).eq("id", f.id!)
      )
    );
    load();
  };

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
            <h1 className="text-3xl font-bold tracking-tight">Form Builder</h1>
            <p className="text-muted-foreground">
              Drag to reorder, click to edit, preview live. Changes are instant for employees.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> {stats.active}/{stats.total} active
            </Badge>
            <Badge variant="outline">{stats.required} required</Badge>
            <Badge variant="outline">{stats.scored} risk-scored</Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: palette + builder */}
          <div className="lg:col-span-7 space-y-5">
            {/* Palette */}
            <Card className="p-4 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">Add a question</h3>
                  <p className="text-xs text-muted-foreground">Pick a field type to get started</p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.v}
                    onClick={() => openNew(t.v)}
                    className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-center"
                    title={t.hint}
                  >
                    <t.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium">{t.l}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search questions…"
                    className="pl-9"
                  />
                </div>
                <Select value={activeCategory} onValueChange={setActiveCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "all" ? "All categories" : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => openNew()} className="bg-gradient-primary border-0 shadow-elegant">
                <Plus className="h-4 w-4 mr-1" /> New question
              </Button>
            </div>

            {/* Field list */}
            <Card className="shadow-soft overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-secondary grid place-items-center mb-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No questions match</p>
                  <p className="text-xs text-muted-foreground mt-1">Try clearing filters or add a new one.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext
                    items={filtered.map((f) => f.id!).filter(Boolean)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y divide-border">
                      {filtered.map((f) => (
                        <SortableRow
                          key={f.id}
                          field={f}
                          onEdit={() => openEdit(f)}
                          onDelete={() => del(f.id!)}
                          onDuplicate={() => duplicate(f)}
                          onToggleActive={() => toggleActive(f)}
                          onToggleRequired={() => toggleRequired(f)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </Card>

            {/* Risk scoring helper */}
            <Card className="shadow-soft overflow-hidden">
              <div className="p-5 border-b border-border bg-gradient-subtle">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: "var(--gradient-primary)" }}>
                      <Gauge className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Risk scoring helper</h3>
                      <p className="text-xs text-muted-foreground">
                        See how each question's weight contributes to the overall attrition score.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" /> Total weight {riskBreakdown.totalWeight.toFixed(1)}
                    </Badge>
                    <Badge variant="outline">{riskBreakdown.items.length} scored</Badge>
                  </div>
                </div>
                {riskBreakdown.missingDirection > 0 && (
                  <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg border border-warning/30 bg-warning/5 text-xs text-warning">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {riskBreakdown.missingDirection} scored field{riskBreakdown.missingDirection > 1 ? "s have" : " has"} no
                      direction set — answers won't count toward the risk score until you choose
                      "Lower = higher risk" or "Higher = higher risk".
                    </span>
                  </div>
                )}
              </div>

              {riskBreakdown.items.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium">No risk-scored questions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Open any active question and set a risk weight to see its impact here.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-2.5">
                  {/* Stacked composition bar */}
                  <div className="space-y-1.5">
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary">
                      {riskBreakdown.items.map((it, i) => {
                        const hue = (i * 47) % 360;
                        return (
                          <div
                            key={it.field.id}
                            title={`${it.field.label} — ${it.share.toFixed(1)}%`}
                            style={{
                              width: `${it.share}%`,
                              background: `hsl(${hue} 75% 55%)`,
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Composition of the overall attrition score by question weight
                    </p>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    {riskBreakdown.items.map((it, i) => {
                      const hue = (i * 47) % 360;
                      const meta = typeMeta(it.field.field_type);
                      const Icon = meta.icon;
                      const dirLabel =
                        it.field.risk_direction === "higher_risk_low"
                          ? "Lower answer ⇒ higher risk"
                          : it.field.risk_direction === "higher_risk_high"
                          ? "Higher answer ⇒ higher risk"
                          : "No direction";
                      return (
                        <button
                          key={it.field.id}
                          onClick={() => openEdit(it.field)}
                          className="w-full text-left p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/40 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ background: `hsl(${hue} 75% 55%)` }}
                            />
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate flex-1">{it.field.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              weight {it.weight}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 tabular-nums min-w-[52px] justify-center"
                            >
                              {it.share.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="mt-1.5 ml-[18px] flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${it.share}%`,
                                  background: `hsl(${hue} 75% 55%)`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-[10px] ${
                                it.field.risk_direction ? "text-muted-foreground" : "text-warning"
                              }`}
                            >
                              {dirLabel}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Right: live preview */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Eye className="h-4 w-4 text-primary" />
                  Live preview
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPreviewValues({})}>
                  Reset
                </Button>
              </div>
              <Card className="p-5 shadow-soft max-h-[calc(100vh-200px)] overflow-y-auto bg-gradient-subtle">
                {fields.filter((f) => f.active).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Add an active question to see the preview.
                  </p>
                ) : (
                  <DynamicFormRenderer
                    fields={fields.filter((f) => f.active) as unknown as FormField[]}
                    values={previewValues}
                    onChange={(k, v) => setPreviewValues((p) => ({ ...p, [k]: v }))}
                  />
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Edit sheet */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = typeMeta(editing.field_type).icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  {editing.id ? "Edit question" : "New question"}
                </SheetTitle>
              </SheetHeader>

              <Tabs defaultValue="basics" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basics">Basics</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                  <TabsTrigger value="risk">Risk scoring</TabsTrigger>
                </TabsList>

                <TabsContent value="basics" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Question label</Label>
                    <Input
                      value={editing.label}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          label: e.target.value,
                          field_key: editing.id ? editing.field_key : slugify(e.target.value),
                        })
                      }
                      placeholder="e.g. How satisfied are you with your role?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Helper text (optional)</Label>
                    <Input
                      value={editing.description ?? ""}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      placeholder="Shown beneath the question"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPES.map((t) => (
                        <button
                          key={t.v}
                          type="button"
                          onClick={() => setEditing({ ...editing, field_type: t.v })}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all ${
                            editing.field_type === t.v
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <t.icon className="h-4 w-4" />
                          <span className="text-xs">{t.l}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={editing.category ?? ""}
                        onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                        placeholder="Work, Engagement…"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field key</Label>
                      <Input
                        value={editing.field_key}
                        onChange={(e) => setEditing({ ...editing, field_key: slugify(e.target.value) })}
                        placeholder="auto from label"
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Required</Label>
                      <p className="text-xs text-muted-foreground">Employees must answer</p>
                    </div>
                    <Switch
                      checked={editing.required}
                      onCheckedChange={(v) => setEditing({ ...editing, required: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active</Label>
                      <p className="text-xs text-muted-foreground">Show on the survey form</p>
                    </div>
                    <Switch
                      checked={editing.active}
                      onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="options" className="space-y-4 mt-4">
                  {(editing.field_type === "dropdown" ||
                    editing.field_type === "select" ||
                    editing.field_type === "multiselect") && (
                    <div className="space-y-2">
                      <Label>Choices (one per line)</Label>
                      <Textarea
                        rows={6}
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                        placeholder={"Option A\nOption B\nOption C"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {optionsText.split("\n").filter((s) => s.trim()).length} option(s)
                      </p>
                    </div>
                  )}
                  {editing.field_type === "rating" && (
                    <div className="space-y-2">
                      <Label>Max rating (1–10)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={optionsText || "5"}
                        onChange={(e) => setOptionsText(e.target.value)}
                      />
                    </div>
                  )}
                  {!["dropdown", "select", "multiselect", "rating"].includes(editing.field_type) && (
                    <p className="text-sm text-muted-foreground">
                      No additional options available for this field type.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="risk" className="space-y-4 mt-4">
                  <Card className="p-4 bg-gradient-subtle">
                    <p className="text-xs text-muted-foreground">
                      Risk weight controls how strongly this answer affects the attrition score. Set
                      direction to tell the engine whether low or high values mean higher risk.
                    </p>
                  </Card>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Risk weight</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        value={editing.risk_weight ?? ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            risk_weight: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="0 = ignore"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direction</Label>
                      <Select
                        value={editing.risk_direction ?? "none"}
                        onValueChange={(v) =>
                          setEditing({ ...editing, risk_direction: v === "none" ? null : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— none —</SelectItem>
                          <SelectItem value="higher_risk_low">Lower = higher risk</SelectItem>
                          <SelectItem value="higher_risk_high">Higher = higher risk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Live impact estimator */}
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Impact preview</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {editingImpact?.share.toFixed(1)}% of total
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${editingImpact?.share ?? 0}%`,
                          background: "var(--gradient-primary)",
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Weight</div>
                        <div className="text-base font-semibold tabular-nums">
                          {Number(editing.risk_weight ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Total after</div>
                        <div className="text-base font-semibold tabular-nums">
                          {editingImpact?.totalAfter.toFixed(1)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Rank</div>
                        <div className="text-base font-semibold tabular-nums">
                          {editingImpact?.rank ? `#${editingImpact.rank}` : "—"}
                        </div>
                      </div>
                    </div>
                    {!editing.risk_direction && Number(editing.risk_weight ?? 0) > 0 && (
                      <div className="flex items-start gap-2 p-2 rounded-md border border-warning/30 bg-warning/5 text-[11px] text-warning">
                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>Pick a direction so this weight actually moves the score.</span>
                      </div>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-border">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={save} className="bg-gradient-primary border-0 shadow-elegant">
                  {editing.id ? "Save changes" : "Add question"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

const SortableRow = ({
  field,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  onToggleRequired,
}: {
  field: Field;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onToggleRequired: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = typeMeta(field.field_type);
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{field.label}</span>
          {field.required && (
            <Badge className="bg-primary/10 text-primary text-[10px] hover:bg-primary/10 px-1.5">
              required
            </Badge>
          )}
          {field.category && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {field.category}
            </Badge>
          )}
          {field.risk_weight && field.risk_weight > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 border-warning text-warning">
              risk × {field.risk_weight}
            </Badge>
          )}
          {!field.active && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              hidden
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {field.description || (
            <span className="font-mono">{field.field_key}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRequired}
          title={field.required ? "Make optional" : "Make required"}
        >
          <span
            className={`text-base font-bold ${
              field.required ? "text-primary" : "text-muted-foreground"
            }`}
          >
            *
          </span>
        </Button>
        <div className="px-1">
          <Switch checked={field.active} onCheckedChange={onToggleActive} />
        </div>
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default HRFormBuilder;