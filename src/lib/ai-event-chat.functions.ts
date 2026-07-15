import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  eventId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
});

export const askEventAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ev, error } = await context.supabase
      .from("events")
      .select("title, description, start_at, end_at, location, service_hours, category, instructions, required_items, capacity")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error || !ev) throw new Error("Event not found");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const sys = `You are a helpful assistant for CoVol volunteers. Answer questions about this event concisely and only using the details provided. If unknown, say you don't know and suggest asking the organizer.\n\nEVENT:\n${JSON.stringify(ev, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: data.question },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI request failed: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { answer: json.choices?.[0]?.message?.content ?? "No response." };
  });
