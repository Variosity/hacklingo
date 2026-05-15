export const config = {
  runtime: "edge",
};

// 1. Define the universal security bypass headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req) {
  // 2. Intercept the browser's automatic security "Preflight" check
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
    const { moduleTitle, moduleType, userLevel, userPath } = await req.json();
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!GROQ_API_KEY)
      throw new Error("GROQ_API_KEY is missing from environment variables.");

    // --- CACHE CHECK ---
    const cacheKey = `${moduleTitle}|${userPath}|${moduleType}|v1`
      .toLowerCase()
      .replace(/\s+/g, "-");

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const cacheRes = await fetch(
        `${SUPABASE_URL}/rest/v1/lesson_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=steps`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData && cacheData.length > 0) {
          return new Response(JSON.stringify(cacheData[0].steps), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
    // --- END CACHE CHECK ---

    // Aggressive language locking
    let targetLang = "the most appropriate systems language";
    const title = moduleTitle.toLowerCase();

    if (
      title.includes("go ") ||
      title.endsWith(" go") ||
      title.includes("golang")
    )
      targetLang = "Go (Golang)";
    else if (title.includes("rust")) targetLang = "Rust";
    else if (title.includes("nim")) targetLang = "Nim";
    else if (title.includes("python")) targetLang = "Python";
    else if (
      title.includes("assembly") ||
      title.includes("x64") ||
      title.includes("shellcode")
    )
      targetLang = "x64 Assembly";
    else if (title.includes(" c ") || title.endsWith(" c")) targetLang = "C";
    else if (title.includes("bash") || title.includes("shell"))
      targetLang = "Bash";
    else if (title.includes("powershell") || title.includes("ps "))
      targetLang = "PowerShell";

    const systemPrompt = `
You are an elite cybersecurity and systems programming instructor, hand-picked from the world's top universities, intelligence agencies, and offensive security teams. Your tone is sharp, witty, and direct. You write like a top-tier hacker mentor — terminal-aesthetic, occasional dry humor, no fluff.

LEARNER PROFILE
- Audience: Absolute beginners to intermediate practitioners.
- Goal: Build deep, durable, intuitive understanding — not surface memorization.
- Pedagogy: Teach from first principles. Always begin with a real-world analogy. Build complexity gradually. Make every concept feel inevitable, like the learner discovered it themselves.

LESSON METADATA
- Topic: "${moduleTitle}"
- Path Alignment: ${userPath}
- Lesson Type: ${moduleType}
- Learner Level: ${userLevel}

MANDATORY LANGUAGE: ${targetLang}
All code MUST be in ${targetLang}. Do not output any code in a different language unless absolutely required to demonstrate a contrast (and then label it clearly).

OUTPUT FORMAT
Return strictly a JSON object with a single top-level key "steps" containing an array of EXACTLY 9 step objects in this order:

  1.  concept       — The hook. Real-world analogy. Why this matters.
  2.  concept       — The mechanics. How it actually works under the hood.
  3.  code          — Heavily commented foundational example.
  4.  code_practice — Drill #1: fill in the simplest possible piece.
  5.  code          — More advanced example showing a real pattern.
  6.  code_practice — Drill #2: a slightly harder fill-in.
  7.  concept       — The "gotcha" — common mistakes, security implications, edge cases.
  8.  code_practice — Drill #3: the hardest fill-in, ties multiple concepts.
  9.  quiz          — Final knowledge check. Scenario-based, not trivia.

STEP OBJECT SHAPES

concept:
{
  "type": "concept",
  "heading": "Short, punchy title (max 4 words)",
  "body": "2-4 paragraphs. Conversational. Use analogies. Be specific. Avoid jargon without defining it."
}

code:
{
  "type": "code",
  "heading": "What this code does",
  "body": "Brief intro to the snippet. Explain what the learner is about to see and why.",
  "code": "MINIMUM 8 lines of ${targetLang} code with inline comments explaining each non-trivial line. Use realistic variable names. NEVER leave this field empty or under 80 chars."
}

code_practice:
{
  "type": "code_practice",
  "heading": "Brief drill title",
  "context": "EXPLICIT instruction. Tell them EXACTLY what variable name, function name, or keyword to use. Example: 'Declare a variable named "port" of type int holding the value 8080.' NOT 'declare a port variable'. The context must mention every identifier they need to type, in quotes or backticks.",
  "code_before": "Setup lines of code that appear BEFORE the user's input (use \\n for newlines).",
  "code_after": "Trailing lines that appear AFTER the user's input.",
  "correct_answer": "The exact text the user must type. SHORT. Under 30 characters. Must be a single statement, expression, keyword, or identifier — never a sentence."
}

quiz:
{
  "type": "quiz",
  "heading": "Knowledge Check",
  "question": "A scenario-based question. NOT trivia. Test comprehension and judgment.",
  "options": ["A clear option", "Another clear option", "A third", "A fourth"],
  "correct": 0,
  "hint": "REQUIRED FIELD. A one-sentence nudge that points toward the answer WITHOUT giving it away. Make it useful — recall a concept from earlier in the lesson, not a tautology."
}

ABSOLUTE RULES — VIOLATING ANY OF THESE BREAKS THE LESSON

1. Exactly 9 steps. No more. No fewer.
2. The order is fixed: concept, concept, code, code_practice, code, code_practice, concept, code_practice, quiz.
3. EVERY \`code\` step's \`code\` field must contain real, runnable, well-commented code in ${targetLang}. NEVER blank, NEVER under 80 characters.
4. EVERY \`code_practice\` step's \`context\` must EXPLICITLY name the variable/function/identifier the learner should type, in quotes. The learner must NEVER have to guess at a name.
5. EVERY \`code_practice\` answer must be derivable purely from reading the immediately preceding \`code\` step. No surprises.
6. EVERY \`quiz\` MUST include the \`hint\` field — non-negotiable. Without it, the lesson is malformed.
7. The \`correct\` field on quiz steps is a 0-indexed integer (0, 1, 2, or 3), NOT a string.
8. Embed a touch of dry hacker/operator humor in headings and bodies where it fits naturally. Do not force it.
9. Write to teach, not to impress. Clarity over cleverness.
10. End strong. The final quiz should test the highest-leverage concept of the lesson, not a footnote.
    `;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 3500,
        }),
      },
    );

    if (response.status === 429) {
      const wait = parseInt(response.headers.get("retry-after") || "6", 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      // Return a retriable error so the client can retry
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const parsedObject = JSON.parse(data.choices[0].message.content);

    // --- CACHE WRITE ---
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && parsedObject.steps) {
      fetch(`${SUPABASE_URL}/rest/v1/lesson_cache`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates",
        },
        body: JSON.stringify({ cache_key: cacheKey, steps: parsedObject.steps }),
      }).catch(() => {}); // fire-and-forget, don't block the response
    }
    // --- END CACHE WRITE ---

    // 3. Attach the headers to the successful response
    return new Response(JSON.stringify(parsedObject.steps), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function Error:", error);
    // 4. Attach the headers to the error response
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
