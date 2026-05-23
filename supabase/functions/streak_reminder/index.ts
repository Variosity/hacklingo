import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find profiles where last_active_date was YESTERDAY (streak at risk)
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");

  const { data: atRisk } = await supabase
    .from("profiles")
    .select("id, username, email, persistence_streak, email_unsubscribe_token")
    .eq("last_active_date", yesterday)
    .eq("email_streak_reminders", true)
    .gt("persistence_streak", 0);

  if (!atRisk?.length) return new Response("No one at risk", { status: 200 });

  const results = await Promise.allSettled(
    atRisk.map((user) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Hacklingo <ops@hacklingo.com>",
          to: user.email,
          subject: `⚠️ Your ${user.persistence_streak}-day streak is about to break`,
          html: `
            <div style="font-family:monospace;background:#000;color:#fff;padding:32px;max-width:500px;margin:auto">
              <h1 style="color:#00ff88;font-size:24px;margin:0 0 16px">⚠️ UPLINK SEVERING</h1>
              <p>Operator <strong style="color:#00ff88">${user.username}</strong>,</p>
              <p>Your <strong style="color:#facc15">${user.persistence_streak}-day streak</strong> dies in a few hours.</p>
              <p>One mission. 5 minutes. That's all it takes.</p>
              <a href="https://hacklingo.com" style="display:inline-block;background:#00ff88;color:#000;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:6px;margin:16px 0">RESUME OPERATION →</a>
              <p style="color:#666;font-size:11px;margin-top:32px">
                Tired of these? <a href="https://hacklingo.com/unsubscribe?token=${user.email_unsubscribe_token}" style="color:#666">Unsubscribe</a>
              </p>
            </div>
          `,
        }),
      }),
    ),
  );

  return new Response(
    JSON.stringify({
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    }),
  );
});
