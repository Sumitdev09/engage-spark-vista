import { useEffect, useState } from "react";
import { AppLayout, NavItem } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

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

const TYPES = [
  { v: "text", l: "Short text" },
  { v: "textarea", l: "Long text" },
  { v: "number", l: "Number" },
  { v: "rating", l: "Rating (1-5)" },
  { v: "yesno", l: "Yes / No" },
  { v: "dropdown", l: "Dropdown" },
];

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

const HRFormBuilder = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [editing, setEditing] = useState<Field | null>(null);
  const [optionsText, setOptionsText] = useState("");

  const load = async () => {
    const { data } = await supabase.from("form_fields").select("*").order("position");
    setFields((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing({ ...empty, position: (fields[fields.length - 1]?.position ?? 0) + 1 });
    setOptionsText("");
  };

  const openEdit = (f: Field) => {
    setEditing({ ...f });
    setOptionsText(Array.isArray(f.options) ? f.options.join("\n") : f.field_type === "rating" && f.options?.max ? String(f.options.max) : "");
  };

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (editing.field_type === "dropdown" || editing.field_type === "select") {
      payload.options = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (editing.field_type === "rating") {
      payload.options = { max: Number(optionsText) || 5 };
    } else {
      payload.options = null;
    }
    if (!payload.field_key) payload.field_key = payload.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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

  const move = async (idx: number, dir: -1 | 1) => {
    const a = fields[idx], b = fields[idx + dir];
    if (!a || !b) return;
    await supabase.from("form_fields").update({ position: b.position }).eq("id", a.id!);
    await supabase.from("form_fields").update({ position: a.position }).eq("id", b.id!);
    load();
  };

  const toggleActive = async (f: Field) => {
    await supabase.from("form_fields").update({ active: !f.active }).eq("id", f.id!);
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
            <p className="text-muted-foreground">Customize the survey employees fill out. Changes are live instantly.</p>
          </div>
          <Button onClick={openNew} className="bg-gradient-primary border-0 shadow-elegant">
            <Plus className="h-4 w-4 mr-1" /> Add field
          </Button>
        </div>

        <Card className="shadow-soft">
          <div className="divide-y divide-border">
            {fields.map((f, idx) => (
              <div key={f.id} className="p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                <div className="flex flex-col gap-1">
                  <button onClick={() => move(idx, -1)} className="text-muted-foreground hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => move(idx, 1)} className="text-muted-foreground hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.label}</span>
                    <Badge variant="outline" className="text-xs">{f.field_type}</Badge>
                    {f.required && <Badge className="bg-primary/10 text-primary text-xs hover:bg-primary/10">required</Badge>}
                    {f.category && <span className="text-xs text-muted-foreground">· {f.category}</span>}
                    {!f.active && <Badge variant="secondary" className="text-xs">inactive</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{f.description || f.field_key}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={f.active} onCheckedChange={() => toggleActive(f)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del(f.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {fields.length === 0 && <div className="p-8 text-center text-muted-foreground">No fields yet.</div>}
          </div>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.id ? "Edit field" : "New field"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={editing.field_type} onValueChange={(v) => setEditing({ ...editing, field_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                  </div>
                </div>
                {(editing.field_type === "dropdown" || editing.field_type === "select") && (
                  <div className="space-y-2">
                    <Label>Options (one per line)</Label>
                    <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"Option A\nOption B"} />
                  </div>
                )}
                {editing.field_type === "rating" && (
                  <div className="space-y-2">
                    <Label>Max rating</Label>
                    <Input type="number" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="5" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>Required field</Label>
                  <Switch checked={editing.required} onCheckedChange={(v) => setEditing({ ...editing, required: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-xs">Risk weight (0 = ignore)</Label>
                    <Input type="number" step="0.5" value={editing.risk_weight ?? ""} onChange={(e) => setEditing({ ...editing, risk_weight: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Risk direction</Label>
                    <Select value={editing.risk_direction ?? "none"} onValueChange={(v) => setEditing({ ...editing, risk_direction: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— none —</SelectItem>
                        <SelectItem value="higher_risk_low">Lower value = higher risk</SelectItem>
                        <SelectItem value="higher_risk_high">Higher value = higher risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={save} className="bg-gradient-primary border-0">Save</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default HRFormBuilder;