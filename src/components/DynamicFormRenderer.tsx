import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Star } from "lucide-react";

export type FormField = {
  id: string;
  field_key: string;
  label: string;
  description: string | null;
  field_type: string;
  options: any;
  required: boolean;
  position: number;
  category: string | null;
  active: boolean;
};

export const DynamicFormRenderer = ({
  fields,
  values,
  onChange,
}: {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (key: string, val: any) => void;
}) => {
  const grouped = fields.reduce<Record<string, FormField[]>>((acc, f) => {
    const cat = f.category || "General";
    (acc[cat] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-primary" />
            <h3 className="text-lg font-semibold tracking-tight">{cat}</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {items.map((f) => (
              <FieldRenderer key={f.id} field={f} value={values[f.field_key]} onChange={(v) => onChange(f.field_key, v)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const FieldRenderer = ({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
}) => {
  const wrap = (children: React.ReactNode, full = false) => (
    <div className={`space-y-2 ${full || field.field_type === "textarea" ? "sm:col-span-2" : ""}`}>
      <Label className="font-medium">
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
      {children}
    </div>
  );

  switch (field.field_type) {
    case "text":
      return wrap(<Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />);
    case "email":
      return wrap(<Input type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />);
    case "date":
      return wrap(<Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />);
    case "textarea":
      return wrap(<Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} required={field.required} />, true);
    case "number":
      return wrap(<Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} required={field.required} />);
    case "yesno":
      return wrap(
        <div className="flex gap-2">
          {["yes", "no"].map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => onChange(opt)}
              className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                value === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case "rating": {
      const max = Number(field.options?.max ?? 5);
      return wrap(
        <div className="flex gap-1.5">
          {Array.from({ length: max }).map((_, i) => {
            const n = i + 1;
            const active = Number(value) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-lg border-2 grid place-items-center transition-all ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Star className={`h-4 w-4 ${active ? "fill-primary" : ""}`} />
              </button>
            );
          })}
        </div>
      );
    }
    case "dropdown":
    case "select": {
      const opts: string[] = Array.isArray(field.options) ? field.options : [];
      return wrap(
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multiselect": {
      const opts: string[] = Array.isArray(field.options) ? field.options : [];
      const arr: string[] = Array.isArray(value) ? value : [];
      const toggle = (o: string) =>
        arr.includes(o) ? onChange(arr.filter((x) => x !== o)) : onChange([...arr, o]);
      return wrap(
        <div className="grid grid-cols-2 gap-2">
          {opts.map((o) => (
            <label
              key={o}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all ${
                arr.includes(o) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <Checkbox checked={arr.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
          {opts.length === 0 && <p className="text-xs text-muted-foreground">No options configured.</p>}
        </div>,
        true
      );
    }
    default:
      return wrap(<Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />);
  }
};