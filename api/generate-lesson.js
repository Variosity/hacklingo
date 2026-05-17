export const config = {
  runtime: "edge",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req) {
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
    const { moduleId } = await req.json();
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials missing in Vercel.");
    }

    if (!moduleId) {
      throw new Error("Module ID is missing.");
    }

    // 1. STRICT CACHE FETCH: We only read from your manually seeded database.
    const cacheRes = await fetch(
      `${SUPABASE_URL}/rest/v1/lesson_cache?cache_key=eq.${encodeURIComponent(moduleId)}&select=steps`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );

    if (cacheRes.ok) {
      const cacheData = await cacheRes.json();
      if (cacheData && cacheData.length > 0) {
        // Success! Deliver the Gemini-seeded lesson instantly.
        return new Response(JSON.stringify(cacheData[0].steps), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. NOT SEEDED YET: Return a graceful 404 Under Construction message.
    // We do NOT call Groq or Ollama.
    return new Response(
      JSON.stringify({
        error: "This module hasn't been built yet. Check back soon!",
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Endpoint Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
