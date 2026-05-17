#!/usr/bin/env node
// seed-lessons.mjs
//
// Hacklingo lesson seeder.
//
// Usage:
//   node seed-lessons.mjs lessons/batch-01.json
//   node seed-lessons.mjs lessons/*.json
//   node seed-lessons.mjs --validate-only lessons/batch-01.json
//   node seed-lessons.mjs --status
//
// Each input file is a JSON object keyed by module ID:
//   { "m2-2": { "steps": [...] }, "m2-3": { "steps": [...] } }
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Set them and retry.",
  );
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const REQUIRED_ORDER = [
  "concept",
  "concept",
  "code",
  "code_practice",
  "code",
  "code_practice",
  "concept",
  "code_practice",
  "quiz",
];

function validateLesson(id, lesson) {
  const errors = [];
  if (!lesson || !Array.isArray(lesson.steps)) {
    errors.push("missing or non-array `steps`");
    return errors;
  }
  if (lesson.steps.length !== 9) {
    errors.push(`expected 9 steps, got ${lesson.steps.length}`);
  }
  lesson.steps.forEach((step, i) => {
    if (!step || typeof step !== "object") {
      errors.push(`step ${i + 1}: not an object`);
      return;
    }
    const expected = REQUIRED_ORDER[i];
    if (expected && step.type !== expected) {
      errors.push(`step ${i + 1}: expected type "${expected}", got "${step.type}"`);
    }
    if (!step.heading || typeof step.heading !== "string") {
      errors.push(`step ${i + 1}: missing heading`);
    }
    if (step.type === "concept") {
      if (!step.body || step.body.length < 30) {
        errors.push(`step ${i + 1} (concept): body too short`);
      }
    } else if (step.type === "code") {
      if (!step.body) errors.push(`step ${i + 1} (code): missing body`);
      if (!step.code || step.code.length < 80) {
        errors.push(`step ${i + 1} (code): code block missing or under 80 chars`);
      }
    } else if (step.type === "code_practice") {
      if (!step.context || step.context.length < 20) {
        errors.push(`step ${i + 1} (code_practice): context too short`);
      }
      if (typeof step.correct_answer !== "string" || step.correct_answer.length === 0) {
        errors.push(`step ${i + 1} (code_practice): missing correct_answer`);
      }
      if (step.correct_answer && step.correct_answer.length > 100) {
        errors.push(
          `step ${i + 1} (code_practice): correct_answer too long (${step.correct_answer.length} chars) — should be a snippet, not prose`,
        );
      }
    } else if (step.type === "quiz") {
      if (!step.question) errors.push(`step ${i + 1} (quiz): missing question`);
      if (!Array.isArray(step.options) || step.options.length < 2) {
        errors.push(`step ${i + 1} (quiz): needs at least 2 options`);
      }
      if (typeof step.correct !== "number") {
        errors.push(`step ${i + 1} (quiz): correct must be a number (0-indexed)`);
      }
      if (!step.hint || step.hint.length < 10) {
        errors.push(`step ${i + 1} (quiz): missing or too-short hint`);
      }
    }
  });
  return errors;
}

async function showStatus() {
  // List every module and whether it has a cache entry
  const { data: modules, error: modErr } = await supa
    .from("modules")
    .select("id, title")
    .order("id");
  if (modErr) {
    console.error("Failed to list modules:", modErr.message);
    process.exit(1);
  }
  const { data: cached, error: cacheErr } = await supa
    .from("lesson_cache")
    .select("cache_key");
  if (cacheErr) {
    console.error("Failed to list lesson_cache:", cacheErr.message);
    process.exit(1);
  }
  const cachedIds = new Set((cached || []).map((r) => r.cache_key));

  let okCount = 0;
  let missingCount = 0;
  console.log("\n=== HACKLINGO LESSON CACHE STATUS ===\n");
  for (const m of modules) {
    if (cachedIds.has(m.id)) {
      console.log(`  ✓  ${m.id.padEnd(22)} ${m.title}`);
      okCount += 1;
    } else {
      console.log(`  ✗  ${m.id.padEnd(22)} ${m.title}`);
      missingCount += 1;
    }
  }
  const total = okCount + missingCount;
  const pct = total > 0 ? Math.round((okCount / total) * 100) : 0;
  console.log(`\n  ${okCount} / ${total} seeded (${pct}%) — ${missingCount} remaining\n`);
}

/**
 * Auto-repair Gemini's common JSON escaping mistakes:
 * 1. \' → '  (single quotes need no escaping in JSON)
 * 2. \xNN → \\xNN  (hex sequences are invalid JSON escapes)
 * 3. Unescaped " inside string values (Python code like int("0x90", 16))
 */
function repairGeminiJson(raw) {
  let s = raw.replace(/(?<!\\)\\'/g, "'");
  s = s.replace(/(?<!\\)\\x([0-9a-fA-F]{2})/g, "\\\\x$1");
  const lines = s.split("\n");
  const fixed = lines.map((line) => {
    const m = line.match(/^(\s*"(?:[^"\\]|\\.)*"\s*:\s*)"(.*)"(,?)$/);
    if (!m) return line;
    const [, prefix, inner, comma] = m;
    let fixedInner = "";
    let i = 0;
    while (i < inner.length) {
      const c = inner[i];
      if (c === "\\" && i + 1 < inner.length) {
        fixedInner += c + inner[i + 1];
        i += 2;
      } else if (c === '"') {
        fixedInner += '\\"';
        i++;
      } else {
        fixedInner += c;
        i++;
      }
    }
    return `${prefix}"${fixedInner}"${comma}`;
  });
  return fixed.join("\n");
}

async function processFile(path, { validateOnly }) {
  const raw = await readFile(path, "utf8");
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (firstErr) {
    try {
      const repaired = repairGeminiJson(raw);
      payload = JSON.parse(repaired);
      console.log(`  ⚠ ${path}: auto-repaired JSON (Gemini escaping issues fixed)`);
    } catch (e) {
      console.error(`✗ ${path}: invalid JSON — ${firstErr.message}`);
      return { ok: 0, fail: 1 };
    }
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
    console.error(`✗ ${path}: expected an object keyed by module ID`);
    return { ok: 0, fail: 1 };
  }

  let ok = 0;
  let fail = 0;
  const upserts = [];

  for (const [id, lesson] of Object.entries(payload)) {
    const errors = validateLesson(id, lesson);
    if (errors.length > 0) {
      console.error(`\n✗ ${id} in ${path}:`);
      errors.forEach((e) => console.error(`    - ${e}`));
      fail += 1;
      continue;
    }
    ok += 1;
    upserts.push({ cache_key: id, steps: lesson.steps, version: 1 });
  }

  if (validateOnly) {
    console.log(`\n  ${path}: ${ok} valid, ${fail} invalid (validate-only, not seeded)`);
    return { ok, fail };
  }

  if (upserts.length > 0) {
    const { error } = await supa
      .from("lesson_cache")
      .upsert(upserts, { onConflict: "cache_key" });
    if (error) {
      console.error(`✗ ${path}: upsert failed — ${error.message}`);
      return { ok: 0, fail: upserts.length };
    }
  }
  console.log(`  ✓ ${path}: seeded ${ok}, skipped ${fail}`);
  return { ok, fail };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      "Usage:\n" +
        "  node seed-lessons.mjs lessons/batch-01.json\n" +
        "  node seed-lessons.mjs --validate-only lessons/*.json\n" +
        "  node seed-lessons.mjs --status",
    );
    process.exit(0);
  }
  if (args.includes("--status")) {
    await showStatus();
    return;
  }
  const validateOnly = args.includes("--validate-only");
  const files = args.filter((a) => !a.startsWith("--"));

  let okTotal = 0;
  let failTotal = 0;
  for (const file of files) {
    const { ok, fail } = await processFile(file, { validateOnly });
    okTotal += ok;
    failTotal += fail;
  }
  console.log(`\nDONE — ${okTotal} ok, ${failTotal} failed across ${files.length} file(s)`);
  if (failTotal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
