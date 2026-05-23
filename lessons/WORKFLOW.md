# HACKLINGO LESSON SEEDING — The Final Workflow

You're going to write every single lesson by hand (with Gemini Pro 3 as your co-writer), validate it, and seed it into `lesson_cache`. After this is done, the AI endpoint becomes a relic — the rate limit problem is solved forever and your lessons are objectively better than any model could produce in real-time.

## ONE-TIME ARCHITECTURE CHANGES (DONE)

1. ✅ Client now reads `lesson_cache` directly via Supabase BEFORE calling `/api/generate-lesson`. Cache key = module ID. (Applied in the new `App.jsx`.)
2. ✅ `lesson_cache` table already exists in your Supabase.
3. The `/api/generate-lesson` endpoint stays as a fallback for new modules you haven't seeded yet — or you can later delete it entirely once 100% seeded.

## YOUR WORKFLOW IN 4 PHASES

### PHASE 1: Set up Gemini Pro 3

Open a fresh Gemini Pro chat. Paste `GEMINI_PROMPT.md` (the master prompt) as your first message. Gemini will reply `READY`. Now Gemini knows the exact 9-step schema, tone, language rules, output format. Don't change the chat — keep using the same conversation for all batches in one session so the context sticks.

If the chat gets long and starts forgetting the format, open a new chat and re-paste the prompt. Costs nothing.

### PHASE 2: Generate lessons in batches of 5–10

Paste a batch like this:

```json
[
  { "id": "m0-1", "title": "Numeric Systems (Binary, Hex, Decimal)", "type": "lesson" },
  { "id": "m0-2", "title": "Compiled vs Interpreted Languages", "type": "lesson" },
  { "id": "m0-3", "title": "Processes, Handles, and Threads", "type": "lesson" },
  { "id": "m0-4", "title": "Bash & PowerShell Scripting", "type": "lab" },
  { "id": "m0-5", "title": "Endianness & Byte Order", "type": "lesson" }
]
```

Gemini outputs:

```json
{
  "m0-1": { "steps": [/* 9 steps */] },
  "m0-2": { "steps": [/* 9 steps */] },
  ...
}
```

Save that output to a file: `lessons/batch-01.json`. Repeat for next batch. Don't worry if Gemini sometimes drifts — you'll catch it in validation.

**Why batches of 5-10:** Bigger batches risk truncation at Gemini's output limit, plus harder to spot issues. Smaller is more reliable.

### PHASE 3: Validate

Run the seeder script (`seed-lessons.mjs` in this folder) with `--validate-only`:

```bash
cd /path/to/hacklingo
node seed-lessons.mjs --validate-only lessons/batch-01.json
```

It checks every lesson: 9 steps, correct order, all required fields, no empty code, hints present. If any lesson fails, fix it manually or ask Gemini to regenerate that specific one.

### PHASE 4: Seed into Supabase

Once validated, fire the actual seed:

```bash
node seed-lessons.mjs lessons/batch-01.json
```

It does an UPSERT on `lesson_cache` — safe to re-run. Existing entries get overwritten cleanly. The next time anyone opens that module in the app, they get your hand-curated lesson with zero AI latency.

You can also seed multiple files at once:
```bash
node seed-lessons.mjs lessons/*.json
```

## THE MODULES YOU NEED TO SEED

Here's your full module roster as a ready-to-paste-into-Gemini JSON array. Break it into batches of 5-10 as you go.

```json
[
  { "id": "m0-1", "title": "Numeric Systems (Binary, Hex, Decimal)", "type": "lesson" },
  { "id": "m0-2", "title": "Compiled vs Interpreted Languages", "type": "lesson" },
  { "id": "m0-3", "title": "Processes, Handles, and Threads", "type": "lesson" },
  { "id": "m0-4", "title": "Bash & PowerShell Scripting", "type": "lab" },
  { "id": "m1-1", "title": "Memory Mechanics: Stack vs Heap", "type": "lesson" },
  { "id": "m1-2", "title": "High-Level to Machine Code Translation", "type": "lesson" },
  { "id": "m1-3", "title": "Assembly Thinking (x64 Basics)", "type": "challenge" },
  { "id": "m1-4", "title": "Build: Buffer Overflow Simulator in C", "type": "boss" },
  { "id": "m2-1", "title": "Go Core Control & Syntax", "type": "lesson" },
  { "id": "m2-2", "title": "TCP Server & Client in Go", "type": "lab" },
  { "id": "m2-3", "title": "Go Concurrent Port Scanner", "type": "project" },
  { "id": "m2-4", "title": "Build: Go Discord C2 Server", "type": "boss" },
  { "id": "m3-1", "title": "IPv4, IPv6, and DNS Under the Hood", "type": "lesson" },
  { "id": "m3-2", "title": "Tor, VPNs, and OPSEC Anonymity", "type": "lesson" },
  { "id": "m3-3", "title": "Cryptology 101: Ciphers & Algorithms", "type": "lesson" },
  { "id": "m3-4", "title": "Applied Crypto: AES-256 GCM Encryption", "type": "lab" },
  { "id": "m3-5", "title": "Remote Exfiltration via Protocols", "type": "project" },
  { "id": "m4-1", "title": "Rust Ownership & Borrowing", "type": "lesson" },
  { "id": "m4-2", "title": "Windows API & Shellcode Embedding", "type": "lab" },
  { "id": "m4-3", "title": "Process & DLL Injection Tactics", "type": "challenge" },
  { "id": "m4-4", "title": "Build: EDR-Evasive Native Trojan", "type": "boss" },
  { "id": "m5-1", "title": "Nim for Shellcode Execution", "type": "lesson" },
  { "id": "m5-2", "title": "Python Weaponization & Tooling", "type": "lesson" },
  { "id": "m5-3", "title": "Advanced Obfuscation & Evasion", "type": "project" },
  { "id": "m8-1", "title": "C & Linux Kernel Modules", "type": "lesson" },
  { "id": "m8-2", "title": "Compiler Theory & Obfuscation", "type": "lesson" },
  { "id": "m8-3", "title": "Build: Custom Hypervisor Engine", "type": "boss" },
  { "id": "mod_bgo_1", "title": "High-Speed Log Ingestion in Go", "type": "standard" },
  { "id": "mod_bgo_2", "title": "Parsing Windows Event XML concurrently", "type": "standard" },
  { "id": "mod_bgo_3", "title": "Automated IR Pipelines via Go APIs", "type": "standard" },
  { "id": "mod_bgo_boss", "title": "Build: Distributed Threat Intel Aggregator", "type": "boss" },
  { "id": "mod_blue_1", "title": "Hunting in Windows Event Logs", "type": "standard" },
  { "id": "mod_blue_2", "title": "Sysmon Configuration & Tuning", "type": "standard" },
  { "id": "mod_blue_3", "title": "Network Traffic Analysis (Wireshark)", "type": "standard" },
  { "id": "mod_blue_4", "title": "Volatile Memory Forensics (Volatility)", "type": "standard" },
  { "id": "mod_blue_5", "title": "Malware Analysis & Reverse Engineering", "type": "standard" },
  { "id": "mod_blue_boss", "title": "Build: Custom SIEM Dashboard", "type": "boss" },
  { "id": "mod_blue_boss2", "title": "Build: Automated Sandboxing Pipeline", "type": "boss" },
  { "id": "mod_bru_1", "title": "Memory-Safe Network Parsers in Rust", "type": "standard" },
  { "id": "mod_bru_2", "title": "Introduction to eBPF for Linux Telemetry", "type": "standard" },
  { "id": "mod_bru_3", "title": "Writing Secure YARA Rule Engines", "type": "standard" },
  { "id": "mod_bru_boss", "title": "Build: Rust-Based Lightweight EDR Agent", "type": "boss" },
  { "id": "mod_cryp_1", "title": "Symmetric vs Asymmetric Encryption", "type": "standard" },
  { "id": "mod_cryp_2", "title": "Diffie-Hellman Key Exchange", "type": "standard" },
  { "id": "mod_cryp_3", "title": "Salting, Hashing & Rainbow Tables", "type": "standard" },
  { "id": "mod_cryp_4", "title": "RSA Architecture & Prime Factoring", "type": "standard" },
  { "id": "mod_cryp_boss", "title": "Build: Custom AES-GCM Encrypter", "type": "boss" },
  { "id": "mod_lin_1", "title": "Navigating the File System", "type": "standard" },
  { "id": "mod_lin_2", "title": "Permissions: chmod & chown", "type": "standard" },
  { "id": "mod_lin_3", "title": "Process Management & Grep", "type": "standard" },
  { "id": "mod_lin_boss", "title": "Build: Automated Recon Bash Script", "type": "boss" },
  { "id": "mod_net_1", "title": "The OSI Model Demystified", "type": "standard" },
  { "id": "mod_net_2", "title": "TCP Handshakes & UDP Floods", "type": "standard" },
  { "id": "mod_net_3", "title": "Subnetting & CIDR Notation", "type": "standard" },
  { "id": "mod_net_4", "title": "BGP Routing & DNS Architecture", "type": "standard" },
  { "id": "mod_net_boss", "title": "Build: Raw Socket Packet Sniffer", "type": "boss" },
  { "id": "mod_op_1", "title": "Tor Routing & Onion Services", "type": "standard" },
  { "id": "mod_op_2", "title": "MAC Spoofing & Fingerprinting", "type": "standard" },
  { "id": "mod_op_boss", "title": "Build: Ephemeral Burner Script", "type": "boss" },
  { "id": "mod_pad_1", "title": "Deploying Network Honeypots", "type": "standard" },
  { "id": "mod_pad_2", "title": "Active Directory Honeytokens", "type": "standard" },
  { "id": "mod_pad_3", "title": "Deflecting Scans with iptables & Go", "type": "standard" },
  { "id": "mod_pad_boss", "title": "Build: Self-Healing Deception Network", "type": "boss" },
  { "id": "mod_png_1", "title": "Prototyping APT Beacons in Nim", "type": "standard" },
  { "id": "mod_png_2", "title": "Detecting Go/Nim Tooling Signatures", "type": "standard" },
  { "id": "mod_png_3", "title": "Automating ATT&CK TTPs in Go", "type": "standard" },
  { "id": "mod_png_boss", "title": "Build: Full-Stack Breach Simulation Engine", "type": "boss" },
  { "id": "mod_prog_1", "title": "Variables, Types & Memory Allocation", "type": "standard" },
  { "id": "mod_prog_2", "title": "Control Flow: Loops & Conditionals", "type": "standard" },
  { "id": "mod_prog_3", "title": "Functions & Scope Execution", "type": "standard" },
  { "id": "mod_prog_4", "title": "Data Structures: Arrays vs Hash Maps", "type": "standard" },
  { "id": "mod_prog_5", "title": "Understanding External Libraries & APIs", "type": "standard" },
  { "id": "mod_purp_1", "title": "Automating MITRE ATT&CK", "type": "standard" },
  { "id": "mod_purp_2", "title": "Writing YARA & Sigma Rules", "type": "standard" },
  { "id": "mod_purp_boss", "title": "Build: Automated Breach Simulation", "type": "boss" },
  { "id": "mod_rgo_1", "title": "Goroutines for Parallel Port Scanning", "type": "standard" },
  { "id": "mod_rgo_2", "title": "Cross-Compiling & Binary Stripping", "type": "standard" },
  { "id": "mod_rgo_3", "title": "Raw Sockets & Packet Crafting", "type": "standard" },
  { "id": "mod_rgo_boss", "title": "Build: Concurrent Ransomware Simulator", "type": "boss" },
  { "id": "mod_rrn_1", "title": "Rust: Unsafe Blocks vs Memory Safety", "type": "standard" },
  { "id": "mod_rrn_2", "title": "Rust: Direct Windows API Interfacing", "type": "standard" },
  { "id": "mod_rrn_3", "title": "Nim: Rapid Shellcode Injection", "type": "standard" },
  { "id": "mod_rrn_boss", "title": "Build: EDR-Evasive Nim Dropper", "type": "boss" }
]
```

## REALISTIC PACING

- Setup time per session: 30 seconds (paste master prompt)
- Per batch of 5 lessons: ~1 minute Gemini round-trip + ~2 minutes spot-checking
- 80 modules ÷ 5 per batch = 16 batches = roughly 1 evening if you're focused

Compare to relying on Groq with 30 RPM and 6000 TPM limits forever. This is a one-time afternoon of work that PERMANENTLY solves your rate limit problem AND gives you total editorial control.

## RUNNING THE SEEDER

The script (`seed-lessons.mjs` in this folder) needs two environment variables:

```bash
export SUPABASE_URL="https://ueurqszqmoramxgrgicv.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."  # from Supabase Dashboard → Project Settings → API
```

Get the service role key from your Supabase dashboard. **Never commit it. Never expose it client-side.** It bypasses RLS — keep it on your machine only.

```bash
# Install once
npm install @supabase/supabase-js

# Validate without writing
node seed-lessons.mjs --validate-only lessons/batch-01.json

# Actually seed (idempotent — re-runs safely overwrite)
node seed-lessons.mjs lessons/batch-01.json

# Seed everything at once after you've collected them all
node seed-lessons.mjs lessons/*.json

# Check status — shows which modules are cached vs missing
node seed-lessons.mjs --status
```

## QUALITY-CONTROL TIPS

- **Spot-check the first lesson Gemini produces** in each new chat session. If the tone or schema drifts, course-correct immediately with "this needs to follow the schema exactly — try m2-1 again."
- **Iterate on individual lessons.** After seeding, open the app and play through the lesson yourself. If a hint is weak or a code_practice answer is ambiguous, paste it back into Gemini with the note "tighten this — the context doesn't clearly tell the learner what identifier to type" and re-seed that single module.
- **Boss modules deserve extra attention.** They're high-XP, high-stakes. Maybe spend an extra 5 minutes per boss giving Gemini specific scenarios you want covered.
- **Lock the language explicitly in your batch JSON if needed:**
  ```json
  { "id": "m2-2", "title": "TCP Server & Client in Go", "type": "lab", "language_override": "Go" }
  ```
  Then update the master prompt to honor `language_override` if present. Useful when Gemini's auto-detection is wrong.

## WHEN YOU'RE 100% DONE SEEDING

You can simplify the app significantly:

1. Add a fallback in `/api/generate-lesson.js` that returns a friendly "this module hasn't been built yet — check back soon" instead of calling Groq. Saves you any token risk.
2. Remove your local AI / llama integration entirely. Less code, less to maintain.
3. Optionally delete the GROQ_API_KEY env var and the entire dependency.

The cache table becomes your content database. You can edit any lesson at any time via SQL (or build a tiny admin page later) and the change is live for all users immediately.
