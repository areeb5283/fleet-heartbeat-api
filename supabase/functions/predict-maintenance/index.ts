import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vehicleInfo, telematicsData, currentMaintenance } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert vehicle maintenance AI. Analyze the vehicle data and maintenance records to provide predictive maintenance recommendations. Return a JSON array of maintenance items. Each item must have:
- category: one of "fluids", "engine", "transmission", "brakes", "tires", "electrical", "cooling", "body", "suspension"
- part_name: specific part or system name
- condition: one of "good", "fair", "warning", "critical"
- predicted_failure_date: ISO date string or null
- next_service_due: ISO date string or null
- ai_recommendation: actionable recommendation text (1-2 sentences)

Base predictions on the telematics patterns (high RPM = engine stress, high temp = cooling issues, low fuel efficiency = fuel system, etc.) and current maintenance history. Be realistic and specific.`;

    const userPrompt = `Vehicle: ${vehicleInfo.manufacturer} ${vehicleInfo.model} (${vehicleInfo.year}), Fuel: ${vehicleInfo.fuel_type}

Recent Telematics (last readings):
${JSON.stringify(telematicsData?.slice(0, 10) || [], null, 2)}

Current Maintenance Records:
${JSON.stringify(currentMaintenance || [], null, 2)}

Analyze and provide predictive maintenance for ALL categories. Return ONLY a JSON array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "maintenance_predictions",
            description: "Return predictive maintenance analysis",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["fluids", "engine", "transmission", "brakes", "tires", "electrical", "cooling", "body", "suspension"] },
                      part_name: { type: "string" },
                      condition: { type: "string", enum: ["good", "fair", "warning", "critical"] },
                      predicted_failure_date: { type: "string" },
                      next_service_due: { type: "string" },
                      ai_recommendation: { type: "string" },
                    },
                    required: ["category", "part_name", "condition", "ai_recommendation"],
                  },
                },
              },
              required: ["predictions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "maintenance_predictions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    let predictions = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        predictions = parsed.predictions || [];
      } catch {
        predictions = [];
      }
    }

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-maintenance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
