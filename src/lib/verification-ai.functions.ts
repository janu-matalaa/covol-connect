import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ organizerId: z.string().uuid() });

type Analysis = {
  trust_score: number;
  risk_level: "low" | "medium" | "high";
  recommendation: "approve" | "reject";
  reason: string;
};

export const analyzeOrganizer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Admin-only (RLS on verification_reports also enforces this)
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleRow?.role !== "admin") throw new Error("Admin access required");

    const [{ data: profile }, { data: events }, { data: certs }, { data: thread }] = await Promise.all([
      sb
        .from("profiles")
        .select("full_name, email, organization_name, institution, purpose, faculty_advisor, website, organizer_status, suspended, created_at")
        .eq("id", data.organizerId)
        .maybeSingle(),
      sb
        .from("events")
        .select("id, title, status, start_at, end_at, capacity, service_hours")
        .eq("organizer_id", data.organizerId),
      sb.from("certificates").select("id, certificate_type, revoked").eq("organizer_id", data.organizerId),
      sb.from("admin_chat_threads").select("id").eq("organizer_id", data.organizerId).maybeSingle(),
    ]);

    if (!profile) throw new Error("Organizer not found");

    let chat: { sender_id: string; body: string; attachment_name: string | null; created_at: string }[] = [];
    if (thread?.id) {
      const { data: msgs } = await sb
        .from("admin_chat_messages")
        .select("sender_id, body, attachment_name, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .limit(80);
      chat = msgs ?? [];
    }

    const eventIds = (events ?? []).map((e) => e.id);
    let registrations: { event_id: string; status: string }[] = [];
    if (eventIds.length) {
      const { data: regs } = await sb.from("event_registrations").select("event_id, status").in("event_id", eventIds);
      registrations = regs ?? [];
    }

    const now = Date.now();
    const summary = {
      profile,
      documents_uploaded: chat.filter((m) => m.attachment_name).map((m) => m.attachment_name),
      chat_transcript: chat.map((m) => ({
        from: m.sender_id === data.organizerId ? "organizer" : "admin",
        body: m.body.slice(0, 500),
        at: m.created_at,
      })),
      events_total: (events ?? []).length,
      events_published: (events ?? []).filter((e) => e.status === "published").length,
      events_cancelled: (events ?? []).filter((e) => e.status === "cancelled").length,
      events_completed: (events ?? []).filter((e) => e.status === "published" && new Date(e.end_at).getTime() < now).length,
      registrations_total: registrations.length,
      attendance_verified: registrations.filter((r) => r.status === "attended").length,
      certificates_issued: (certs ?? []).length,
      certificates_revoked: (certs ?? []).filter((c) => c.revoked).length,
    };

    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a verification analyst for CoVol, a student volunteer platform. Assess whether an organizer account looks legitimate and trustworthy, using only the supplied data. You only advise; a human admin makes the final decision. Respond with STRICT JSON only, no markdown, in the shape: {\"trust_score\": number 0-100, \"risk_level\": \"low\"|\"medium\"|\"high\", \"recommendation\": \"approve\"|\"reject\", \"reason\": string (2-4 sentences citing concrete evidence and any missing information)}.",
          },
          { role: "user", content: JSON.stringify(summary) },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (!res.ok) throw new Error(`AI request failed: ${(await res.text()).slice(0, 200)}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    let parsed: Analysis;
    try {
      parsed = JSON.parse(cleaned) as Analysis;
    } catch {
      throw new Error("AI returned an unreadable response. Try again.");
    }

    const risk = ["low", "medium", "high"].includes(parsed.risk_level) ? parsed.risk_level : "medium";
    const rec = parsed.recommendation === "approve" ? "approve" : "reject";
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.trust_score) || 0)));

    const { data: saved, error: insErr } = await sb
      .from("verification_reports")
      .insert({
        organizer_id: data.organizerId,
        created_by: context.userId,
        trust_score: score,
        risk_level: risk,
        recommendation: rec,
        reason: parsed.reason ?? "",
        details: summary as unknown as Record<string, unknown>,
      })
      .select("id, trust_score, risk_level, recommendation, reason, created_at")
      .single();
    if (insErr) throw new Error(insErr.message);

    return saved;
  });
