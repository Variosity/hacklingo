// /api/delete-account.js
// Vercel edge function that fully purges a user account.
//
// Required env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL                   = https://ueurqszqmoramxgrgicv.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY      = (Supabase dashboard → Settings → API → service_role key)
//
// Flow:
//   1. Verify the caller's JWT from the Authorization header
//   2. Extract their user ID
//   3. Delete dependent rows (squad_members, squad_messages) so foreign keys don't block
//   4. Delete the profile row
//   5. Delete the auth.users entry (this is what actually makes them unable to log back in)

export const config = {
  runtime: "edge",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { error: "Server misconfigured: missing Supabase env vars" });
  }

  // 1. Extract and verify JWT
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { error: "Missing Authorization header" });
  }

  // Verify the token by calling Supabase's /auth/v1/user endpoint
  // This both validates the JWT and gives us the authenticated user's ID
  let userId;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) {
      return json(401, { error: "Invalid or expired session token" });
    }
    const userData = await userRes.json();
    userId = userData.id;
    if (!userId) {
      return json(401, { error: "Could not resolve user from token" });
    }
  } catch (e) {
    return json(401, { error: "Token verification failed: " + e.message });
  }

  // Helper to delete with the service role (bypasses RLS)
  const adminDelete = async (path) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
    });
    return res.ok || res.status === 404; // 404 just means nothing to delete
  };

  const errors = [];

  // 2. Squad messages they posted (must go before squad_members in case of FK constraint)
  if (!(await adminDelete(`squad_messages?sender_id=eq.${userId}`))) {
    errors.push("squad_messages");
  }

  // 3. Squad memberships
  if (!(await adminDelete(`squad_members?user_id=eq.${userId}`))) {
    errors.push("squad_members");
  }

  // 4. Profile row
  if (!(await adminDelete(`profiles?id=eq.${userId}`))) {
    errors.push("profiles");
  }

  // 5. The auth.users entry — this is what actually kills the account.
  // Uses Supabase's admin API which only works with the service role key.
  try {
    const authDelRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      {
        method: "DELETE",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (!authDelRes.ok && authDelRes.status !== 404) {
      const bodyText = await authDelRes.text();
      errors.push(`auth.users (${authDelRes.status}): ${bodyText.slice(0, 200)}`);
    }
  } catch (e) {
    errors.push("auth.users threw: " + e.message);
  }

  if (errors.length > 0) {
    // Partial failure — return 207 so the client can see which tables didn't clear.
    // The auth.users deletion is the most important one; if that succeeded, the
    // account is effectively dead even if some game tables had leftovers.
    return json(207, {
      ok: false,
      message: "Account partially deleted",
      failed: errors,
    });
  }

  return json(200, { ok: true, message: "Account fully purged" });
}
