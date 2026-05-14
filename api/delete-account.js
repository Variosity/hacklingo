import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

// Universal CORS Bypass Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req) {
  // Intercept the browser's automatic security "Preflight" check
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // We need the SERVICE_ROLE_KEY to bypass RLS and delete auth users
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Verify the user is actually the one requesting the deletion
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authErr || !user) throw new Error("Unauthorized");

    // Purge the user from the Auth system (this cascades and deletes their profile data if your SQL foreign keys are set up correctly)
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(
      user.id,
    );
    if (deleteErr) throw deleteErr;

    // Attach headers to successful response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Attach headers to error response
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
