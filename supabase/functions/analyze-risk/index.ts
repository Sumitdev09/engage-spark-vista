import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Field = {
  field_key: string;
  label: string;
  field_type: string;
  options: any;
  risk_weight: number | null;
  risk_direction: string | null;
};

function computeRuleScore(fields: Field[], responses: Record<string, any>) {
  let score = 0;
  let maxScore = 0;
  const factors: Array<{ key: string; label: string; impact: number; value: any }> = [];

  for (const f of fields) {
    const w = Number(f.risk_weight ?? 0);
    if (!w) continue;
    const v = responses[f.field_key];
    if (v === undefined || v === null || v === "") continue;

    let impact = 0;
    let max = w * 5;

    if (f.field_type === "rating") {
      const num = Number(v);
      const ratingMax = Number(f.options?.max ?? 5);
      if (!isNaN(num)) {
        const normalized = num / ratingMax; // 0..1
        const risk = f.risk_direction === "higher_risk_low" ? 1 - normalized : normalized;
        impact = w * risk * 5;
      }
    } else if (f.field_type === "yesno") {
      const yes = v === true || v === "yes" || v === "true";
      // overtime / considering_leaving = yes is high risk
      impact = yes ? w * 5 : 0;
    } else if (f.field_type === "number") {
      const num = Number(v);
      if (!isNaN(num)) {
        // tenure: <2 yrs high risk; cap at 10
        const norm = Math.min(num, 10) / 10;
        const risk = f.risk_direction === "higher_risk_low" ? 1 - norm : norm;
        impact = w * risk * 5;
      }
    }

    score += impact;
    maxScore += max;
    if (impact > 0) factors.push({ key: f.field_key, label: f.label, impact: Number(impact.toFixed(2)), value: v });
  }

  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  let level: "low" | "medium" | "high" = "low";
  if (pct >= 60) level = "high";
  else if (pct >= 35) level = "medium";

  factors.sort((a, b) => b.impact - a.impact);
  return { score: Number(pct.toFixed(1)), level, factors: factors.slice(0, 5) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: sub } = await supabase.from("submissions").select("responses").eq("user_id", userId).maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: "No submission found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fields } = await supabase
      .from("form_fields")
      .select("field_key,label,field_type,options,risk_weight,risk_direction")
      .eq("active", true);

    const { score, level, factors } = computeRuleScore((fields || []) as Field[], sub.responses || {});

    let insights = `Risk score ${score}/100 (${level}). Top contributing factors: ${factors.map((f) => f.label).join(", ") || "none"}.`;
    let recommendations = "Continue regular check-ins and engagement surveys.";
    let aiGenerated = false;

    // Optional AI insights if key available and risk meaningful
    if (LOVABLE_API_KEY && (level === "medium" || level === "high")) {
      try {
        const summary = (fields || [])
          .map((f: any) => `${f.label}: ${JSON.stringify((sub.responses as any)[f.field_key] ?? "—")}`)
          .join("\n");

        const prompt = `You are an HR analytics assistant. Given an employee survey, write:
1) A 2-sentence INSIGHT about likely attrition drivers.
2) Two short, actionable RECOMMENDATIONS for HR (one line each).

Survey:
${summary}

Computed risk: ${score}/100 (${level})
Top factors: ${factors.map((f) => f.label).join(", ")}

Return strict JSON: {"insights":"...","recommendations":"- rec 1\\n- rec 2"}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a concise HR analytics assistant. Always reply with valid JSON only." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiRes.ok) {
          const j = await aiRes.json();
          const txt: string = j.choices?.[0]?.message?.content ?? "";
          const cleaned = txt.replace(/```json|```/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (parsed.insights) insights = parsed.insights;
            if (parsed.recommendations) recommendations = parsed.recommendations;
            aiGenerated = true;
          } catch (_) {
            insights = cleaned.slice(0, 400) || insights;
          }
        } else if (aiRes.status === 429) {
          recommendations = "AI rate limit reached — using rule-based insights.";
        } else if (aiRes.status === 402) {
          recommendations = "AI credits exhausted — using rule-based insights.";
        }
      } catch (e) {
        console.error("AI error", e);
      }
    }

    // Upsert risk assessment
    const { error: upErr } = await supabase
      .from("risk_assessments")
      .upsert(
        {
          user_id: userId,
          risk_score: score,
          risk_level: level,
          insights,
          recommendations,
          ai_generated: aiGenerated,
        },
        { onConflict: "user_id" }
      );
    if (upErr) console.error("Upsert err", upErr);

    return new Response(
      JSON.stringify({ score, level, factors, insights, recommendations, ai_generated: aiGenerated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});