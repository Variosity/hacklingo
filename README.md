# HACKLINGO

> **Learn cybersecurity like a game. 5-minute missions. Real skills. Zero fluff.**

[![Status](https://img.shields.io/badge/status-ONLINE-00ff88?style=flat-square&labelColor=000)](https://hacklingo.tech)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20iOS%20%7C%20Android-00ff88?style=flat-square&labelColor=000)](https://hacklingo.tech)
[![License](https://img.shields.io/badge/license-MIT-00ff88?style=flat-square&labelColor=000)](./LICENSE)

---

## What It Is

Hacklingo is a gamified cybersecurity training platform that turns offensive and defensive security into a daily habit. Think Duolingo, but for hacking — streaks, ranks, squad competition, and real-world challenge mechanics applied to Red Team, Blue Team, and Purple Team skill paths.

Built because textbooks are dense, CTFs assume prior knowledge, and bootcamps cost $15K. HackLingo is the bridge: five minutes on the train, one mission before bed, a streak you'd be psychologically destroyed to break.

**[→ Launch App](https://hacklingo.tech)**

---

## Paths

| Path | Focus |
|---|---|
| 🔴 **Red Team** | Offensive security — exploitation, web hacking, social engineering, adversary simulation |
| 🔵 **Blue Team** | Defense — detection, incident response, forensics, SOC operations, hardening |
| 🟣 **Purple Team** | Both worlds. The complete operator. The hardest path. The most dangerous. |

---

## Features

- **Streak System** — Missed days cost you. Burner phones save you once.
- **Rank Progression** — Ghost → Initiate → Operative → Phantom → Infiltrator → Grandmaster
- **Squads** — Train with others, compete on leaderboards, don't be the one who broke the chain
- **Daily Drops** — XP and Hashes every 24 hours, compounding with streak bonuses
- **Threads** — Lesson currency that regenerates over time, forcing deliberate practice
- **Themes** — Unlock custom UI skins with earned Hashes

---

## Install

**Web (instant, no install)**
→ [hacklingo.tech](https://hacklingo.tech) — sign up and start immediately

**iOS (Safari PWA)**
1. Open hacklingo.tech in Safari
2. Tap the Share icon
3. Scroll to "Add to Home Screen"
4. Tap Add — runs fullscreen like a native app

**Android (APK)**
→ [Download APK from GitHub Releases](https://github.com/Variosity/hacklingo/releases/download/v3/hacklingo.apk)
Sideload from GitHub Releases. Enable "Install from unknown sources" in your Android settings.

---

## Architecture

```
hacklingo/
├── app/                   # Next.js App Router pages
│   ├── page.tsx           # Marketing landing / pre-auth screen
│   ├── layout.tsx         # Root layout, metadata, fonts
│   └── (app)/             # Authenticated app shell
├── components/            # Reusable UI components
├── lib/                   # Supabase client, auth helpers, utilities
├── public/                # Static assets
└── styles/                # Global CSS
```

**Stack:**
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Auth & Database:** Supabase (PostgreSQL under the hood)
- **Deployment:** Vercel
- **Animation:** Framer Motion
- **Mobile:** Progressive Web App (iOS) + APK (Android)

---

## Security Design

Hacklingo applies the same principles it teaches:

- Authentication handled entirely through Supabase Auth (battle-tested, not hand-rolled)
- No passwords stored — email magic link and OAuth flows
- Row Level Security (RLS) enforced at the database layer, not just the API
- User progression data is scoped per-user at the DB level
- All inputs sanitized before Supabase queries

---

## Local Development

```bash
git clone https://github.com/Variosity/hacklingo.git
cd hacklingo
npm install
```

Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Why I Built This

The existing cybersecurity education landscape is broken at both ends. Beginner content is either too abstract (Wikipedia-style theory) or too expensive (bootcamps). Intermediate content (CTFs, labs) assumes you already know things beginners don't know yet.

Hacklingo was designed to close that gap using proven engagement mechanics — the same streak and rank systems that make language learning apps addictive — applied to a domain that actually needs more practitioners.

---

## Ethics & Legal

Hacklingo teaches offensive and defensive techniques for **educational, ethical, and authorized use only**. Applying these techniques to systems, networks, or people you don't own or have explicit written permission to test is illegal in most jurisdictions and can result in prosecution.

Use what you learn here to **defend, build, and harden** — not to harm.

Copyright concerns: [dmca@hacklingo.tech](mailto:dmca@hacklingo.tech)

---

## Roadmap

- [ ] Native iOS app (App Store submission)
- [ ] Expanded lesson library (100+ missions per path)
- [ ] Squad challenge events (timed group competitions)
- [ ] Instructor API (for bootcamps / security teams)
- [ ] Certificate of completion (verifiable, signed)

---

**© 2026 Hacklingo. All operations classified.**
