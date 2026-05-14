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

    if (!GROQ_API_KEY)
      throw new Error("GROQ_API_KEY is missing from environment variables.");

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
      You are an elite cybersecurity and systems programming instructor.
      Target Audience: Absolute Beginners to Intermediate.
      Pedagogy: You MUST teach from the ground up. Start with an ELI5 (Explain Like I'm 5) analogy, then progressively introduce the technical syntax. Do not assume prior knowledge.

      Generate a comprehensive, hands-on lesson for:
      Topic: "${moduleTitle}"
      Path Alignment: ${userPath}
      Type: ${moduleType}
      MANDATORY LANGUAGE: ${targetLang}. ALL code examples MUST be in ${targetLang}. DO NOT use Python unless explicitly instructed.

      You MUST output strictly as a JSON object containing a single key "steps" holding an array of 8 to 12 objects.

      SCHEMA:
      {
        "steps": [
          {
            "type": "concept",
            "heading": "The Core Idea",
            "body": "String (Start with a simple, real-world analogy. Explain WHY this concept exists before explaining HOW it works.)"
          },
          {
            "type": "code",
            "heading": "Syntax Breakdown",
            "body": "String (Explain every single keyword and symbol used in the upcoming code block.)",
            "code": "String (A heavily commented, foundational code snippet in ${targetLang})"
          },
          {
            "type": "code_practice",
            "heading": "Interactive Drill",
            "context": "String (Give them a specific scenario. E.g., 'Declare a variable that holds the port number 8080'.)",
            "code_before": "String (Setup code)",
            "code_after": "String (Trailing code)",
            "correct_answer": "String (The exact exact snippet they must type. Keep it under 30 characters.)"
          },
          {
            "type": "quiz",
            "heading": "Knowledge Check",
            "question": "String (Scenario-based question testing comprehension, not just memorization)",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
            "hint": "A one-sentence nudge that points toward the answer without revealing it."
          }
        ]
      }

      RULES:
      1. Build complexity slowly. Start simple, end with an advanced concept.
      2. Include at least THREE "code_practice" steps to build deep muscle memory.
      3. CRITICAL CODE PRACTICE RULE: The "correct_answer" MUST be a standard programming keyword, operator, or explicitly defined variable. Do NOT make the user guess arbitrary filenames, strings, or random flags. The context must make the exact answer 100% obvious to someone who just read the previous slide.
      4. The FINAL step MUST be exactly one "quiz" object to complete the mission. No more, no less.
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
          temperature: 0.1,
        }),
      },
    );

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const parsedObject = JSON.parse(data.choices[0].message.content);

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
