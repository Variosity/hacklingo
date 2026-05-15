import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

// ── THEME ENGINE ─────────────────────────────────────────────────────────────
const THEMES = {
  default: {
    id: "default",
    name: "Terminal Green",
    bg: "#080808",
    surface: "#111",
    accent: "#00ff88",
    text: "#f0f0f0",
    cost: 0,
  },
  pyr: {
    id: "pyr",
    name: "Pyr (Crimson Void)",
    bg: "#0a0202",
    surface: "#140505",
    accent: "#ef4444",
    text: "#fca5a5",
    cost: 5000,
  },
  tyd: {
    id: "tyd",
    name: "Tyd (Deep Ocean)",
    bg: "#02060a",
    surface: "#050e14",
    accent: "#0ea5e9",
    text: "#bae6fd",
    cost: 5000,
  },
  synth: {
    id: "synth",
    name: "Synth (Neon Purple)",
    bg: "#0f0514",
    surface: "#1a0b26",
    accent: "#d946ef",
    text: "#f5d0fe",
    cost: 7500,
  },
  flashbang: {
    id: "flashbang",
    name: "Flashbang (Light)",
    bg: "#f8fafc",
    surface: "#e2e8f0",
    accent: "#0284c7",
    text: "#0f172a",
    cost: 10000,
  },
  arctic: {
    id: "arctic",
    name: "Arctic (Snowblind)",
    bg: "#ffffff",
    surface: "#f1f5f9",
    accent: "#3b82f6",
    text: "#0f172a",
    cost: 10000,
  },
};

// ── BRUTAL PROGRESSION & LORE ────────────────────────────────────────────────
const RANKS = [
  { id: 0, name: "Ghost", min: 0, icon: "👻", color: "#888" },
  { id: 1, name: "Initiate", min: 1500, icon: "🔰", color: "#4ade80" },
  { id: 2, name: "Operative", min: 10000, icon: "🎯", color: "#22d3ee" },
  { id: 3, name: "Phantom", min: 50000, icon: "🌑", color: "#f472b6" },
  { id: 4, name: "Infiltrator", min: 150000, icon: "🕷️", color: "#ef4444" },
  { id: 5, name: "Grandmaster", min: 500000, icon: "👁️", color: "#00ff88" },
];

const PATHS = {
  unassigned: {
    label: "Unassigned",
    emoji: "👤",
    color: "#888",
    glow: "#88888880",
    desc: "Complete foundations to choose.",
  },
  red: {
    label: "Red Team",
    emoji: "🔴",
    color: "#ef4444",
    glow: "#ef444480",
    desc: "Offensive security, exploitation, adversary simulation",
  },
  blue: {
    label: "Blue Team",
    emoji: "🔵",
    color: "#3b82f6",
    glow: "#3b82f680",
    desc: "Defense, detection, incident response, hardening",
  },
  purple: {
    label: "Purple Team",
    emoji: "🟣",
    color: "#a855f7",
    glow: "#a855f780",
    desc: "Both worlds. The complete hacker. Most dangerous path.",
  },
};

// ── UTILITIES ───────────────────────────────────────────────────────────────
const getRank = (xp) =>
  RANKS.slice()
    .reverse()
    .find((r) => xp >= r.min) || RANKS[0];
const getNextRank = (xp) =>
  RANKS.find((r) => r.min > xp) || RANKS[RANKS.length - 1];
const xpProgress = (xp) => {
  const cur = getRank(xp);
  const nxt = getNextRank(xp);
  if (cur === nxt) return 100;
  return Math.round(((xp - cur.min) / (nxt.min - cur.min)) * 100);
};

const getNextMission = (userState, curriculum) => {
  if (!userState || !userState.completedModules || !curriculum.length)
    return null;
  const activeCurriculum = curriculum.filter(
    (track) => !track.pathLock || track.pathLock === userState.path,
  );
  for (const track of activeCurriculum) {
    for (const mod of track.modules) {
      if (!userState.completedModules.includes(mod.id)) {
        return { ...mod, trackColor: track.color, trackTitle: track.title };
      }
    }
  }
  return null;
};

const getThreadCost = (mission) => {
  if (!mission) return 0;
  if (mission.type === "boss") return 9;
  if (mission.xp >= 200) return 6;
  return 3;
};

// Wraps a promise with a timeout. If the promise doesn't resolve/reject
// within `ms` milliseconds, this throws a "Timeout" error so the caller
// can recover instead of hanging forever.
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
        ms,
      ),
    ),
  ]);

// Production URL — used for share links so they don't point at localhost in dev
const APP_URL = "https://hacklingo.tech";

// ── ACHIEVEMENTS ───────────────────────────────────────────────────────────
// Add new ones here — check function gets the userState and returns boolean
const ACHIEVEMENTS = [
  {
    id: "first_blood",
    name: "First Blood",
    icon: "🩸",
    desc: "Complete your first mission",
    check: (u) => (u.completedModules?.length || 0) >= 1,
  },
  {
    id: "five_alive",
    name: "Five Alive",
    icon: "✋",
    desc: "Complete 5 missions",
    check: (u) => (u.completedModules?.length || 0) >= 5,
  },
  {
    id: "centurion",
    name: "Centurion",
    icon: "💯",
    desc: "Complete 100 missions",
    check: (u) => (u.completedModules?.length || 0) >= 100,
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    icon: "🔥",
    desc: "7-day streak",
    check: (u) => (u.persistence_streak || 0) >= 7,
  },
  {
    id: "month_monk",
    name: "Month Monk",
    icon: "🧘",
    desc: "30-day streak",
    check: (u) => (u.persistence_streak || 0) >= 30,
  },
  {
    id: "year_legend",
    name: "Year Legend",
    icon: "🏆",
    desc: "365-day streak",
    check: (u) => (u.persistence_streak || 0) >= 365,
  },
  {
    id: "initiate",
    name: "Made Initiate",
    icon: "🔰",
    desc: "Reach 1,500 XP",
    check: (u) => (u.xp || 0) >= 1500,
  },
  {
    id: "operative",
    name: "Operative",
    icon: "🎯",
    desc: "Reach 10,000 XP",
    check: (u) => (u.xp || 0) >= 10000,
  },
  {
    id: "phantom",
    name: "Phantom Tier",
    icon: "🌑",
    desc: "Reach 50,000 XP",
    check: (u) => (u.xp || 0) >= 50000,
  },
  {
    id: "hash_collector",
    name: "Hash Collector",
    icon: "💰",
    desc: "Accumulate 5,000 Hashes",
    check: (u) => (u.hashes || 0) >= 5000,
  },
  {
    id: "hash_hoarder",
    name: "Hash Hoarder",
    icon: "🪙",
    desc: "Accumulate 25,000 Hashes",
    check: (u) => (u.hashes || 0) >= 25000,
  },
  {
    id: "recruiter",
    name: "Recruiter",
    icon: "🤝",
    desc: "Refer your first operator",
    check: (u) => (u.referral_count || 0) >= 1,
  },
  {
    id: "squad_builder",
    name: "Squad Builder",
    icon: "👥",
    desc: "Refer 5 operators",
    check: (u) => (u.referral_count || 0) >= 5,
  },
  {
    id: "kingpin",
    name: "Kingpin",
    icon: "👑",
    desc: "Refer 25 operators",
    check: (u) => (u.referral_count || 0) >= 25,
  },
  {
    id: "path_chosen",
    name: "Path Chosen",
    icon: "🗺️",
    desc: "Pick a team alignment",
    check: (u) => u.path && u.path !== "unassigned",
  },
  {
    id: "supporter",
    name: "Inner Circle",
    icon: "💎",
    desc: "Become a Root Access supporter",
    check: (u) => u.is_supporter === true,
  },
  {
    id: "burner_carrier",
    name: "Burner Carrier",
    icon: "📱",
    desc: "Stockpile 3 burner phones",
    check: (u) => (u.burner_phones || 0) >= 3,
  },
];

// ── SOUNDS ─────────────────────────────────────────────────────────────────
// Drop .mp3 files into /public/sounds/ — names must match the keys below.
// Calls are no-ops if the file is missing, so this won't break before you add audio.
const SOUND_FILES = {
  lesson_complete: "/sounds/lesson_complete.mp3",
  correct_answer: "/sounds/correct_answer.mp3",
  daily_reward: "/sounds/daily_reward.mp3",
};

// Cache audio elements so we don't re-fetch each play
const _audioCache = {};
const playSound = (name) => {
  // Don't play sounds if user has muted via system or hasn't enabled them yet
  try {
    const src = SOUND_FILES[name];
    if (!src) return;
    if (!_audioCache[name]) {
      _audioCache[name] = new Audio(src);
      _audioCache[name].volume = 0.6;
      _audioCache[name].preload = "auto";
    }
    // Reset to start in case it's already playing
    _audioCache[name].currentTime = 0;
    const playPromise = _audioCache[name].play();
    if (playPromise) playPromise.catch(() => {}); // ignore autoplay restrictions
  } catch (e) {
    // Silently fail — sounds are non-critical
  }
};

// ── UI COMPONENTS ───────────────────────────────────────────────────────────
function NavBar({ active, onNav, theme }) {
  const items = [
    { id: "home", icon: "⚡", label: "Home" },
    { id: "skilltree", icon: "🗺️", label: "Path" },
    { id: "leaderboard", icon: "🏆", label: "Ranks" },
    { id: "market", icon: "🛒", label: "Market" },
    { id: "squads", icon: "👥", label: "Squads" },
    { id: "profile", icon: "👤", label: "Operator" },
  ];
  return (
    <nav className="nav-bar">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onNav(it.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            color: active === it.id ? theme.accent : "#555",
            transition: "color .2s",
          }}
        >
          <span style={{ fontSize: 20 }}>{it.icon}</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            {it.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── AUTH GATE COMPONENT ─────────────────────────────────────────────────────
function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [ageAgreed, setAgeAgreed] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const handleGithubAuth = async () => {
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setErrorMsg("Enter your email address above first.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else setResetSent(true);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (isSignUp) {
        if (!username) throw new Error("Operator handle is required.");

        const handleRegex = /^[a-zA-Z0-9_-]{3,16}$/;
        if (!handleRegex.test(username)) {
          throw new Error(
            "Handle must be 3-16 chars. Letters, numbers, underscores, and hyphens only.",
          );
        }

        if (!ageAgreed) {
          throw new Error(
            "You must confirm you are 13+ and accept the Terms to proceed.",
          );
        }

        // Validate referral code format if provided (optional field)
        const trimmedReferral = referralCode.trim().toUpperCase();
        if (trimmedReferral && !/^[A-Z0-9]{6,12}$/.test(trimmedReferral)) {
          throw new Error("Invalid referral code format.");
        }

        // Pass the username + referral into raw_user_meta_data so the SQL trigger can grab them
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              referred_by_code: trimmedReferral || null,
            },
          },
        });

        if (error) throw error;

        // If email confirmation is ON, Supabase returns a user but NO session
        if (data.user && !data.session) {
          setInfoMsg(
            "✅ Verification email sent. Check your inbox to establish connection.",
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "56px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>📟</div>
      <h1
        style={{
          color: "#00ff88",
          marginBottom: 8,
          fontFamily: "monospace",
          letterSpacing: 2,
        }}
      >
        HACKLINGO
      </h1>
      <p style={{ color: "#555", marginBottom: 32, fontFamily: "monospace" }}>
        SECURE CONNECTION REQUIRED
      </p>

      <form
        onSubmit={handleAuth}
        style={{
          width: "100%",
          maxWidth: 320,
          background: "#0a0a0a",
          padding: 24,
          borderRadius: 12,
          border: "1px solid #1a1a1a",
        }}
      >
        {isSignUp && (
          <input
            type="text"
            placeholder="OPERATOR HANDLE"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              background: "#111",
              border: "1px solid #333",
              color: "#00ff88",
              fontFamily: "monospace",
              borderRadius: 4,
            }}
          />
        )}
        <input
          type="email"
          placeholder="EMAIL ADDRESS"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            background: "#111",
            border: "1px solid #333",
            color: "#00ff88",
            fontFamily: "monospace",
            borderRadius: 4,
          }}
        />
        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 16,
            background: "#111",
            border: "1px solid #333",
            color: "#00ff88",
            fontFamily: "monospace",
            borderRadius: 4,
          }}
        />

        {isSignUp && (
          <>
            <input
              type="text"
              placeholder="REFERRAL CODE (OPTIONAL)"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              maxLength={12}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 16,
                background: "#111",
                border: "1px solid #333",
                color: "#facc15",
                fontFamily: "monospace",
                borderRadius: 4,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 16,
                cursor: "pointer",
                color: "#888",
                fontSize: 11,
                fontFamily: "monospace",
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={ageAgreed}
                onChange={(e) => setAgeAgreed(e.target.checked)}
                style={{
                  marginTop: 2,
                  accentColor: "#00ff88",
                  flexShrink: 0,
                }}
              />
              <span>
                I am 13+ and agree to use Hacklingo for{" "}
                <strong style={{ color: "#facc15" }}>
                  authorized learning only
                </strong>
                . I will not apply techniques to systems I don't own or have
                explicit written permission to test.
              </span>
            </label>
          </>
        )}

        {errorMsg && (
          <div
            style={{
              color: "#ef4444",
              fontSize: 12,
              marginBottom: 16,
              fontFamily: "monospace",
            }}
          >
            [ERROR] {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div
            style={{
              color: "#00ff88",
              fontSize: 12,
              marginBottom: 16,
              fontFamily: "monospace",
              lineHeight: 1.5,
            }}
          >
            {infoMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#00ff88",
            color: "#000",
            fontWeight: "bold",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "monospace",
          }}
        >
          {loading
            ? "INITIALIZING..."
            : isSignUp
              ? "REGISTER"
              : "ESTABLISH CONNECTION"}
        </button>
      </form>
      <button
        onClick={() => {
          setIsSignUp(!isSignUp);
          setErrorMsg("");
        }}
        style={{
          marginTop: 24,
          background: "none",
          border: "none",
          color: "#888",
          fontFamily: "monospace",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        {isSignUp
          ? "Already an operator? Authenticate here."
          : "New operator? Register here."}
      </button>

      {!isSignUp && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          {!showReset ? (
            <button
              onClick={() => {
                setShowReset(true);
                setErrorMsg("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#444",
                fontFamily: "monospace",
                fontSize: 11,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </button>
          ) : resetSent ? (
            <div
              style={{
                color: "#00ff88",
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              ✅ Reset link sent — check your email.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p
                style={{
                  color: "#555",
                  fontSize: 11,
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                Enter your email above then:
              </p>
              <button
                onClick={handleResetPassword}
                disabled={loading}
                style={{
                  padding: "10px 0",
                  background: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: 4,
                  color: "#00ff88",
                  fontFamily: "monospace",
                  fontSize: 12,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "SENDING..." : "SEND RESET LINK"}
              </button>
              <button
                onClick={() => setShowReset(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#444",
                  fontFamily: "monospace",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 320, marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
          <span
            style={{ color: "#444", fontSize: 11, fontFamily: "monospace" }}
          >
            OR
          </span>
          <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
        </div>
        <button
          onClick={handleGithubAuth}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 4,
            color: "#f0f6fc",
            fontWeight: "bold",
            fontFamily: "monospace",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          ⬡ CONTINUE WITH GITHUB
        </button>
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 8,
            background: "#fff",
            border: "1px solid #dadce0",
            borderRadius: 4,
            color: "#1f1f1f",
            fontWeight: "bold",
            fontFamily: "monospace",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>G</span> CONTINUE WITH GOOGLE
        </button>
      </div>
    </div>
  );
}

// ── SCREENS ─────────────────────────────────────────────────────────────────
function HomeScreen({
  userState,
  curriculum,
  theme,
  onOpenLesson,
  onChoosePath,
  onOpenPersistence,
  onOpenDailyReward,
  onOpenThreadRegen,
  onOpenRankProgression,
  onNav,
}) {
  if (!userState || !curriculum.length) return null;
  const rank = getRank(userState.xp);
  const nextRank = getNextRank(userState.xp);
  const pathInfo = PATHS[userState.path];
  const nextMission = getNextMission(userState, curriculum);

  return (
    <div style={{ padding: "24px 16px 80px" }}>
      {/* Top HUD: Lore Economy */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
          background: theme.surface,
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${theme.accent}30`,
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenThreadRegen();
          }}
          style={{ textAlign: "center", cursor: "pointer" }}
        >
          <div style={{ fontSize: 18, color: theme.text }}>
            🧵 {userState.threads ?? 22}/22
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#888",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Threads
          </div>
        </div>
        <div
          onClick={() => onNav("market")}
          style={{ textAlign: "center", cursor: "pointer" }}
        >
          <div style={{ fontSize: 18, color: theme.accent }}>
            #️⃣ {(userState.hashes ?? 0).toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#888",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Hashes
          </div>
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenPersistence();
          }}
          style={{ textAlign: "center", cursor: "pointer" }}
        >
          <div style={{ fontSize: 18, color: "#facc15" }}>
            🔥 {userState.persistence_streak ?? 0}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#888",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Persistence
          </div>
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenDailyReward();
          }}
          style={{
            textAlign: "center",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <div style={{ fontSize: 18, color: theme.accent }}>🎁</div>
          {(() => {
            const last = userState.last_reward
              ? new Date(userState.last_reward)
              : new Date(0);
            const eligible = (new Date() - last) / (1000 * 60 * 60) >= 24;
            return eligible ? (
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#ef4444",
                  boxShadow: "0 0 6px #ef4444",
                }}
              />
            ) : null;
          })()}
          <div
            style={{
              fontSize: 9,
              color: "#888",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Drop
          </div>
        </div>
      </div>

      <div
        onClick={onOpenRankProgression}
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            operator
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>
            {userState.username}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24 }}>{rank.icon}</div>
          <div
            style={{
              fontSize: 11,
              color: theme.accent,
              fontFamily: "monospace",
            }}
          >
            {rank.name}
          </div>
        </div>
      </div>

      <div
        onClick={onOpenRankProgression}
        style={{
          background: theme.surface,
          border: `1px solid ${pathInfo.color}30`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          <span style={{ color: theme.text }}>
            {userState.xp.toLocaleString()} XP
          </span>
          <span style={{ color: "#888" }}>
            → {nextRank.min.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            background: theme.bg,
            borderRadius: 4,
            height: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${xpProgress(userState.xp)}%`,
              height: "100%",
              background: theme.accent,
              boxShadow: `0 0 8px ${theme.accent}`,
            }}
          />
        </div>
      </div>

      {userState.path === "unassigned" && (
        <button
          onClick={onChoosePath}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 20,
            background: "linear-gradient(90deg, #ef4444, #3b82f6, #a855f7)",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          ⚠️ ALIGN YOUR PATH
        </button>
      )}

      {nextMission ? (
        <div
          onClick={() => onOpenLesson(nextMission)}
          style={{
            background: theme.surface,
            border: `1px solid ${nextMission.trackColor}30`,
            borderLeft: `3px solid ${nextMission.trackColor}`,
            borderRadius: 10,
            padding: 14,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: nextMission.trackColor,
              marginBottom: 4,
              fontFamily: "monospace",
            }}
          >
            ⚡ ACTIVE TARGET: {nextMission.trackTitle.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 16,
              color: theme.text,
              marginBottom: 8,
              fontWeight: "bold",
            }}
          >
            {nextMission.title}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#888",
                fontFamily: "monospace",
                textTransform: "uppercase",
              }}
            >
              COST: {getThreadCost(nextMission)} THREAD
              {getThreadCost(nextMission) > 1 ? "S" : ""}
            </span>
            <span
              style={{
                fontSize: 11,
                color: theme.accent,
                fontFamily: "monospace",
              }}
            >
              +{nextMission.xp} XP / +{Math.round(nextMission.xp / 2)} Hashes →
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: 20,
            color: theme.accent,
            border: `1px dashed ${theme.accent}`,
            borderRadius: 10,
          }}
        >
          You have completed all available modules for your path. Awaiting
          updates.
        </div>
      )}
    </div>
  );
}

// ── DYNAMIC ACTIVITY CALENDAR MODAL ─────────────────────────────────────────
function PersistenceModal({ isOpen, userState, onClose, theme }) {
  const [viewDate, setViewDate] = useState(new Date());

  const streak = userState.persistence_streak ?? 0;
  const burnersUsed = userState.burners_used ?? 0;

  // Calculate the exact date range of the current streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const streakStart = new Date(today);
  streakStart.setDate(today.getDate() - (streak > 0 ? streak - 1 : 0));

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Get exactly how many days are in this specific month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // Find out what day of the week the 1st falls on (for grid alignment)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const monthNames = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];

  const handlePrevMonth = () => {
    // Hard-lock: Cannot navigate to before May 2026 (Launch Date)
    if (currentYear === 2026 && currentMonth === 4) return;
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: isOpen ? "flex" : "none", // NATIVE DOM OVERRIDE
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.9)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}50`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 350,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: theme.text,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Activity Matrix
          </div>
          <span
            onClick={onClose}
            style={{ color: "#888", cursor: "pointer", fontSize: 20 }}
          >
            ✕
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={handlePrevMonth}
            disabled={currentYear === 2026 && currentMonth === 4}
            style={{
              background: "none",
              border: "none",
              color:
                currentYear === 2026 && currentMonth === 4
                  ? "#444"
                  : theme.accent,
              cursor:
                currentYear === 2026 && currentMonth === 4
                  ? "not-allowed"
                  : "pointer",
              fontSize: 18,
            }}
          >
            ◀
          </button>
          <div
            style={{
              color: theme.text,
              fontFamily: "monospace",
              fontWeight: "bold",
              letterSpacing: 1,
            }}
          >
            {monthNames[currentMonth]} {currentYear}
          </div>
          <button
            onClick={handleNextMonth}
            style={{
              background: "none",
              border: "none",
              color: theme.accent,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ▶
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            marginBottom: 8,
            textAlign: "center",
            fontSize: 10,
            color: "#888",
            fontFamily: "monospace",
          }}
        >
          <div>SU</div>
          <div>MO</div>
          <div>TU</div>
          <div>WE</div>
          <div>TH</div>
          <div>FR</div>
          <div>SA</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {blanks.map((b) => (
            <div key={`blank-${b}`} />
          ))}
          {days.map((day) => {
            const thisDate = new Date(currentYear, currentMonth, day);
            thisDate.setHours(0, 0, 0, 0);

            const isActive =
              streak > 0 && thisDate >= streakStart && thisDate <= today;
            const isToday = thisDate.getTime() === today.getTime();

            return (
              <div
                key={day}
                style={{
                  aspectRatio: "1/1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? theme.accent : "transparent",
                  color: isActive ? "#000" : theme.text,
                  border: isToday
                    ? `1px solid ${theme.accent}`
                    : `1px solid ${theme.bg}`,
                  opacity: isActive || isToday ? 1 : 0.4,
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: isActive ? "bold" : "normal",
                  fontFamily: "monospace",
                  boxShadow: isActive ? `0 0 8px ${theme.accent}40` : "none",
                }}
              >
                {day}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #333",
            paddingTop: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
              }}
            >
              Current Streak
            </div>
            <div
              style={{ fontSize: 18, fontWeight: "bold", color: theme.text }}
            >
              {streak} Days
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
              }}
            >
              Burners Deployed
            </div>
            <div style={{ fontSize: 18, fontWeight: "bold", color: "#f97316" }}>
              {burnersUsed}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PASSWORD RECOVERY MODAL ─────────────────────────────────────────────
// ── DAILY REWARD MODAL ─────────────────────────────────────────────────────
function DailyRewardModal({ userState, onClose, theme, onClaim }) {
  const lastRewardTime = userState?.last_reward
    ? new Date(userState.last_reward)
    : new Date(0);
  const hoursSinceReward = (new Date() - lastRewardTime) / (1000 * 60 * 60);
  const isEligible = hoursSinceReward >= 24;

  const nextHours = isEligible ? 0 : Math.ceil(24 - hoursSinceReward);

  const currentStreak = userState?.persistence_streak || 0;
  const xpReward = 250 + currentStreak * 10;
  const hashReward = 100 + currentStreak * 5;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${isEligible ? theme.accent : "#333"}`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 350,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {isEligible ? "🎁" : "⏳"}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: theme.text,
            fontFamily: "monospace",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Daily Supply Drop
        </div>

        {isEligible ? (
          <div style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
            Secure your daily rations to maintain operational readiness.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
            Drop coordinates calculating. Return in{" "}
            <span style={{ color: theme.accent, fontWeight: "bold" }}>
              {nextHours} hours
            </span>
            .
          </div>
        )}

        <div
          style={{
            background: "#0a0a0a",
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-around",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
              }}
            >
              XP Yield
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#00ff88",
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
            >
              +{xpReward}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
              }}
            >
              Hashes
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#facc15",
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
            >
              +{hashReward}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: "#666",
            marginBottom: 16,
            fontFamily: "monospace",
          }}
        >
          STREAK BONUS: +{currentStreak * 10} XP / +{currentStreak * 5} HASHES
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 12,
              background: "transparent",
              border: "1px solid #555",
              color: "#888",
              borderRadius: 8,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            DISMISS
          </button>
          <button
            onClick={() => {
              if (isEligible) onClaim(xpReward, hashReward);
            }}
            disabled={!isEligible}
            style={{
              flex: 1,
              padding: 12,
              background: isEligible ? theme.accent : "#333",
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontWeight: "bold",
              cursor: isEligible ? "pointer" : "not-allowed",
            }}
          >
            {isEligible ? "CLAIM DROP" : "LOCKED"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── THREAD REGENERATION TIMER MODAL ────────────────────────────────────────
function ThreadRegenModal({ userState, onClose, theme }) {
  const [, forceTick] = useState(0);

  // Recompute every second so the countdown stays live
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const threads = userState?.threads ?? 22;
  const isSupporter = userState?.is_supporter || false;
  const isMax = threads >= 22;

  // Mirror the same math fetchProfile uses
  const lastActiveTime = userState?.last_active
    ? new Date(userState.last_active)
    : new Date();
  const now = new Date();
  const msPerThread = 3 * 60 * 60 * 1000; // 3 hours
  const elapsed = now - lastActiveTime;
  const msUntilNext = isMax ? 0 : msPerThread - (elapsed % msPerThread);

  const formatTime = (ms) => {
    if (ms <= 0) return "00:00:00";
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const msUntilFull = isMax
    ? 0
    : (22 - threads) * msPerThread - (msPerThread - msUntilNext);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}50`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 350,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🧵</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: theme.text,
            fontFamily: "monospace",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Thread Inventory
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            marginBottom: 20,
            fontFamily: "monospace",
          }}
        >
          Threads power lesson attempts. 1 regenerates every 3 hours.
        </div>

        <div
          style={{
            background: "#0a0a0a",
            padding: 20,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 36,
              color: isMax ? "#00ff88" : theme.accent,
              fontWeight: "bold",
              fontFamily: "monospace",
              marginBottom: 4,
            }}
          >
            {isSupporter ? "∞" : `${threads} / 22`}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#888",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {isSupporter ? "Root Access · Unlimited" : "Current Threads"}
          </div>
        </div>

        {!isSupporter && !isMax && (
          <>
            <div
              style={{
                background: "#0a0a0a",
                padding: 16,
                borderRadius: 8,
                marginBottom: 12,
                border: `1px solid ${theme.accent}30`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                Next Thread In
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: theme.accent,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  letterSpacing: 2,
                }}
              >
                {formatTime(msUntilNext)}
              </div>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#666",
                fontFamily: "monospace",
                marginBottom: 20,
              }}
            >
              FULL INVENTORY IN {formatTime(msUntilFull)}
            </div>
          </>
        )}

        {!isSupporter && isMax && (
          <div
            style={{
              fontSize: 12,
              color: "#00ff88",
              fontFamily: "monospace",
              marginBottom: 20,
              padding: 12,
              border: "1px solid #00ff8830",
              borderRadius: 8,
            }}
          >
            ✓ THREAD INVENTORY FULL
          </div>
        )}

        {isSupporter && (
          <div
            style={{
              fontSize: 12,
              color: "#facc15",
              fontFamily: "monospace",
              marginBottom: 20,
              padding: 12,
              border: "1px solid #facc1530",
              borderRadius: 8,
            }}
          >
            👑 ROOT ACCESS · INFINITE THREADS
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: 12,
            background: "transparent",
            border: `1px solid ${theme.accent}50`,
            color: theme.accent,
            borderRadius: 8,
            fontWeight: "bold",
            fontFamily: "monospace",
            cursor: "pointer",
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}

// ── RANK PROGRESSION TIER LIST MODAL ───────────────────────────────────────
function RankProgressionModal({ userState, onClose, theme }) {
  const currentXp = userState?.xp || 0;
  const currentRank = getRank(currentXp);
  const nextRank = getNextRank(currentXp);
  const isMax = currentRank.id === RANKS[RANKS.length - 1].id;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}50`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 4 }}>
            {currentRank.icon}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.text,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Operator Progression
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontFamily: "monospace",
              marginTop: 4,
            }}
          >
            {currentXp.toLocaleString()} XP ·{" "}
            <span style={{ color: currentRank.color }}>{currentRank.name}</span>
          </div>
        </div>

        {!isMax && (
          <div
            style={{
              background: "#0a0a0a",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              border: `1px solid ${nextRank.color}30`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              Next Promotion
            </div>
            <div
              style={{
                fontSize: 13,
                color: nextRank.color,
                fontFamily: "monospace",
                fontWeight: "bold",
              }}
            >
              {(nextRank.min - currentXp).toLocaleString()} XP → {nextRank.icon}{" "}
              {nextRank.name}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RANKS.map((r) => {
            const achieved = currentXp >= r.min;
            const isCurrent = r.id === currentRank.id;
            return (
              <div
                key={r.id}
                style={{
                  background: isCurrent ? `${r.color}15` : "#0a0a0a",
                  border: isCurrent
                    ? `2px solid ${r.color}`
                    : achieved
                      ? `1px solid ${r.color}40`
                      : "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: achieved ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    filter: achieved ? "none" : "grayscale(1)",
                  }}
                >
                  {r.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: "bold",
                      color: achieved ? r.color : "#666",
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.name}
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#000",
                          background: r.color,
                          marginLeft: 8,
                          padding: "2px 6px",
                          borderRadius: 3,
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#888",
                      fontFamily: "monospace",
                      marginTop: 2,
                    }}
                  >
                    {r.min === 0
                      ? "Starting tier"
                      : `${r.min.toLocaleString()} XP required`}
                  </div>
                </div>
                {achieved && !isCurrent && (
                  <div style={{ fontSize: 14, color: "#00ff88" }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: 12,
            background: "transparent",
            border: `1px solid ${theme.accent}50`,
            color: theme.accent,
            borderRadius: 8,
            fontWeight: "bold",
            fontFamily: "monospace",
            cursor: "pointer",
            marginTop: 16,
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}

// ── PRE-AUTH MARKETING LANDING SCREEN ──────────────────────────────────────
function LandingScreen({ onEnterAuth }) {
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  // SEO: update document metadata when this screen mounts
  useEffect(() => {
    document.title =
      "Hacklingo — Duolingo for Hackers · Learn Cybersecurity Free";

    const ensureMeta = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };

    ensureMeta('meta[name="description"]', {
      name: "description",
      content:
        "Hacklingo turns offensive and defensive cybersecurity into a daily habit. Free, gamified, addictive. Learn Red Team, Blue Team, and Purple Team skills the way you actually retain them.",
    });
    ensureMeta('meta[property="og:title"]', {
      property: "og:title",
      content: "Hacklingo — Duolingo for Hackers",
    });
    ensureMeta('meta[property="og:description"]', {
      property: "og:description",
      content:
        "The fastest way to learn cybersecurity. Streaks, ranks, squads, and real-world challenges.",
    });
    ensureMeta('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });
    ensureMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
  }, []);

  const accent = "#00ff88";

  const Section = ({ children, style }) => (
    <section
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "64px 20px",
        ...style,
      }}
    >
      {children}
    </section>
  );

  const Card = ({ icon, title, children, color }) => (
    <div
      style={{
        background: "#0a0a0a",
        border: `1px solid ${color || accent}30`,
        borderRadius: 12,
        padding: 20,
        flex: 1,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <h3
        style={{
          fontSize: 14,
          color: color || accent,
          fontFamily: "monospace",
          textTransform: "uppercase",
          letterSpacing: 1,
          margin: "0 0 8px 0",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, margin: 0 }}>
        {children}
      </p>
    </div>
  );

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100vh",
        overflow: "auto",
      }}
    >
      {/* Hero */}
      <Section style={{ paddingTop: 80, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: `${accent}15`,
            border: `1px solid ${accent}40`,
            borderRadius: 999,
            fontSize: 10,
            color: accent,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          [ STATUS: ONLINE ]
        </div>
        <h1
          style={{
            fontSize: "clamp(36px, 8vw, 64px)",
            fontWeight: 900,
            fontFamily: "monospace",
            margin: "0 0 16px 0",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          <span style={{ color: accent }}>HACK</span>
          <span style={{ color: "#fff" }}>LINGO</span>
          <span
            style={{
              display: "inline-block",
              width: "0.5ch",
              background: accent,
              marginLeft: 4,
              animation: "blink 1s step-end infinite",
              height: "0.9em",
              verticalAlign: "text-bottom",
            }}
          />
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 3vw, 22px)",
            color: "#aaa",
            margin: "0 0 8px 0",
            fontWeight: 300,
          }}
        >
          Duolingo for hackers.
        </p>
        <p
          style={{
            fontSize: 14,
            color: "#666",
            margin: "0 0 40px 0",
            fontFamily: "monospace",
          }}
        >
          5-minute lessons. Real skills. Zero fluff.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          <button
            onClick={onEnterAuth}
            style={{
              padding: "16px 24px",
              background: accent,
              color: "#000",
              border: "none",
              borderRadius: 8,
              fontWeight: 900,
              fontFamily: "monospace",
              fontSize: 16,
              letterSpacing: 1,
              cursor: "pointer",
              boxShadow: `0 0 24px ${accent}40`,
            }}
          >
            BEGIN OPERATION →
          </button>
          <button
            onClick={onEnterAuth}
            style={{
              padding: "14px 24px",
              background: "transparent",
              color: "#aaa",
              border: "1px solid #333",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            I HAVE CREDENTIALS
          </button>
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 11,
            color: "#555",
            fontFamily: "monospace",
          }}
        >
          $0 · NO CREDIT CARD · IT'S JUST FREE
        </div>
      </Section>

      {/* Path showcase */}
      <Section>
        <h2
          style={{
            fontSize: 11,
            color: "#666",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            textAlign: "center",
            margin: "0 0 32px 0",
          }}
        >
          ── CHOOSE YOUR PATH ──
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Card icon="🔴" title="Red Team" color="#ef4444">
            Offensive security. Exploitation, web hacking, social engineering,
            adversary simulation.
          </Card>
          <Card icon="🔵" title="Blue Team" color="#3b82f6">
            Defense. Detection, incident response, forensics, hardening, SOC
            operations.
          </Card>
          <Card icon="🟣" title="Purple Team" color="#a855f7">
            Both worlds. The complete operator. Hardest path. Most dangerous.
          </Card>
        </div>
      </Section>

      {/* Why we're different */}
      <Section style={{ paddingTop: 32 }}>
        <h2
          style={{
            fontSize: 11,
            color: "#666",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            textAlign: "center",
            margin: "0 0 32px 0",
          }}
        >
          ── WHY THIS EXISTS ──
        </h2>
        <div
          style={{
            background: "#0a0a0a",
            border: `1px solid ${accent}20`,
            borderRadius: 12,
            padding: 28,
            fontFamily: "monospace",
            fontSize: 14,
            lineHeight: 1.8,
            color: "#ccc",
          }}
        >
          <p style={{ margin: "0 0 16px 0" }}>
            <span style={{ color: "#666" }}>$</span>{" "}
            <span style={{ color: accent }}>cat /etc/why.md</span>
          </p>
          <p style={{ margin: "0 0 12px 0" }}>
            Textbooks are dense. CTFs assume you already know. Bootcamps cost
            $15K.
          </p>
          <p style={{ margin: "0 0 12px 0" }}>
            Hacklingo is the bridge.{" "}
            <span style={{ color: accent }}>5 minutes</span> on the train.{" "}
            <span style={{ color: accent }}>One mission</span> before bed. A
            streak you'd be psychologically destroyed to break.
          </p>
          <p style={{ margin: 0, color: "#888" }}>
            Built for people who learn by doing — and who never had time for
            anything else.
          </p>
        </div>
      </Section>

      {/* Features */}
      <Section>
        <h2
          style={{
            fontSize: 11,
            color: "#666",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            textAlign: "center",
            margin: "0 0 32px 0",
          }}
        >
          ── HOW IT WORKS ──
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <Card icon="🔥" title="Persistence">
            Streaks that punish missed days. Burner phones save you once.
          </Card>
          <Card icon="🎯" title="Rank Up">
            Climb from Ghost → Initiate → Operative → Phantom → Infiltrator →
            Grandmaster.
          </Card>
          <Card icon="👥" title="Squads">
            Train with friends. Compete on leaderboards. Don't be the one who
            broke.
          </Card>
          <Card icon="🎁" title="Daily Drops">
            XP + Hashes every 24 hours. Compound with streak bonuses.
          </Card>
          <Card icon="🧵" title="Threads">
            Lesson currency. Regenerates over time. Forces deliberate practice.
          </Card>
          <Card icon="⚡" title="Themes">
            Unlock custom UI themes with Hashes. Make it yours.
          </Card>
        </div>
      </Section>

      {/* Install / Get the App */}
      <Section>
        <h2
          style={{
            fontSize: 11,
            color: "#666",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 3,
            textAlign: "center",
            margin: "0 0 32px 0",
          }}
        >
          ── INSTALL THE APP ──
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {/* iOS */}
          <div
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍎</div>
            <h3
              style={{
                fontSize: 14,
                color: "#fff",
                fontFamily: "monospace",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
              }}
            >
              iOS · Safari
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                margin: "0 0 12px 0",
                lineHeight: 1.6,
              }}
            >
              Add to your home screen. Works fullscreen like a native app.
            </p>
            <button
              onClick={() => setShowIosInstructions(!showIosInstructions)}
              style={{
                width: "100%",
                padding: 10,
                background: "transparent",
                border: `1px solid ${accent}50`,
                color: accent,
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {showIosInstructions ? "▼ HIDE STEPS" : "▶ SHOW STEPS"}
            </button>
            {showIosInstructions && (
              <ol
                style={{
                  marginTop: 12,
                  paddingLeft: 20,
                  fontSize: 12,
                  color: "#ccc",
                  lineHeight: 1.8,
                  fontFamily: "monospace",
                }}
              >
                <li>Open this page in Safari</li>
                <li>Tap the Share icon (square + ↑)</li>
                <li>Scroll down → "Add to Home Screen"</li>
                <li>Tap "Add" — done</li>
              </ol>
            )}
          </div>

          {/* Android */}
          <div
            style={{
              background: "#0a0a0a",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <h3
              style={{
                fontSize: 14,
                color: "#fff",
                fontFamily: "monospace",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
              }}
            >
              Android · APK
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                margin: "0 0 12px 0",
                lineHeight: 1.6,
              }}
            >
              Direct download. Sideload from GitHub Releases.
            </p>
            <a
              href="https://github.com/Variosity/hacklingo/releases/download/v3/hacklingo.apk"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                padding: 10,
                background: accent,
                color: "#000",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              ⬇ DOWNLOAD APK
            </a>
          </div>

          {/* Web */}
          <div
            style={{
              background: "#0a0a0a",
              border: `1px solid ${accent}40`,
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
            <h3
              style={{
                fontSize: 14,
                color: accent,
                fontFamily: "monospace",
                textTransform: "uppercase",
                margin: "0 0 8px 0",
              }}
            >
              Web · Right now
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                margin: "0 0 12px 0",
                lineHeight: 1.6,
              }}
            >
              Skip the install. Just sign up and start.
            </p>
            <button
              onClick={onEnterAuth}
              style={{
                width: "100%",
                padding: 10,
                background: accent,
                color: "#000",
                border: "none",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              SIGN UP →
            </button>
          </div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section style={{ textAlign: "center", paddingBottom: 80 }}>
        <h2
          style={{
            fontSize: "clamp(24px, 5vw, 36px)",
            color: "#fff",
            margin: "0 0 12px 0",
            fontFamily: "monospace",
            fontWeight: 900,
          }}
        >
          The only way out is <span style={{ color: accent }}>through</span>.
        </h2>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 32px 0" }}>
          Stop reading about hacking. Start doing it.
        </p>
        <button
          onClick={onEnterAuth}
          style={{
            padding: "16px 32px",
            background: accent,
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontWeight: 900,
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: 2,
            cursor: "pointer",
            boxShadow: `0 0 24px ${accent}40`,
          }}
        >
          ESTABLISH UPLINK
        </button>
      </Section>

      {/* Legal / Ethics Disclaimer */}
      <Section style={{ paddingTop: 0, paddingBottom: 32 }}>
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #facc1530",
            borderRadius: 12,
            padding: 20,
            fontFamily: "monospace",
            fontSize: 12,
            color: "#aaa",
            lineHeight: 1.7,
          }}
        >
          <div
            style={{
              color: "#facc15",
              fontWeight: "bold",
              marginBottom: 8,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            ⚠ Rules of Engagement
          </div>
          Hacklingo teaches offensive and defensive techniques for{" "}
          <strong style={{ color: "#fff" }}>
            educational, ethical, and authorized
          </strong>{" "}
          use only. Applying these techniques to systems, networks, or people
          you don't own or have explicit written permission to test is illegal
          in most jurisdictions and{" "}
          <strong style={{ color: "#fff" }}>can result in prosecution</strong>.
          We do not condone unauthorized access. Use what you learn here to
          defend, build, and harden — not to harm.
        </div>
      </Section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid #1a1a1a",
          padding: "32px 20px",
          textAlign: "center",
          fontSize: 11,
          color: "#444",
          fontFamily: "monospace",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          [ HACKLINGO · LEARN. PERSIST. PIVOT. ]
        </div>
        <div style={{ marginBottom: 8 }}>
          <a
            href="#"
            style={{ color: "#666", textDecoration: "none", margin: "0 8px" }}
          >
            Privacy
          </a>
          ·
          <a
            href="#"
            style={{ color: "#666", textDecoration: "none", margin: "0 8px" }}
          >
            Terms
          </a>
          ·
          <a
            href="https://github.com/Variosity/hacklingo"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#666", textDecoration: "none", margin: "0 8px" }}
          >
            GitHub
          </a>
        </div>
        <div style={{ color: "#333" }}>
          © 2026 Hacklingo. All operations classified.
        </div>
      </footer>

      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── ACHIEVEMENTS MODAL ─────────────────────────────────────────────────────
function AchievementsModal({ userState, onClose, theme }) {
  const unlocked = userState?.unlocked_achievements || [];
  const unlockedCount = ACHIEVEMENTS.filter((a) =>
    unlocked.includes(a.id),
  ).length;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}50`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 460,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 4 }}>🏆</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: theme.text,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            Achievements
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontFamily: "monospace",
              marginTop: 4,
            }}
          >
            <span style={{ color: theme.accent }}>{unlockedCount}</span> /{" "}
            {ACHIEVEMENTS.length} unlocked
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.includes(a.id);
            return (
              <div
                key={a.id}
                style={{
                  background: isUnlocked ? `${theme.accent}10` : "#0a0a0a",
                  border: isUnlocked
                    ? `1px solid ${theme.accent}50`
                    : "1px solid #2a2a2a",
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: isUnlocked ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    filter: isUnlocked ? "none" : "grayscale(1)",
                  }}
                >
                  {a.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      color: isUnlocked ? theme.accent : "#666",
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#888",
                      marginTop: 2,
                    }}
                  >
                    {a.desc}
                  </div>
                </div>
                {isUnlocked && (
                  <div style={{ fontSize: 14, color: "#00ff88" }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: 12,
            background: "transparent",
            border: `1px solid ${theme.accent}50`,
            color: theme.accent,
            borderRadius: 8,
            fontWeight: "bold",
            fontFamily: "monospace",
            cursor: "pointer",
            marginTop: 16,
          }}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}

// ── ONBOARDING SCREEN ──────────────────────────────────────────────────────
function OnboardingScreen({ userState, onComplete, theme }) {
  const [step, setStep] = useState(0);

  const slides = [
    {
      icon: "📟",
      title: `Welcome, ${userState?.username || "operator"}`,
      body: "Hacklingo is your daily training ground for cybersecurity. 5-minute missions. Real skills. Zero fluff.",
      cta: "BRIEFING →",
    },
    {
      icon: "🧵",
      title: "Threads = Energy",
      body: "Every lesson costs Threads. You start with 22 and regenerate 1 every 3 hours. Train deliberately — Threads force you to focus.",
      cta: "GOT IT →",
    },
    {
      icon: "🔥",
      title: "Persistence Streaks",
      body: "Train every day to build your streak. Miss a day and it breaks. Burner Phones can save you once. Streaks are your discipline made visible.",
      cta: "UNDERSTOOD →",
    },
    {
      icon: "🎯",
      title: "Rank Up",
      body: "Earn XP from missions. Climb from Ghost → Initiate → Operative → Phantom → Infiltrator → Grandmaster. Hashes let you customize your loadout.",
      cta: "LET'S GO →",
    },
    {
      icon: "🗺️",
      title: "Choose Your Path",
      body: "Soon you'll pick a team alignment — Red (offense), Blue (defense), or Purple (both). It changes your missions and your squad matching.",
      cta: "INITIATE OPERATION",
    },
  ];

  const current = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 24,
        paddingTop: "env(safe-area-inset-top, 24px)",
        paddingBottom: "env(safe-area-inset-bottom, 24px)",
      }}
    >
      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i <= step ? theme.accent : "#333",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 400,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 24 }}>{current.icon}</div>
        <h2
          style={{
            fontSize: 28,
            color: theme.text,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 1,
            margin: "0 0 16px 0",
          }}
        >
          {current.title}
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "#aaa",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {current.body}
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          gap: 12,
          marginTop: 32,
        }}
      >
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              padding: "16px 20px",
              background: "transparent",
              border: "1px solid #333",
              color: "#888",
              borderRadius: 8,
              fontFamily: "monospace",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ←
          </button>
        )}
        <button
          onClick={() => {
            if (isLast) onComplete();
            else setStep((s) => s + 1);
          }}
          style={{
            flex: 1,
            padding: "16px 20px",
            background: theme.accent,
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontWeight: 900,
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: 1,
            cursor: "pointer",
            boxShadow: `0 0 24px ${theme.accent}40`,
          }}
        >
          {current.cta}
        </button>
      </div>

      {!isLast && (
        <button
          onClick={onComplete}
          style={{
            marginTop: 16,
            background: "none",
            border: "none",
            color: "#555",
            fontFamily: "monospace",
            fontSize: 11,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Skip briefing
        </button>
      )}
    </div>
  );
}

function PasswordResetModal({ onClose, theme }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    // Because the user arrived via a recovery link, they are temporarily authenticated.
    // We can directly call updateUser to overwrite their password.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Uplink secured. Password successfully updated.");
      setTimeout(() => {
        onClose();
      }, 2500); // Auto-close after 2.5 seconds
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 350,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 16 }}>🔐</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: theme.text,
            fontFamily: "monospace",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Initialize New Password
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>
          Enter a secure password to restore access to your operator terminal.
        </div>

        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            background: theme.bg,
            border: "1px solid #333",
            color: theme.text,
            borderRadius: 8,
            fontFamily: "monospace",
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleUpdatePassword}
          disabled={loading || !newPassword}
          style={{
            width: "100%",
            padding: 12,
            background: loading || !newPassword ? "#333" : theme.accent,
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: loading || !newPassword ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "ENCRYPTING..." : "UPDATE CREDENTIALS"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: message.includes("Error") ? "#ef4444" : "#00ff88",
              fontFamily: "monospace",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillTreeScreen({ userState, curriculum, theme, onOpenLesson }) {
  if (!userState || !curriculum.length) return null;
  const [briefingMission, setBriefingMission] = useState(null);
  const activeCurriculum = curriculum.filter(
    (track) => !track.pathLock || track.pathLock === userState.path,
  );

  return (
    <div style={{ padding: "56px 16px 80px" }}>
      <div
        style={{
          fontSize: 22,
          color: theme.text,
          marginBottom: 20,
          fontWeight: "bold",
        }}
      >
        Mission Tree
      </div>
      {activeCurriculum.map((track) => {
        const completedInTrack = track.modules.filter((m) =>
          userState.completedModules.includes(m.id),
        ).length;
        const trackDone = completedInTrack === track.modules.length;

        return (
          <div
            key={track.id}
            style={{
              marginBottom: 12,
              background: theme.surface,
              border: `1px solid ${track.color}${trackDone ? "20" : "50"}`,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  filter: trackDone ? "grayscale(100%)" : "none",
                }}
              >
                {track.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    color: trackDone ? "#666" : theme.text,
                    fontWeight: "bold",
                  }}
                >
                  {track.title}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: trackDone ? "#444" : track.color,
                  }}
                >
                  {completedInTrack}/{track.modules.length} COMPLETE
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {track.modules.map((mod) => {
                const isDone = userState.completedModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    onClick={() => setBriefingMission(mod)}
                    style={{
                      padding: "10px",
                      background: isDone ? theme.bg : "rgba(255,255,255,0.02)",
                      borderRadius: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      cursor: isDone ? "default" : "pointer",
                      border: `1px solid ${isDone ? theme.accent + "20" : "transparent"}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: isDone ? "#555" : "#ccc",
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {mod.type === "boss" ? "💀 " : ""}
                      {mod.title}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 2,
                        flexShrink: 0,
                        minWidth: 60,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: isDone ? "#333" : "#facc15",
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isDone ? "✓ DONE" : `+${mod.xp} XP`}
                      </span>
                      {!isDone && (
                        <span
                          style={{
                            fontSize: 9,
                            color: "#ef4444",
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          -{getThreadCost(mod)} 🧵
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {briefingMission && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.accent}60`,
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: theme.accent,
                fontFamily: "monospace",
                letterSpacing: 2,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              ⚡ Target Acquired
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: theme.text,
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              {briefingMission.title}
            </div>
            <div
              style={{
                background: theme.bg,
                padding: 10,
                borderRadius: 6,
                marginBottom: 16,
                fontFamily: "monospace",
                fontSize: 12,
                color: "#888",
                border: "1px solid #222",
              }}
            >
              {briefingMission.type === "boss"
                ? "⚠️ BOSS MISSION: Advanced Threat Simulation. Failure is permanent until retry."
                : briefingMission.type === "project"
                  ? "🔧 PROJECT: Build a real tool. No shortcuts."
                  : "Standard training module. Execute with precision."}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: `1px solid ${theme.bg}`,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  XP Yield
                </div>
                <div
                  style={{
                    color: "#facc15",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  +{briefingMission.xp}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Hash Bounty
                </div>
                <div
                  style={{
                    color: theme.accent,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  +{Math.round(briefingMission.xp / 2)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Thread Cost
                </div>
                <div
                  style={{
                    color: "#ef4444",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  -{getThreadCost(briefingMission)} 🧵
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setBriefingMission(null)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "transparent",
                  border: "1px solid #444",
                  color: "#888",
                  borderRadius: 6,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                ABORT
              </button>
              <button
                onClick={() => {
                  onOpenLesson(briefingMission);
                  setBriefingMission(null);
                }}
                style={{
                  flex: 2,
                  padding: 12,
                  background: theme.accent,
                  border: "none",
                  color: "#000",
                  borderRadius: 6,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "monospace",
                }}
              >
                {userState.completedModules?.includes(briefingMission.id)
                  ? "↺ REDO MISSION"
                  : "▶ INITIATE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── E2EE CRYPTO ENGINE (AES-GCM) ────────────────────────────────────────────
const CryptoUtils = {
  deriveKey: async (secret) => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("hackpath-squad-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  },
  encrypt: async (text, secret) => {
    const key = await CryptoUtils.deriveKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(text),
    );
    const ivHex = Array.from(iv)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const cipherHex = Array.from(new Uint8Array(ciphertext))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${ivHex}:${cipherHex}`;
  },
  decrypt: async (hash, secret) => {
    try {
      if (!hash.includes(":")) return hash; // Fallback if a plaintext message slips through
      const [ivHex, cipherHex] = hash.split(":");
      const iv = new Uint8Array(
        ivHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)),
      );
      const cipherBytes = new Uint8Array(
        cipherHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)),
      );
      const key = await CryptoUtils.deriveKey(secret);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes,
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      return "🔒 [DECRYPTION FAILED - INVALID KEY]";
    }
  },
};

// ── SQUADS SYSTEM (REAL-TIME E2EE) ──────────────────────────────────────────
function SquadScreen({ userState, theme }) {
  const [squadData, setSquadData] = useState(null);
  const [squadMembers, setSquadMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshToggle, setRefreshToggle] = useState(0);

  // Key Management
  const [missingKeyInput, setMissingKeyInput] = useState("");

  // Forms
  const [joinCode, setJoinCode] = useState("");
  const [joinKey, setJoinKey] = useState("");
  const [createName, setCreateName] = useState("");
  const [createKey, setCreateKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const SQUAD_COST = 5000;
  const messagesEndRef = useRef(null);
  const [selectedMember, setSelectedMember] = useState(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let activeChannel = null;

    async function fetchSquadData() {
      setLoading(true);
      setErrorMsg("");

      const { data: members, error: fetchErr } = await supabase
        .from("squad_members")
        .select("squad_id, role, squads(*)")
        .eq("user_id", userState.id)
        .limit(1);

      if (fetchErr) {
        setErrorMsg(`Database Error: ${fetchErr.message}`);
        setLoading(false);
        return;
      }

      if (members && members.length > 0) {
        const memberData = members[0];
        setSquadData(memberData);

        const localKey = localStorage.getItem(
          `squad_key_${memberData.squad_id}`,
        );

        const { data: roster } = await supabase
          .from("squad_members")
          .select("role, profiles(username, xp, path_alignment)")
          .eq("squad_id", memberData.squad_id);

        if (roster) {
          setSquadMembers(roster);
          memberData.squads.calculated_xp = roster.reduce(
            (sum, m) => sum + (m.profiles?.xp || 0),
            0,
          );
        }

        const { data: msgHistory } = await supabase
          .from("squad_messages")
          .select("*")
          .eq("squad_id", memberData.squad_id)
          .order("created_at", { ascending: false })
          .limit(300); // 300 payloads guarantees all-day persistence without date-math crashes

        if (msgHistory && localKey) {
          const decryptedHistory = await Promise.all(
            msgHistory.reverse().map(async (msg) => ({
              ...msg,
              content: await CryptoUtils.decrypt(msg.content, localKey),
            })),
          );
          setMessages(decryptedHistory);
        } else if (msgHistory && !localKey) {
          // If they logged in on a new device, show encrypted payloads
          setMessages(msgHistory.reverse());
        }

        activeChannel = supabase
          .channel(`squad_${memberData.squad_id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "squad_messages",
              filter: `squad_id=eq.${memberData.squad_id}`,
            },
            async (payload) => {
              const currentLocalKey = localStorage.getItem(
                `squad_key_${memberData.squad_id}`,
              );
              const content = currentLocalKey
                ? await CryptoUtils.decrypt(
                    payload.new.content,
                    currentLocalKey,
                  )
                : payload.new.content; // Show raw cipher if no key

              setMessages((prev) => [...prev, { ...payload.new, content }]);
            },
          )
          .subscribe();
      } else {
        setSquadData(null);
      }
      setLoading(false);
    }

    if (userState.path !== "unassigned") {
      fetchSquadData();
      const refreshInterval = setInterval(fetchSquadData, 30000);
      return () => {
        if (activeChannel) supabase.removeChannel(activeChannel);
        clearInterval(refreshInterval);
      };
    }
    return () => {
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, [userState, refreshToggle]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !squadData) return;

    const textToSend = chatInput.trim();
    setChatInput("");

    const localKey = localStorage.getItem(`squad_key_${squadData.squad_id}`);
    if (!localKey) return alert("E2E Key missing. Cannot encrypt message.");

    const encryptedPayload = await CryptoUtils.encrypt(textToSend, localKey);

    await supabase.from("squad_messages").insert([
      {
        squad_id: squadData.squad_id,
        user_id: userState.id,
        username: userState.username,
        content: encryptedPayload,
      },
    ]);
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Purge this payload from the network?")) return;

    // Optimistic UI update
    setMessages(messages.filter((m) => m.id !== msgId));

    // Delete from DB
    await supabase.from("squad_messages").delete().eq("id", msgId);
  };

  const handleCreate = async () => {
    setErrorMsg("");
    if (!createName || !createKey)
      return setErrorMsg("Designation and E2E Key required.");

    // Allow Admins to bypass the 5,000 Hash cost
    if (userState.role !== "admin" && userState.hashes < SQUAD_COST) {
      return setErrorMsg(
        `Insufficient funds. Requires ${SQUAD_COST.toLocaleString()} Hashes.`,
      );
    }

    const code =
      "SQD-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: newSquad, error: sqErr } = await supabase
      .from("squads")
      .insert([
        { name: createName, path_alignment: userState.path, invite_code: code },
      ])
      .select()
      .single();

    if (sqErr) {
      if (sqErr.message.includes("unique constraint"))
        return setErrorMsg("That designation is already taken.");
      return setErrorMsg("Network error. Could not establish squad.");
    }

    const { error: memErr } = await supabase
      .from("squad_members")
      .insert([
        { squad_id: newSquad.id, user_id: userState.id, role: "leader" },
      ]);

    if (memErr) {
      await supabase.from("squads").delete().eq("id", newSquad.id);
      return setErrorMsg("Authorization failed. Network aborted.");
    }

    if (userState.role !== "admin") {
      const newHashes = userState.hashes - SQUAD_COST;
      await supabase
        .from("profiles")
        .update({ hashes: newHashes })
        .eq("id", userState.id);
    }

    localStorage.setItem(`squad_key_${newSquad.id}`, createKey);
    setRefreshToggle((prev) => prev + 1); // Trigger instant React re-render
  };

  const handleJoin = async () => {
    setErrorMsg("");
    if (!joinCode || !joinKey)
      return setErrorMsg("Invite code and E2E Key required.");

    const { data: targetSquad, error: findErr } = await supabase
      .from("squads")
      .select("*")
      .eq("invite_code", joinCode.toUpperCase())
      .single();

    if (findErr || !targetSquad)
      return setErrorMsg("Invalid or expired invite code.");

    // Purple Team can join Red or Blue squads
    if (
      userState.path !== "purple" &&
      targetSquad.path_alignment !== userState.path
    ) {
      return setErrorMsg(
        `Alignment mismatch. Requires ${targetSquad.path_alignment.toUpperCase()}.`,
      );
    }

    const { error: joinErr } = await supabase
      .from("squad_members")
      .insert([
        { squad_id: targetSquad.id, user_id: userState.id, role: "member" },
      ]);

    if (joinErr) return setErrorMsg("Failed to join. Already in a squad?");

    localStorage.setItem(`squad_key_${targetSquad.id}`, joinKey);
    setRefreshToggle((prev) => prev + 1);
  };

  const handleDisband = async () => {
    if (
      !window.confirm(
        "WARNING: This will permanently delete the squad and purge all encrypted comms. Proceed?",
      )
    )
      return;

    const { error } = await supabase
      .from("squads")
      .delete()
      .eq("id", squadData.squad_id);

    if (!error) {
      localStorage.removeItem(`squad_key_${squadData.squad_id}`);
      setRefreshToggle((prev) => prev + 1);
    } else {
      alert("Failed to disband network.");
    }
  };

  const handleSaveMissingKey = () => {
    if (!missingKeyInput.trim()) return;
    localStorage.setItem(
      `squad_key_${squadData.squad_id}`,
      missingKeyInput.trim(),
    );
    setMissingKeyInput("");
    setRefreshToggle((p) => p + 1); // Refresh chat to trigger decryption
  };

  const handleResetKey = () => {
    if (
      window.confirm(
        "Purge current E2E key from this device? You will need to re-enter it to read comms.",
      )
    ) {
      localStorage.removeItem(`squad_key_${squadData.squad_id}`);
      setRefreshToggle((p) => p + 1);
    }
  };

  if (userState.path === "unassigned") {
    return (
      <div
        style={{
          padding: "24px 16px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh",
          color: "#555",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div>Align your path in Phase 3 to unlock Squad comms.</div>
      </div>
    );
  }

  const hasLocalKey = squadData
    ? !!localStorage.getItem(`squad_key_${squadData.squad_id}`)
    : false;

  return (
    <div style={{ padding: "24px 16px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Tactical Network
        </div>
        <div style={{ fontSize: 22, color: theme.text, fontWeight: "bold" }}>
          Squad Comms
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.accent, fontFamily: "monospace" }}>
          [ ESTABLISHING PEER-TO-PEER... ]
        </div>
      ) : squadData ? (
        <div className="desktop-grid">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              flex: 1,
              marginBottom: 24,
            }}
          >
            {/* Squad Info Card */}
            <div
              style={{
                background: theme.surface,
                padding: 20,
                borderRadius: 12,
                border: `1px solid ${PATHS[squadData.squads.path_alignment].color}50`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: theme.text,
                      marginBottom: 4,
                    }}
                  >
                    {squadData.squads.name}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#888", marginBottom: 20 }}
                  >
                    Alignment: {PATHS[squadData.squads.path_alignment].label}
                  </div>
                </div>
                {hasLocalKey && (
                  <button
                    onClick={handleResetKey}
                    style={{
                      background: "transparent",
                      border: "1px solid #444",
                      color: "#888",
                      padding: "6px 10px",
                      borderRadius: 4,
                      fontSize: 10,
                      cursor: "pointer",
                    }}
                  >
                    RESET KEY
                  </button>
                )}
              </div>

              <div
                style={{
                  background: theme.bg,
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#888",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Invite Code
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: theme.accent,
                    fontFamily: "monospace",
                    letterSpacing: 2,
                  }}
                >
                  {squadData.squads.invite_code}
                </div>
              </div>
              <div
                style={{
                  color: "#facc15",
                  fontFamily: "monospace",
                  marginBottom: 16,
                }}
              >
                Collective XP:{" "}
                {squadData.squads.calculated_xp?.toLocaleString() || 0}
              </div>

              {squadData.role === "leader" && (
                <button
                  onClick={handleDisband}
                  style={{
                    width: "100%",
                    padding: 10,
                    background: "transparent",
                    border: "1px dashed #ef4444",
                    color: "#ef4444",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  [ DISBAND NETWORK ]
                </button>
              )}
            </div>

            {/* Roster Card */}
            <div
              style={{
                background: theme.surface,
                padding: 20,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: theme.text,
                  fontWeight: "bold",
                  marginBottom: 16,
                }}
              >
                Operative Roster ({squadMembers.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {squadMembers.map((m, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedMember(m.profiles)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px",
                      background: theme.bg,
                      borderRadius: 8,
                      cursor: "pointer",
                      border:
                        m.profiles.username === userState.username
                          ? `1px solid ${theme.accent}40`
                          : "none",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          color: m.role === "leader" ? "#facc15" : theme.text,
                          fontWeight: "bold",
                        }}
                      >
                        {m.profiles.username} {m.role === "leader" && "👑"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#888",
                          fontFamily: "monospace",
                        }}
                      >
                        {m.profiles.xp.toLocaleString()} XP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Window */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: theme.surface,
              borderRadius: 12,
              border: `1px solid ${theme.accent}30`,
              height: "60vh",
              minHeight: "400px",
              flex: 1.5,
            }}
          >
            <div
              style={{
                padding: "16px",
                borderBottom: `1px solid ${theme.bg}`,
                fontSize: 14,
                fontWeight: "bold",
                color: theme.accent,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🔒 E2EE Comms (Live)
            </div>

            <div
              style={{
                flex: 1,
                padding: "16px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color: "#555",
                    textAlign: "center",
                    marginTop: 20,
                    fontSize: 12,
                  }}
                >
                  No secured comms intercepted yet.
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.user_id === userState.id;
                const isEncryptedRaw = msg.content.includes(":"); // Rough check if it's raw ciphertext

                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isMe ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#888",
                        marginBottom: 4,
                        textAlign: isMe ? "right" : "left",
                        fontFamily: "monospace",
                      }}
                    >
                      {msg.username}
                      {isMe && (
                        <span
                          onClick={() => handleDeleteMessage(msg.id)}
                          style={{
                            marginLeft: 8,
                            color: "#ef4444",
                            cursor: "pointer",
                          }}
                        >
                          [x]
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        background: isMe ? theme.accent + "20" : theme.bg,
                        border: `1px solid ${isMe ? theme.accent : "#333"}`,
                        color: isMe ? theme.accent : theme.text,
                        padding: "10px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        wordBreak: "break-word",
                      }}
                    >
                      {isEncryptedRaw ? (
                        <span style={{ color: "#ef4444" }}>
                          [ENCRYPTED PAYLOAD]
                        </span>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Invisible div to anchor the auto-scroll */}
              <div ref={messagesEndRef} />
            </div>

            {hasLocalKey ? (
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: "16px",
                  borderTop: `1px solid ${theme.bg}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Encrypt payload..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "44px",
                      margin: 0,
                      padding: "0 14px",
                      background: theme.bg,
                      border: "1px solid #333",
                      color: theme.text,
                      borderRadius: 8,
                      outline: "none",
                      fontFamily: "monospace",
                      fontSize: 16,
                      boxSizing: "border-box",
                      WebkitAppearance: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    style={{
                      flexShrink: 0,
                      height: "44px",
                      padding: "0 24px",
                      margin: 0,
                      background: chatInput.trim() ? theme.accent : "#333",
                      color: "#000",
                      fontWeight: "bold",
                      border: "none",
                      borderRadius: 8,
                      cursor: chatInput.trim() ? "pointer" : "not-allowed",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                      WebkitAppearance: "none",
                    }}
                  >
                    SEND
                  </button>
                </div>
              </form>
            ) : (
              <div
                style={{
                  padding: "16px",
                  borderTop: `1px solid ${theme.bg}`,
                  background: "rgba(239, 68, 68, 0.1)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#ef4444",
                    marginBottom: 8,
                    fontWeight: "bold",
                  }}
                >
                  ⚠️ KEY REQUIRED TO DECRYPT
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <input
                    type="password"
                    value={missingKeyInput}
                    onChange={(e) => setMissingKeyInput(e.target.value)}
                    placeholder="Enter E2E Key..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "44px",
                      margin: 0,
                      padding: "0 14px",
                      background: theme.bg,
                      border: "1px solid #ef4444",
                      color: theme.text,
                      borderRadius: 8,
                      outline: "none",
                      fontFamily: "monospace",
                      fontSize: 16,
                      boxSizing: "border-box",
                      WebkitAppearance: "none",
                    }}
                  />
                  <button
                    onClick={handleSaveMissingKey}
                    style={{
                      flexShrink: 0,
                      height: "44px",
                      padding: "0 24px",
                      margin: 0,
                      background: "#ef4444",
                      color: "#000",
                      fontWeight: "bold",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box",
                      WebkitAppearance: "none",
                    }}
                  >
                    UNLOCK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="desktop-grid">
          <div
            style={{
              background: theme.surface,
              padding: 20,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ color: theme.text, marginTop: 0 }}>
              Establish a Squad
            </h3>
            <div
              style={{
                fontSize: 11,
                color: "#facc15",
                marginBottom: 16,
                fontFamily: "monospace",
              }}
            >
              COST: {SQUAD_COST.toLocaleString()} HASHES
            </div>
            <input
              type="text"
              placeholder="SQUAD DESIGNATION"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                background: theme.bg,
                border: "1px solid #444",
                color: theme.text,
                borderRadius: 4,
                marginBottom: 12,
                outline: "none",
              }}
            />
            <input
              type="password"
              placeholder="CREATE E2E KEY (GIVE TO SQUAD)"
              value={createKey}
              onChange={(e) => setCreateKey(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                background: theme.bg,
                border: `1px solid ${theme.accent}50`,
                color: theme.accent,
                borderRadius: 4,
                marginBottom: 12,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreate}
              style={{
                width: "100%",
                padding: 10,
                background: theme.accent,
                color: "#000",
                fontWeight: "bold",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              CREATE NETWORK
            </button>
          </div>

          <div
            style={{
              background: theme.surface,
              padding: 20,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <h3 style={{ color: theme.text, marginTop: 0 }}>Join a Squad</h3>
            <div
              style={{
                fontSize: 11,
                color: "#888",
                marginBottom: 16,
                fontFamily: "monospace",
              }}
            >
              ENTER SECURE UPLINK DATA
            </div>
            <input
              type="text"
              placeholder="INVITE CODE (SQD-...)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                background: theme.bg,
                border: "1px solid #444",
                color: theme.text,
                borderRadius: 4,
                marginBottom: 12,
                outline: "none",
                textTransform: "uppercase",
              }}
            />
            <input
              type="password"
              placeholder="ENTER E2E KEY"
              value={joinKey}
              onChange={(e) => setJoinKey(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                background: theme.bg,
                border: `1px solid ${theme.accent}50`,
                color: theme.accent,
                borderRadius: 4,
                marginBottom: 12,
                outline: "none",
              }}
            />
            <button
              onClick={handleJoin}
              style={{
                width: "100%",
                padding: 10,
                background: "#222",
                color: theme.text,
                fontWeight: "bold",
                border: "1px solid #444",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              JOIN NETWORK
            </button>
          </div>
          {errorMsg && (
            <div
              style={{
                color: "#ef4444",
                fontSize: 12,
                fontFamily: "monospace",
                textAlign: "center",
                gridColumn: "1 / -1",
                marginTop: 16,
              }}
            >
              [ERROR] {errorMsg}
            </div>
          )}
        </div>
      )}

      {selectedMember && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setSelectedMember(null)}
        >
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.accent}40`,
              borderRadius: 12,
              width: "100%",
              maxWidth: 320,
              padding: 24,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMember(null)}
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                background: "none",
                border: "none",
                color: "#888",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>
                {getRank(selectedMember.xp).icon}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: theme.text,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {selectedMember.username}
                {selectedMember.role === "admin" && (
                  <span
                    style={{
                      padding: "2px 6px",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                      borderRadius: 4,
                      fontSize: 10,
                      letterSpacing: 1,
                    }}
                  >
                    ROOT
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: theme.accent,
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                {getRank(selectedMember.xp).name}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: theme.bg,
                  padding: 12,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    color: "#facc15",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedMember.xp.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Total XP
                </div>
              </div>
              <div
                style={{
                  background: theme.bg,
                  padding: 12,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    color:
                      PATHS[selectedMember.path_alignment]?.color || "#888",
                    fontWeight: "bold",
                  }}
                >
                  {PATHS[selectedMember.path_alignment]?.emoji || "👤"}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  {PATHS[selectedMember.path_alignment]?.label || "Unassigned"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BLACK MARKET (STORE) ────────────────────────────────────────────────────
function BlackMarketScreen({
  userState,
  theme,
  onPurchase,
  onEquipTheme,
  onActivateOverclock,
}) {
  if (!userState) return null;

  // Bulletproof fallbacks to prevent render crashes on old accounts
  const hashes = userState.hashes || 0;
  const burners = userState.burner_phones || 0;
  const overclocks = userState.overclock_tokens || 0;

  // Force it into an array to guarantee .includes() won't panic
  let unlockedList = ["default"];
  if (Array.isArray(userState.unlocked_themes)) {
    unlockedList = userState.unlocked_themes;
  } else if (typeof userState.unlocked_themes === "string") {
    unlockedList = [userState.unlocked_themes];
  }

  const activeThemeId = userState.active_theme || "default";

  return (
    <div style={{ padding: "56px 16px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Underground Exchange
        </div>
        <div style={{ fontSize: 22, color: theme.text, fontWeight: "bold" }}>
          The Black Market
        </div>
        <div
          style={{
            fontSize: 14,
            color: theme.accent,
            marginTop: 8,
            fontFamily: "monospace",
          }}
        >
          Balance: {hashes.toLocaleString()} Hashes
        </div>
      </div>

      {!userState.is_supporter && (
        <div
          style={{
            background: "linear-gradient(45deg, #111, #2a0a2a)",
            border: "1px solid #a855f7",
            padding: 20,
            borderRadius: 12,
            marginBottom: 24,
            marginTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#a855f7",
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            💎 Root Access ($2.99/mo)
          </div>
          <ul
            style={{
              color: "#ccc",
              fontSize: 12,
              paddingLeft: 20,
              marginBottom: 16,
            }}
          >
            <li>Unlimited Threads (Never wait to execute).</li>
            <li>Zero Advertisements.</li>
            <li>Supports platform server costs.</li>
          </ul>
          <button
            onClick={() =>
              window.open(
                `https://buy.stripe.com/4gM28t0ne9jIgJd2Sf38400?client_reference_id=${userState.id}`,
                "_blank",
              )
            }
            style={{
              width: "100%",
              padding: 12,
              background: "#a855f7",
              color: "#fff",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            UPGRADE CLEARANCE
          </button>
        </div>
      )}

      <h3
        style={{
          color: theme.text,
          borderBottom: `1px solid ${theme.surface}`,
          paddingBottom: 8,
        }}
      >
        Consumables
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Burner Phone */}
        <div
          style={{
            background: theme.surface,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #333",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: 14, color: theme.text, fontWeight: "bold" }}>
            Burner Phone
          </div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 12 }}>
            Max capacity: 3. Saves Persistence.
          </div>
          <button
            onClick={() => onPurchase("burner", 1200)}
            disabled={hashes < 1200 || burners >= 3}
            style={{
              width: "100%",
              padding: 8,
              background: hashes >= 1200 && burners < 3 ? theme.accent : "#222",
              border: "none",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: hashes >= 1200 && burners < 3 ? "pointer" : "not-allowed",
            }}
          >
            {burners >= 3 ? "MAX REACHED" : "1,200 Hashes"}
          </button>
          <div style={{ fontSize: 10, color: theme.accent, marginTop: 8 }}>
            Owned: {burners}/3
          </div>
        </div>
        {/* Threads Recharge */}
        <div
          style={{
            background: theme.surface,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #333",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧵</div>
          <div style={{ fontSize: 14, color: theme.text, fontWeight: "bold" }}>
            Buy Threads
          </div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 12 }}>
            Instantly recover +5 Threads to keep grinding.
          </div>
          <button
            onClick={() => onPurchase("threads", 600)}
            disabled={hashes < 600 || userState.threads >= 22}
            style={{
              width: "100%",
              padding: 8,
              background:
                hashes >= 600 && userState.threads < 22 ? theme.accent : "#222",
              border: "none",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 4,
              cursor:
                hashes >= 600 && userState.threads < 22
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {userState.threads >= 22 ? "FULL ENERGY" : "500 Hashes"}
          </button>
          <div style={{ fontSize: 10, color: theme.accent, marginTop: 8 }}>
            Threads: {userState.threads}/22
          </div>
        </div>
        {/* Overclock */}
        <div
          style={{
            background: theme.surface,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #333",
            textAlign: "center",
            gridColumn: "span 2",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 14, color: theme.text, fontWeight: "bold" }}>
            Overclock
          </div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>
            2x XP and Hashes for the next 24 hours.
          </div>
          <button
            onClick={() => onPurchase("overclock", 2400)}
            disabled={hashes < 2400 || overclocks >= 6}
            style={{
              width: "100%",
              padding: 8,
              background: hashes >= 2400 ? theme.accent : "#222",
              border: "none",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 4,
              cursor: hashes >= 2400 ? "pointer" : "not-allowed",
            }}
          >
            2,400 Hashes
          </button>
          <div style={{ fontSize: 10, color: theme.accent, marginTop: 8 }}>
            Owned: {overclocks}/6
          </div>
          {overclocks > 0 && (
            <button
              onClick={onActivateOverclock} // Pass this down as a prop from App.jsx!
              style={{
                width: "100%",
                padding: 8,
                marginTop: 8,
                background: "#facc15",
                color: "#000",
                fontWeight: "bold",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              ACTIVATE (24H)
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          background: theme.surface,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #333",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🧊</div>
        <div style={{ fontSize: 14, color: theme.text, fontWeight: "bold" }}>
          Neural Backup
        </div>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 8 }}>
          Restore a lost streak. Max 3.
        </div>
        <button
          onClick={() => onPurchase("streak_restore", 3600)}
          disabled={hashes < 3600 || (userState.streak_restores || 0) >= 3}
          style={{
            width: "100%",
            padding: 8,
            background:
              hashes >= 3600 && (userState.streak_restores || 0) < 3
                ? theme.accent
                : "#222",
            border: "none",
            color: "#000",
            fontWeight: "bold",
            borderRadius: 4,
            cursor:
              hashes >= 3600 && (userState.streak_restores || 0) < 3
                ? "pointer"
                : "not-allowed",
          }}
        >
          {(userState.streak_restores || 0) >= 3
            ? "MAX REACHED"
            : "3,600 Hashes"}
        </button>
        <div style={{ fontSize: 10, color: theme.accent, marginTop: 8 }}>
          Owned: {userState.streak_restores || 0}/3
        </div>
        {(userState.streak_restores || 0) > 0 && (
          <button
            onClick={() => onPurchase("activate_streak_restore", 0)}
            disabled={userState.persistence_streak > 0}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 8,
              background:
                userState.persistence_streak === 0 ? "#22c55e" : "#444",
              color: "#fff",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              cursor:
                userState.persistence_streak === 0 ? "pointer" : "not-allowed",
            }}
          >
            RESTORE
          </button>
        )}
      </div>

      <h3
        style={{
          color: theme.text,
          borderBottom: `1px solid ${theme.surface}`,
          paddingBottom: 8,
        }}
      >
        Aesthetics (Themes)
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.values(THEMES).map((t) => {
          const isOwned = unlockedList.includes(t.id);
          const isActive = activeThemeId === t.id;

          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: theme.surface,
                padding: 12,
                borderRadius: 8,
                border: isActive ? `1px solid ${t.accent}` : "1px solid #222",
              }}
            >
              <div>
                <div
                  style={{ fontSize: 14, color: t.accent, fontWeight: "bold" }}
                >
                  {t.name}
                </div>
                {!isOwned && (
                  <div style={{ fontSize: 11, color: "#888" }}>
                    Cost: {t.cost.toLocaleString()} Hashes
                  </div>
                )}
              </div>
              {isActive ? (
                <div
                  style={{
                    fontSize: 11,
                    color: theme.accent,
                    padding: "6px 12px",
                    border: `1px solid ${theme.accent}`,
                    borderRadius: 4,
                  }}
                >
                  ACTIVE
                </div>
              ) : isOwned ? (
                <button
                  onClick={() => onEquipTheme(t.id)}
                  style={{
                    padding: "6px 12px",
                    background: "#222",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  EQUIP
                </button>
              ) : (
                <button
                  onClick={() => onPurchase(`theme_${t.id}`, t.cost)}
                  disabled={hashes < t.cost}
                  style={{
                    padding: "6px 12px",
                    background: hashes >= t.cost ? theme.accent : "#222",
                    color: "#000",
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: 4,
                    cursor: hashes >= t.cost ? "pointer" : "not-allowed",
                  }}
                >
                  BUY
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LEADERBOARD SCREEN ──────────────────────────────────────────────────────
function LeaderboardScreen({ userState, theme }) {
  const [boardType, setBoardType] = useState("operators"); // 'operators' or 'squads'
  const [opLeaderboard, setOpLeaderboard] = useState([]);
  const [squadLeaderboard, setSquadLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOp, setSelectedOp] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(null);

  useEffect(() => {
    async function fetchBoards() {
      setLoading(true);

      if (boardType === "operators") {
        const { data } = await supabase
          .from("profiles")
          .select(
            "username, xp, path_alignment, role, persistence_streak, is_supporter",
          )
          .order("xp", { ascending: false })
          .limit(50);
        if (data) setOpLeaderboard(data);
      } else {
        // Fetch from our new SQL View
        const { data } = await supabase
          .from("squad_leaderboard")
          .select("*, member_count")
          .limit(20);
        if (data) setSquadLeaderboard(data);
      }
      setLoading(false);
    }
    fetchBoards();
  }, [boardType]);

  return (
    <div style={{ padding: "24px 16px 80px" }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Global Ranking
        </div>
        <div
          style={{
            fontSize: 22,
            fontFamily: "'Courier New', monospace",
            color: theme.text,
            fontWeight: "bold",
          }}
        >
          Threat Board
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setBoardType("operators")}
          style={{
            flex: 1,
            padding: 12,
            background:
              boardType === "operators" ? theme.surface : "transparent",
            border: `1px solid ${boardType === "operators" ? theme.accent : "#333"}`,
            color: boardType === "operators" ? theme.accent : "#888",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          OPERATORS
        </button>
        <button
          onClick={() => setBoardType("squads")}
          style={{
            flex: 1,
            padding: 12,
            background: boardType === "squads" ? theme.surface : "transparent",
            border: `1px solid ${boardType === "squads" ? theme.accent : "#333"}`,
            color: boardType === "squads" ? theme.accent : "#888",
            borderRadius: 8,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          NETWORKS
        </button>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            color: theme.accent,
            fontFamily: "monospace",
            marginTop: 40,
          }}
        >
          [ FETCHING DATA... ]
        </div>
      ) : boardType === "operators" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opLeaderboard.map((operator, index) => {
            const rank = index + 1;
            const isMe = userState && operator.username === userState.username;
            const pathInfo = PATHS[operator.path_alignment] || PATHS.unassigned;

            let badge = "💀";
            let rankColor = "#555";
            let bgAlpha = "00";
            if (rank === 1) {
              badge = "🥇";
              rankColor = "#facc15";
              bgAlpha = "20";
            } else if (rank === 2) {
              badge = "🥈";
              rankColor = "#e2e8f0";
              bgAlpha = "10";
            } else if (rank === 3) {
              badge = "🥉";
              rankColor = "#ca8a04";
              bgAlpha = "10";
            }

            return (
              <div
                key={index}
                onClick={() => setSelectedOp({ ...operator, rankNum: rank })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  background: isMe
                    ? theme.surface
                    : `#${pathInfo.color.replace("#", "")}${bgAlpha}`,
                  border: `1px solid ${isMe ? theme.accent + "40" : "rgba(255,255,255,0.05)"}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    textAlign: "center",
                    color: rankColor,
                    fontSize: 14,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  #{rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      color: isMe ? theme.accent : theme.text,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {operator.username}
                    {operator.is_supporter && "💎"}
                    {operator.role === "admin" && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid #ef4444",
                          color: "#ef4444",
                          borderRadius: 4,
                          fontSize: 10,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        ROOT
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: pathInfo.color,
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {pathInfo.label}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: isMe ? theme.accent : "#facc15",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {operator.xp.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {squadLeaderboard.map((squad, index) => {
            const rank = index + 1;
            const pathInfo = PATHS[squad.path_alignment] || PATHS.unassigned;
            return (
              <div
                key={index}
                onClick={() => setSelectedNetwork(squad)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px",
                  background: theme.surface,
                  border: `1px solid ${pathInfo.color}40`,
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 28,
                    textAlign: "center",
                    color: "#888",
                    fontSize: 14,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  #{rank}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 16,
                      color: theme.text,
                      fontWeight: "bold",
                    }}
                  >
                    {squad.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: pathInfo.color,
                      fontFamily: "monospace",
                      textTransform: "uppercase",
                    }}
                  >
                    {pathInfo.label} NETWORK
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 16,
                      color: "#facc15",
                      fontWeight: "bold",
                      fontFamily: "monospace",
                    }}
                  >
                    {squad.total_xp.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    Collective XP
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OPERATOR PROFILE MODAL */}
      {selectedOp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedOp(null)}
        >
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.accent}50`,
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedOp(null)}
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                background: "none",
                border: "none",
                color: "#888",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>
                {getRank(selectedOp.xp).icon}
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: theme.text,
                  fontWeight: "bold",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {selectedOp.username} {selectedOp.is_supporter && "💎"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: theme.accent,
                  fontFamily: "monospace",
                  marginTop: 4,
                }}
              >
                {getRank(selectedOp.xp).name} (Rank #{selectedOp.rankNum})
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  background: theme.bg,
                  padding: 12,
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    color: "#facc15",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedOp.xp.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Total XP
                </div>
              </div>
              <div
                style={{
                  background: theme.bg,
                  padding: 12,
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    color: "#ef4444",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedOp.persistence_streak || 0}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Persistence
                </div>
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: PATHS[selectedOp.path_alignment]?.color || "#888",
                fontFamily: "monospace",
                padding: "8px",
                border: `1px dashed ${PATHS[selectedOp.path_alignment]?.color || "#888"}50`,
                borderRadius: 4,
              }}
            >
              ALIGNMENT:{" "}
              {PATHS[selectedOp.path_alignment]?.label?.toUpperCase() ||
                "UNASSIGNED"}
            </div>
          </div>
        </div>
      )}
      {selectedNetwork && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedNetwork(null)}
        >
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${PATHS[selectedNetwork.path_alignment]?.color || theme.accent}50`,
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedNetwork(null)}
              style={{
                position: "absolute",
                top: 12,
                right: 16,
                background: "none",
                border: "none",
                color: "#888",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>
                {PATHS[selectedNetwork.path_alignment]?.emoji || "🕸️"}
              </div>
              <div
                style={{ fontSize: 22, color: theme.text, fontWeight: "bold" }}
              >
                {selectedNetwork.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: PATHS[selectedNetwork.path_alignment]?.color || "#888",
                  fontFamily: "monospace",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {PATHS[selectedNetwork.path_alignment]?.label || "Rogue"}{" "}
                Network
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: theme.bg,
                  padding: 14,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    color: "#facc15",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedNetwork.total_xp?.toLocaleString() || 0}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Collective XP
                </div>
              </div>
              <div
                style={{
                  background: theme.bg,
                  padding: 14,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    color: theme.accent,
                    fontWeight: "bold",
                    fontFamily: "monospace",
                  }}
                >
                  {selectedNetwork.member_count || "—"}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#888",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Operators
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OperatorScreen({
  userState,
  setScreen,
  onSignOut,
  onAdminAction,
  onOpenAchievements,
  theme,
}) {
  if (!userState) return null;
  const rank = getRank(userState.xp);
  const pathInfo = PATHS[userState.path];
  const [newHandle, setNewHandle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");

  return (
    <div style={{ padding: "56px 16px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{rank.icon}</div>
        <div style={{ fontSize: 24, color: theme.text, fontWeight: "bold" }}>
          {userState.username}
        </div>
        <div
          style={{
            fontSize: 14,
            color: theme.accent,
            fontFamily: "monospace",
            marginTop: 4,
          }}
        >
          {userState.is_supporter ? "💎 SUPPORTER" : rank.name}
        </div>
      </div>

      <div
        style={{
          background: theme.surface,
          padding: 20,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.05)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "monospace",
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Service Record
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ color: "#888" }}>Total XP</span>
          <span style={{ color: "#facc15", fontFamily: "monospace" }}>
            {userState.xp.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span style={{ color: "#888" }}>Modules Cleared</span>
          <span style={{ color: theme.accent, fontFamily: "monospace" }}>
            {userState.completedModules?.length || 0}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Current Alignment</span>
          <span style={{ color: pathInfo.color, fontFamily: "monospace" }}>
            {pathInfo.label} {pathInfo.emoji}
          </span>
        </div>
      </div>

      {/* NEW: RANKS PREVIEW */}
      <h3
        style={{
          color: theme.text,
          borderBottom: `1px solid ${theme.surface}`,
          paddingBottom: 8,
          marginTop: 24,
        }}
      >
        Progression Tiers
      </h3>
      <div
        style={{
          background: theme.surface,
          borderRadius: 8,
          padding: 12,
          marginBottom: 24,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {RANKS.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: userState.xp >= r.min ? theme.text : "#555",
            }}
          >
            <span>
              {r.icon} {r.name}
            </span>
            <span style={{ fontFamily: "monospace" }}>
              {r.min.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => setScreen("choosePath")}
        style={{
          width: "100%",
          padding: 14,
          background: "transparent",
          border: `1px dashed ${pathInfo.color}50`,
          color: pathInfo.color,
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "monospace",
          marginBottom: 12,
        }}
      >
        [ REALIGN PATH ]
      </button>
      <button
        onClick={onSignOut}
        style={{
          width: "100%",
          padding: 14,
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid #ef444450",
          color: "#ef4444",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "monospace",
        }}
      >
        [ TERMINATE CONNECTION ]
      </button>

      {/* ── OPERATOR SETTINGS ────────────────────────────────────────── */}
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #333",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: theme.text,
            marginBottom: 16,
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          Uplink Settings
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="New Handle"
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 10,
              background: "#111",
              border: "1px solid #333",
              color: theme.text,
              borderRadius: 4,
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={async () => {
              if (!newHandle.trim()) {
                setUpdateMsg("Enter a new handle.");
                return;
              }
              const handleRegex = /^[a-zA-Z0-9_-]{3,16}$/;
              if (!handleRegex.test(newHandle)) {
                setUpdateMsg("3-16 chars. Letters, numbers, _ and - only.");
                return;
              }
              const { error } = await supabase
                .from("profiles")
                .update({ username: newHandle.trim() })
                .eq("id", userState.id);
              setUpdateMsg(error ? error.message : "Handle updated.");
              if (!error) setNewHandle("");
            }}
            style={{
              flexShrink: 0,
              padding: "0 16px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            UPDATE
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="email"
            placeholder="New Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 10,
              background: "#111",
              border: "1px solid #333",
              color: theme.text,
              borderRadius: 4,
              fontFamily: "monospace",
            }}
          />
          <button
            onClick={async () => {
              if (!newEmail.trim()) {
                setUpdateMsg("Enter a new email.");
                return;
              }
              const { error } = await supabase.auth.updateUser({
                email: newEmail.trim(),
              });
              setUpdateMsg(
                error ? error.message : "Confirmation link sent to new email.",
              );
              if (!error) setNewEmail("");
            }}
            style={{
              flexShrink: 0,
              padding: "0 16px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            UPDATE
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                setUpdateMsg("Not authenticated.");
                return;
              }
              const { error } = await supabase.auth.resetPasswordForEmail(
                user.email,
                { redirectTo: window.location.origin },
              );
              setUpdateMsg(
                error
                  ? error.message
                  : "Password reset link sent to your email.",
              );
            }}
            style={{
              flex: 1,
              padding: 10,
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            SEND PASSWORD RESET
          </button>
        </div>

        {updateMsg && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: theme.accent,
              fontFamily: "monospace",
            }}
          >
            {updateMsg}
          </div>
        )}
      </div>

      {/* ── ACHIEVEMENTS PROGRESS ──────────────────────────────────── */}
      <div
        onClick={onOpenAchievements}
        style={{
          marginTop: 24,
          padding: 16,
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.accent}30`,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: theme.accent,
              fontFamily: "monospace",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            🏆 Achievements
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontFamily: "monospace",
            }}
          >
            {userState.unlocked_achievements?.length || 0} /{" "}
            {ACHIEVEMENTS.length}
          </div>
        </div>
        <div
          style={{
            background: theme.bg,
            borderRadius: 4,
            height: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(
                ((userState.unlocked_achievements?.length || 0) /
                  ACHIEVEMENTS.length) *
                  100,
              )}%`,
              height: "100%",
              background: theme.accent,
              boxShadow: `0 0 8px ${theme.accent}`,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#666",
            marginTop: 8,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          Tap to view all badges →
        </div>
      </div>

      {/* ── REFERRAL CODE ──────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.accent}30`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: theme.accent,
            fontFamily: "monospace",
            marginBottom: 12,
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          🤝 Recruit Operators
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Share your code. They get{" "}
          <strong style={{ color: theme.accent }}>+200 XP / +100 Hashes</strong>{" "}
          on signup. You get the same when they finish their first lesson.
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: 12,
              background: "#0a0a0a",
              border: `1px dashed ${theme.accent}50`,
              borderRadius: 6,
              color: theme.accent,
              fontFamily: "monospace",
              fontSize: 14,
              letterSpacing: 2,
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {userState.referral_code || "—"}
          </div>
          <button
            onClick={async () => {
              const code = userState.referral_code;
              if (!code) {
                setUpdateMsg("⚠ No referral code yet — refresh and try again.");
                return;
              }
              const shareUrl = `${APP_URL}/?ref=${code}`;
              const shareText = `Join me on Hacklingo — Duolingo for hackers. Use my code ${code} for bonus XP. ${shareUrl}`;
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: "Join me on Hacklingo",
                    text: shareText,
                    url: shareUrl,
                  });
                } else {
                  await navigator.clipboard.writeText(shareText);
                  setUpdateMsg("✓ Referral link copied to clipboard.");
                  setTimeout(() => setUpdateMsg(""), 3000);
                }
              } catch (_) {
                /* user cancelled share, ignore */
              }
            }}
            style={{
              flexShrink: 0,
              padding: "12px 16px",
              background: theme.accent,
              color: "#000",
              border: "none",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            SHARE
          </button>
        </div>
        {userState.referral_count > 0 && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "#facc15",
              fontFamily: "monospace",
            }}
          >
            ⭐ {userState.referral_count} operator
            {userState.referral_count !== 1 ? "s" : ""} recruited
          </div>
        )}
      </div>

      {/* ── GDPR DATA EXPORT ───────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: theme.surface,
          borderRadius: 12,
          border: "1px solid #333",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#888",
            fontFamily: "monospace",
            marginBottom: 12,
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          🗂 Data & Privacy
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Export everything we store about you as JSON. Required under
          GDPR/CCPA.
        </div>
        <button
          onClick={() => {
            const exportData = {
              exported_at: new Date().toISOString(),
              source: "Hacklingo",
              profile: userState,
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `hacklingo-data-${userState.username}-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setUpdateMsg("✓ Data export downloaded.");
            setTimeout(() => setUpdateMsg(""), 3000);
          }}
          style={{
            width: "100%",
            padding: 12,
            background: "transparent",
            border: "1px solid #555",
            color: "#aaa",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 12,
          }}
        >
          ⬇ DOWNLOAD MY DATA
        </button>
      </div>

      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid rgba(239, 68, 68, 0.2)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#ef4444",
            fontFamily: "monospace",
            marginBottom: 12,
            fontWeight: "bold",
          }}
        >
          DANGER ZONE
        </div>
        <button
          onClick={async () => {
            if (
              window.confirm(
                "WARNING: This will permanently purge your Operator data. Proceed?",
              )
            ) {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              const API_URL = Capacitor.isNativePlatform()
                ? "https://hacklingo.tech/api/delete-account"
                : "/api/delete-account";

              await fetch(API_URL, {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              onSignOut();
            }
          }}
          style={{
            width: "100%",
            padding: 14,
            background: "transparent",
            border: "1px solid #ef444450",
            color: "#ef4444",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          [ INITIATE ACCOUNT PURGE ]
        </button>
      </div>

      {userState.role === "admin" && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px dashed #ef4444",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#ef4444",
              fontFamily: "monospace",
              marginBottom: 12,
              fontWeight: "bold",
            }}
          >
            [ ROOT ACCESS DETECTED ]
          </div>
          <button
            onClick={() => onAdminAction("xp")}
            style={{
              width: "100%",
              padding: 10,
              background: "#ef4444",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
              marginBottom: 8,
            }}
          >
            GRANT 10,000 XP & HASHES
          </button>
          <button
            onClick={() => onAdminAction("supporter")}
            style={{
              width: "100%",
              padding: 10,
              background: "#a855f7",
              color: "#fff",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            FORCE SUPPORTER STATUS
          </button>
        </div>
      )}
    </div>
  );
}

// ── DYNAMIC LESSON COMPONENT ────────────────────────────────────────────────
function DynamicLessonScreen({
  lessonMeta,
  userState,
  theme,
  onClose,
  onComplete,
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  // Hint system: track wrong attempts per question to ladder hint/reveal access
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [disabledOptions, setDisabledOptions] = useState([]);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [answerForcedReveal, setAnswerForcedReveal] = useState(false);

  useEffect(() => {
    // Validate that what Groq returned actually looks like a usable lesson.
    // Network blips can return partial JSON, empty code blocks, or only the
    // first 2 steps. We catch those here and either retry or surface a real error.
    const isValidLesson = (steps) => {
      if (!Array.isArray(steps)) return false;
      if (steps.length < 4) return false;
      const hasQuiz = steps.some((s) => s && s.type === "quiz");
      if (!hasQuiz) return false;
      // Reject any step where the code block is missing/effectively empty
      const hasBrokenCode = steps.some(
        (s) =>
          s &&
          s.type === "code" &&
          (!s.code || String(s.code).trim().length < 10),
      );
      if (hasBrokenCode) return false;
      return true;
    };

    async function fetchLesson(attempt = 0) {
      const MAX_RETRIES = 1;
      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const API_URL = Capacitor.isNativePlatform()
          ? "https://hacklingo.tech/api/generate-lesson"
          : "/api/generate-lesson";

        const response = await fetch(API_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            moduleTitle: lessonMeta.title,
            moduleType: lessonMeta.type,
            userLevel: getRank(userState.xp).name,
            userPath: userState.path,
            token: session?.access_token,
          }),
        });
        if (!response.ok) {
          let errDetail = `HTTP ${response.status}`;
          try {
            const j = await response.json();
            errDetail = j.error || errDetail;
          } catch (_) {}
          throw new Error(`Uplink rejected: ${errDetail}`);
        }
        const generatedContent = await response.json();

        if (!isValidLesson(generatedContent)) {
          if (attempt < MAX_RETRIES) {
            console.warn(
              `Lesson validation failed (got ${
                Array.isArray(generatedContent) ? generatedContent.length : 0
              } steps) — retrying...`,
            );
            return fetchLesson(attempt + 1);
          }
          throw new Error(
            "Briefing came back corrupted (network blip during generation). Try again.",
          );
        }

        setContent(generatedContent);
      } catch (err) {
        console.error("Lesson Gen Error:", err);
        setErrorMsg(err.message);
        setContent([
          {
            type: "concept",
            heading: "Transmission Failed",
            body: "Could not connect to the Instructor AI. " + err.message,
          },
          {
            type: "quiz",
            heading: "Diagnostics",
            question: "Acknowledge failure?",
            options: ["Yes"],
            correct: 0,
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [lessonMeta, userState]);

  if (loading)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: theme.bg,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.accent,
          fontFamily: "monospace",
        }}
      >
        [ GENERATING CUSTOM CURRICULUM... ]
      </div>
    );

  const current = content[step];

  const handleNext = () => {
    if (step === content.length - 1) onComplete(lessonMeta);
    else {
      setStep((s) => s + 1);
      setAnswered(false);
      setSelectedOption(null);
      setCodeInput("");
      setWrongAttempts(0);
      setDisabledOptions([]);
      setHintRevealed(false);
      setAnswerForcedReveal(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: theme.bg,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "calc(14px + env(safe-area-inset-top)) 16px 14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${theme.surface}`,
          background: theme.bg,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#555",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <div
          style={{
            flex: 1,
            height: 4,
            background: theme.surface,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${((step + 1) / content.length) * 100}%`,
              height: "100%",
              background: theme.accent,
              transition: "width .3s",
            }}
          />
        </div>
        <span
          style={{ fontSize: 11, color: theme.accent, fontFamily: "monospace" }}
        >
          {step + 1}/{content.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
        <h2 style={{ color: theme.text, marginBottom: 16 }}>
          {current.heading}
        </h2>

        {current.type === "concept" && (
          <p style={{ color: "#aaa", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
            {current.body}
          </p>
        )}

        {current.type === "code" && (
          <>
            <p style={{ color: "#aaa", marginBottom: 12, lineHeight: 1.6 }}>
              {current.body}
            </p>
            <pre
              style={{
                background: theme.surface,
                padding: 16,
                borderLeft: `3px solid ${theme.accent}`,
                color: theme.text,
                overflowX: "auto",
                fontSize: 12,
                borderRadius: 4,
              }}
            >
              {current.code}
            </pre>
          </>
        )}

        {current.type === "code_practice" && (
          <div>
            <p style={{ color: theme.text, marginBottom: 16, fontSize: 15 }}>
              {current.context}
            </p>
            <div
              style={{
                background: theme.surface,
                border: "1px solid #333",
                borderRadius: 8,
                padding: 16,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  color: "#888",
                  whiteSpace: "pre-wrap",
                  marginBottom: 8,
                }}
              >
                {current.code_before}
              </div>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Type exact syntax here..."
                disabled={answered}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "rgba(0,0,0,0.5)",
                  border: `1px solid ${theme.accent}`,
                  color: theme.accent,
                  fontFamily: "monospace",
                  outline: "none",
                  borderRadius: 4,
                }}
              />
              <div
                style={{ color: "#888", whiteSpace: "pre-wrap", marginTop: 8 }}
              >
                {current.code_after}
              </div>
            </div>

            {!answered ? (
              <button
                onClick={() => {
                  // Strip spaces, single quotes, and double quotes to make validation forgiving
                  const normalize = (str) =>
                    str.replace(/[\s'"]/g, "").toLowerCase();

                  const normalizedInput = normalize(codeInput);
                  const normalizedAnswer = normalize(current.correct_answer);

                  if (normalizedInput === normalizedAnswer) {
                    setAnswered(true);
                  } else {
                    alert(
                      `Syntax Error.\n\nHint: We are looking for exactly:\n${current.correct_answer}`,
                    );
                  }
                }}
                style={{
                  width: "100%",
                  padding: 14,
                  background: theme.accent,
                  color: "#000",
                  fontWeight: "bold",
                  border: "none",
                  borderRadius: 8,
                  marginTop: 16,
                  cursor: "pointer",
                }}
              >
                EXECUTE SCRIPT
              </button>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  color: theme.accent,
                  fontWeight: "bold",
                  textAlign: "center",
                  border: `1px solid ${theme.accent}`,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                ✅ COMPILATION SUCCESS
              </div>
            )}
          </div>
        )}

        {current.type === "quiz" && (
          <div>
            <p style={{ color: theme.text, marginBottom: 20, fontSize: 15 }}>
              {current.question ||
                current.body ||
                "Select the correct answer to proceed:"}
            </p>
            {current.options &&
              current.options.map((opt, i) => {
                const correctIdx = parseInt(current.correct, 10);
                const isDisabledWrong = disabledOptions.includes(i);
                const isFinalized =
                  answered &&
                  (selectedOption === correctIdx || answerForcedReveal);
                let bg = theme.surface,
                  border = "1px solid #333",
                  color = theme.text;
                // Style finalized state (correct picked OR answer revealed after 3 tries)
                if (isFinalized) {
                  if (i === correctIdx) {
                    bg = "rgba(0, 255, 136, 0.1)";
                    border = `1px solid ${theme.accent}`;
                    color = theme.accent;
                  } else if (i === selectedOption) {
                    bg = "rgba(239, 68, 68, 0.1)";
                    border = "1px solid #ef4444";
                    color = "#ef4444";
                  }
                } else if (isDisabledWrong) {
                  // Wrong answer they already tried — dim it
                  bg = "rgba(239, 68, 68, 0.05)";
                  border = "1px solid #ef444450";
                  color = "#ef444480";
                }
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (isFinalized || isDisabledWrong) return;
                      const correctIdx = parseInt(current.correct, 10);
                      if (i === correctIdx) {
                        // Correct on this attempt — finalize
                        setSelectedOption(i);
                        setAnswered(true);
                        playSound("correct_answer");
                      } else {
                        // Wrong — disable this option, increment attempts, let them try again
                        setSelectedOption(i);
                        setDisabledOptions((prev) => [...prev, i]);
                        setWrongAttempts((n) => n + 1);
                      }
                    }}
                    disabled={isFinalized || isDisabledWrong}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 16,
                      margin: "8px 0",
                      background: bg,
                      border: border,
                      color: color,
                      textAlign: "left",
                      cursor:
                        isFinalized || isDisabledWrong ? "default" : "pointer",
                      borderRadius: 8,
                      fontSize: 14,
                      opacity: isDisabledWrong ? 0.5 : 1,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}

            {/* Hint ladder: wrong attempt feedback + escalating help */}
            {wrongAttempts > 0 && !answered && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid #ef444430",
                  borderRadius: 8,
                }}
              >
                <p
                  style={{
                    color: "#ef4444",
                    margin: "0 0 8px 0",
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                >
                  ✗ Incorrect — try again ({wrongAttempts}/3 attempts used)
                </p>

                {/* Hint after 2 wrong attempts */}
                {wrongAttempts >= 2 && !hintRevealed && current.hint && (
                  <button
                    onClick={() => setHintRevealed(true)}
                    style={{
                      width: "100%",
                      padding: 10,
                      marginTop: 4,
                      background: "transparent",
                      border: "1px solid #facc15",
                      color: "#facc15",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  >
                    💡 REQUEST HINT
                  </button>
                )}

                {hintRevealed && current.hint && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: "rgba(250, 204, 21, 0.08)",
                      border: "1px solid #facc1530",
                      borderRadius: 6,
                      color: "#facc15",
                      fontSize: 12,
                      fontFamily: "monospace",
                      lineHeight: 1.6,
                    }}
                  >
                    💡 {current.hint}
                  </div>
                )}

                {/* After 3 wrong, allow forced reveal (no XP later — frontend convention) */}
                {wrongAttempts >= 3 && (
                  <button
                    onClick={() => {
                      setAnswerForcedReveal(true);
                      setAnswered(true);
                    }}
                    style={{
                      width: "100%",
                      padding: 10,
                      marginTop: 8,
                      background: "transparent",
                      border: "1px solid #888",
                      color: "#888",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  >
                    REVEAL ANSWER (NO XP)
                  </button>
                )}
              </div>
            )}

            {/* Show correct-reveal banner when user got it (or forced reveal) */}
            {answered && answerForcedReveal && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "rgba(136, 136, 136, 0.08)",
                  border: "1px solid #555",
                  borderRadius: 6,
                  color: "#888",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                Answer revealed. Review the highlighted option and continue.
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 16px calc(16px + env(safe-area-inset-bottom))",
          borderTop: `1px solid ${theme.surface}`,
          display: "flex",
          gap: 12,
          background: theme.bg,
        }}
      >
        {step > 0 && !errorMsg && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              padding: "14px 20px",
              background: "transparent",
              border: "1px solid #333",
              color: "#888",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ← BACK
          </button>
        )}

        {errorMsg ? (
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "14px",
              background: "#ef4444",
              border: "none",
              color: "#fff",
              fontWeight: "bold",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ABORT MISSION (NO XP)
          </button>
        ) : current.type !== "quiz" && current.type !== "code_practice" ? (
          <button
            onClick={handleNext}
            style={{
              flex: 1,
              padding: "14px",
              background: theme.accent,
              border: "none",
              color: "#000",
              fontWeight: "bold",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            NEXT →
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={
              (current.type === "quiz" && !answered) ||
              (current.type === "code_practice" && !answered)
            }
            style={{
              flex: 1,
              padding: "14px",
              background:
                (current.type === "quiz" && answered) ||
                (current.type === "code_practice" && answered)
                  ? theme.accent
                  : theme.surface,
              border: "none",
              color:
                (current.type === "quiz" && answered) ||
                (current.type === "code_practice" && answered)
                  ? "#000"
                  : "#555",
              fontWeight: "bold",
              borderRadius: 8,
              cursor:
                (current.type === "quiz" && answered) ||
                (current.type === "code_practice" && answered)
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {step === content.length - 1 ? "FINISH MISSION" : "CONTINUE"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── COMPLETION OVERLAY ──────────────────────────────────────────────────────
function CompleteOverlay({ lessonData, theme, onDismiss }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: theme.bg,
          border: `1px solid ${theme.accent}50`,
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
          maxWidth: 320,
          width: "90%",
          boxShadow: `0 0 40px ${theme.accent}20`,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div
          style={{
            fontSize: 22,
            color: theme.accent,
            fontWeight: "bold",
            marginBottom: 8,
          }}
        >
          Mission Complete
        </div>
        <div style={{ fontSize: 14, color: "#aaa", marginBottom: 24 }}>
          {lessonData.title}
        </div>
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.accent}30`,
            padding: "16px",
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: "#facc15",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            +{lessonData.xp}
          </div>
          <div
            style={{
              fontSize: 11,
              color: theme.accent,
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            XP Earned
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: 14,
            background: theme.accent,
            border: "none",
            borderRadius: 8,
            color: "#000",
            fontWeight: "bold",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          RETURN TO HUB
        </button>
      </div>
    </div>
  );
}

// ── APP ROOT ────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [userState, setUserState] = useState(null);
  const [curriculum, setCurriculum] = useState([]);
  const [screen, setScreen] = useState("home");
  const [activeLesson, setActiveLesson] = useState(null);
  const [completedLessonData, setCompletedLessonData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bootError, setBootError] = useState(false);
  const [showPersistence, setShowPersistence] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [showThreadRegen, setShowThreadRegen] = useState(false);
  const [showRankProgression, setShowRankProgression] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const activeTheme =
    userState && THEMES[userState.active_theme]
      ? THEMES[userState.active_theme]
      : THEMES.default;

  // ── HARDWARE UI SYNC (EDGE-TO-EDGE) ─────────────────────────────────────────
  useEffect(() => {
    const syncNativeUI = async () => {
      document.body.style.backgroundColor = activeTheme.bg;
      document.documentElement.style.backgroundColor = activeTheme.bg;
      try {
        const isLight =
          activeTheme.id === "flashbang" || activeTheme.id === "arctic";
        await StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark });
        if (Capacitor.getPlatform() === "android") {
          // Android-only: overlay must be set to false for transparent bars
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (e) {}
    };
    syncNativeUI();
  }, [activeTheme]);

  // Clean up OAuth redirect hash from URL after Supabase has processed it.
  // Without this, the URL stays cluttered (#access_token=...) and on some browsers
  // React's render lifecycle can collide with hash-based routing in weird ways
  // — which caused the "black screen until refresh" symptom on first OAuth login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasOAuthHash =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error_description") ||
      window.location.search.includes("code=");
    if (hasOAuthHash) {
      // Give Supabase a beat to parse the URL, then strip it
      setTimeout(() => {
        try {
          window.history.replaceState(
            null,
            "",
            window.location.pathname +
              window.location.search.replace(/[?&]code=[^&]*/, ""),
          );
        } catch (e) {
          /* ignore */
        }
      }, 1500);
    }
  }, []);

  // Initialize Supabase Auth & Fetch Curriculum
  // This is hardened against three failure modes that previously caused
  // infinite "Initializing secure connection" hangs:
  //   1. onAuthStateChange never firing on Capacitor cold-start
  //   2. Supabase fetch calls hanging indefinitely (no timeout, no error)
  //   3. Race between getSession() and INITIAL_SESSION event firing twice
  useEffect(() => {
    let mounted = true;
    let hasInitialized = false;

    const handleSession = async (event, session) => {
      if (!mounted) return;
      hasInitialized = true;

      setSession(session);

      if (session) {
        try {
          if (event === "PASSWORD_RECOVERY") {
            console.log("Password recovery initiated.");
            setShowPasswordReset(true);
          }
          // Each call gets its own 8s budget. If either hangs, we throw,
          // fall to the catch, and the finally still releases the UI.
          await withTimeout(
            fetchProfile(session.user.id),
            8000,
            "fetchProfile",
          );
          await withTimeout(fetchCurriculum(), 8000, "fetchCurriculum");
        } catch (error) {
          console.error("Auth sync error:", error);
          if (mounted) setBootError(true);
        } finally {
          if (mounted) setAuthLoading(false);
        }
      } else {
        if (mounted) {
          setUserState(null);
          setCurriculum([]);
          setAuthLoading(false);
        }
      }
    };

    // Hard watchdog: if NOTHING has fired in 10 seconds, give up and show
    // the error screen so the user can retry instead of staring at a hang.
    const watchdog = setTimeout(() => {
      if (mounted && !hasInitialized) {
        console.warn("Auth init watchdog fired - forcing error UI");
        hasInitialized = true;
        setBootError(true);
        setAuthLoading(false);
      }
    }, 10000);

    // Belt: explicit getSession() catches Capacitor cold-start cases where
    // onAuthStateChange would otherwise sit silent
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error("getSession error:", error);
        if (mounted && !hasInitialized) {
          handleSession("INITIAL_SESSION", session);
        }
      })
      .catch((err) => {
        console.error("getSession threw:", err);
        // Let watchdog or listener pick up the slack
      });

    // Suspenders: live listener for sign-ins, sign-outs, recovery, token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // If getSession() already handled the initial state, skip the duplicate
      if (event === "INITIAL_SESSION" && hasInitialized) return;
      handleSession(event, session);
    });

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const handleRetryBoot = () => {
    setBootError(false);
    setAuthLoading(true);
    // Hard reload is the safest way to clear any half-initialized Supabase state
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  // ── NETWORK STATUS MONITORING ─────────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle;
    const setupNetwork = async () => {
      const { Network } = await import("@capacitor/network");
      listenerHandle = await Network.addListener(
        "networkStatusChange",
        (status) => {
          if (!status.connected) {
            setThreadWarning("📡 UPLINK SEVERED: Connection lost.");
            setTimeout(() => setThreadWarning(""), 4000);
          } else {
            setThreadWarning("📡 UPLINK RESTORED.");
            setTimeout(() => setThreadWarning(""), 2500);
          }
        },
      );
    };
    setupNetwork();
    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", userId).single(),
        6000,
        "profiles.select",
      );

      if (data) {
        // --- DUOLINGO-STYLE STREAK MATH (PUNISHMENT ONLY) ---
        const today = new Date();
        const todayStr = today.toLocaleDateString("en-CA");
        const lastDateStr = data.last_active_date || "";

        let updates = {};
        let currentStreak = data.persistence_streak || 0;
        let currentBurners = data.burner_phones || 0;

        if (lastDateStr && lastDateStr !== todayStr) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toLocaleDateString("en-CA");

          if (lastDateStr !== yesterdayStr) {
            // They missed yesterday.
            if (currentBurners > 0) {
              currentBurners -= 1;
              updates.burner_phones = currentBurners;
              // The burner saves the streak integer, but we don't update last_active_date
              // until they actually do a lesson today to prove they are back.
            } else {
              currentStreak = 0; // Streak broken.
              updates.persistence_streak = 0;
            }
          }
        }

        // Thread recharge (1 per 3 hours up to 22)
        let currentThreads = data.threads ?? 22;
        const lastActiveTime = data.last_active
          ? new Date(data.last_active)
          : today;
        const hoursSinceActive = (today - lastActiveTime) / (1000 * 60 * 60);
        const threadsToRegen = Math.floor(hoursSinceActive / 3);

        if (threadsToRegen > 0 && currentThreads < 22 && !data.is_supporter) {
          currentThreads = Math.min(22, currentThreads + threadsToRegen);
          updates.threads = currentThreads;

          // Advance the clock by exactly how many 3-hour chunks were consumed
          const newLastActive = new Date(
            lastActiveTime.getTime() + threadsToRegen * 3 * 60 * 60 * 1000,
          );
          updates.last_active = newLastActive.toISOString();
        }

        setUserState({
          id: data.id,
          username: data.username,
          xp: data.xp,
          path: data.path_alignment,
          role: data.role,
          completedModules: data.completed_modules || [],
          hashes: data.hashes || 0,
          threads: currentThreads,
          persistence_streak: currentStreak,
          burner_phones: currentBurners,
          active_theme: data.active_theme || "default",
          unlocked_themes: data.unlocked_themes || ["default"],
          is_supporter: data.is_supporter || false,
          last_active_date: data.last_active_date || "",
          last_active: data.last_active || null,
          last_reward: data.last_reward || null,
          overclock_active_until: data.overclock_active_until || null,
          overclock_tokens: data.overclock_tokens || 0,
          streak_restores: data.streak_restores || 0,
          referral_code: data.referral_code || null,
          referral_count: data.referral_count || 0,
          unlocked_achievements: data.unlocked_achievements || [],
          onboarding_completed: data.onboarding_completed || false,
        });

        // Persist all computed updates to Supabase
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await withTimeout(
            supabase.from("profiles").update(updates).eq("id", userId),
            5000,
            "profiles.update",
          );
          if (updateError) {
            console.error("Profile update failed:", updateError);
          }
        }
      } else if (error) {
        // Wrap signOut in timeout too — it can hang if the network call to
        // Supabase's auth server stalls. We don't actually need to wait for
        // the server response; clearing local state is enough.
        await withTimeout(supabase.auth.signOut(), 3000, "signOut").catch(
          () => {},
        );
        setSession(null);
        setUserState(null);
      }
    } catch (err) {
      console.error("fetchProfile error:", err);
      // Re-throw so the outer useEffect's catch can trip the bootError state
      throw err;
    }
  };

  const fetchCurriculum = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("tracks")
          .select(
            `id, phase, title, icon, color, description, path_lock, order_index, modules ( id, title, xp_reward, type, order_index )`,
          )
          .order("order_index", { ascending: true })
          .order("order_index", { foreignTable: "modules", ascending: true }),
        6000,
        "tracks.select",
      );
      if (error) {
        console.error("fetchCurriculum error:", error);
        return;
      }
      if (data) {
        const formatted = data.map((track) => ({
          id: track.id,
          title: track.title,
          icon: track.icon,
          color: track.color,
          phase: track.phase,
          desc: track.description,
          pathLock: track.path_lock,
          modules: track.modules.map((mod) => ({
            id: mod.id,
            title: mod.title,
            xp: mod.xp_reward,
            type: mod.type,
          })),
        }));
        setCurriculum(formatted);
      }
    } catch (err) {
      console.error("fetchCurriculum threw:", err);
      throw err;
    }
  };

  const [threadWarning, setThreadWarning] = useState("");

  const handleStartMission = async (mission) => {
    const cost = getThreadCost(mission);
    if (userState.is_supporter || userState.threads >= cost) {
      setActiveLesson(mission);
    } else {
      setThreadWarning(
        `Insufficient Threads. This target requires ${cost} Thread${cost > 1 ? "s" : ""}.`,
      );
      setTimeout(() => setThreadWarning(""), 3000);
    }
  };

  const updateProfile = async (updates) => {
    if (!session) return;
    await supabase.from("profiles").update(updates).eq("id", session.user.id);
  };

  const handleLessonComplete = async (lessonMeta) => {
    const isAlreadyDone = userState.completedModules.includes(lessonMeta.id);
    const todayStr = new Date().toLocaleDateString("en-CA");

    let profileUpdates = {};
    // 1. Create a master clone of the state to hold all updates safely
    let updatedState = { ...userState };

    // 2. Calculate Thread Deduction
    const cost = getThreadCost(lessonMeta);
    if (!userState.is_supporter && updatedState.threads >= cost) {
      updatedState.threads -= cost;
      profileUpdates.threads = updatedState.threads;
    }

    // 3. Calculate Streak Logic
    if (userState.last_active_date !== todayStr) {
      updatedState.persistence_streak =
        (updatedState.persistence_streak || 0) + 1;
      updatedState.last_active_date = todayStr;

      profileUpdates.persistence_streak = updatedState.persistence_streak;
      profileUpdates.last_active_date = todayStr;
      profileUpdates.last_active = new Date().toISOString();
    }

    // 4. Calculate XP and Hashes
    if (!isAlreadyDone) {
      let earnedXp = lessonMeta.xp;

      // CHECK FOR OVERCLOCK
      if (updatedState.overclock_tokens > 0) {
        earnedXp = earnedXp * 2; // Double the XP
        updatedState.overclock_tokens -= 1; // Consume one token
        profileUpdates.overclock_tokens = updatedState.overclock_tokens;
      }

      const earnedHashes = Math.round(earnedXp / 2);
      updatedState.xp += earnedXp;
      updatedState.hashes += earnedHashes;
      updatedState.completedModules = [
        ...updatedState.completedModules,
        lessonMeta.id,
      ];

      profileUpdates.xp = updatedState.xp;
      profileUpdates.hashes = updatedState.hashes;
      profileUpdates.completed_modules = updatedState.completedModules;
    }

    // 5. Instantly force the UI to update with the new threads, XP, and streaks
    setUserState(updatedState);

    // 6. Persist updates. Use the anti-cheat RPC for XP/hash/streak awards
    //    (server validates lesson_id wasn't already claimed, XP is in range,
    //    and computes streak server-side so client can't game it).
    //    Other fields (threads, overclock_tokens) go through normal update path.
    if (!isAlreadyDone) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "award_lesson_completion",
          {
            lesson_id: lessonMeta.id,
            lesson_xp: lessonMeta.xp,
          },
        );
        if (rpcError) {
          console.error("award_lesson_completion failed:", rpcError);
          setThreadWarning("⚠ XP SYNC FAILED — try refreshing");
          setTimeout(() => setThreadWarning(""), 4000);
        } else if (rpcData) {
          // Trust the server's authoritative values. Without this, local state
          // can diverge from DB (the streak 7→8→0→7 oscillation bug).
          updatedState.xp = rpcData.xp;
          updatedState.hashes = rpcData.hashes;
          if (typeof rpcData.persistence_streak === "number") {
            updatedState.persistence_streak = rpcData.persistence_streak;
          }
          // Re-set state with the corrected values
          setUserState(updatedState);
        }
      } catch (e) {
        console.error("award_lesson_completion threw:", e);
      }
      // Strip locked fields from the remaining updateProfile call — the RPC
      // owns them, and trying to update them directly fails RLS silently
      delete profileUpdates.xp;
      delete profileUpdates.hashes;
      delete profileUpdates.completed_modules;
      delete profileUpdates.persistence_streak;
      delete profileUpdates.last_active_date;
      delete profileUpdates.last_active;
    }
    if (Object.keys(profileUpdates).length > 0) {
      await updateProfile(profileUpdates);
    }

    // 7. Play success sound and fire achievement check
    playSound("lesson_complete");
    checkAchievements(updatedState);

    setActiveLesson(null);
    setCompletedLessonData({
      ...lessonMeta,
      xp: isAlreadyDone ? 0 : lessonMeta.xp,
    });
  };

  const handlePathChange = async (newPath) => {
    setUserState({ ...userState, path: newPath });
    await updateProfile({ path_alignment: newPath });
    setScreen("home");
  };

  const handlePurchase = async (itemType, cost) => {
    const currentHashes = userState.hashes || 0;
    if (currentHashes < cost) return;

    let updates = { hashes: currentHashes - cost };
    let newState = { ...userState, hashes: currentHashes - cost };

    if (itemType === "burner") {
      const currentBurners = userState.burner_phones || 0;
      if (currentBurners >= 3) return; // Hard cap at 3
      updates.burner_phones = currentBurners + 1;
      newState.burner_phones = currentBurners + 1;
    } else if (itemType === "threads") {
      const currentThreads = userState.threads || 0;
      if (currentThreads >= 22) return;
      const newThreads = Math.min(22, currentThreads + 5);
      updates.threads = newThreads;
      newState.threads = newThreads;
    } else if (itemType === "overclock") {
      const currentOverclocks = userState.overclock_tokens || 0;
      if (currentOverclocks >= 6) return; // HARD CAP AT 6
      updates.overclock_tokens = currentOverclocks + 1;
      newState.overclock_tokens = currentOverclocks + 1;
    } else if (itemType === "streak_restore") {
      const currentRestores = userState.streak_restores || 0;
      if (currentRestores >= 3) return;
      updates.streak_restores = currentRestores + 1;
      newState.streak_restores = currentRestores + 1;
    } else if (itemType === "activate_streak_restore") {
      const currentRestores = userState.streak_restores || 0;
      if (currentRestores <= 0 || userState.persistence_streak > 0) return;
      updates.persistence_streak = 1; // Restore to 1
      updates.streak_restores = currentRestores - 1;
      newState.persistence_streak = 1;
      newState.streak_restores = currentRestores - 1;
    } else if (itemType.startsWith("theme_")) {
      const themeId = itemType.replace("theme_", "");
      const safeUnlockedList = Array.isArray(userState.unlocked_themes)
        ? userState.unlocked_themes
        : ["default"];
      const newThemes = [...safeUnlockedList, themeId];
      updates.unlocked_themes = newThemes;
      updates.active_theme = themeId;
      newState.unlocked_themes = newThemes;
      newState.active_theme = themeId;
    }

    setUserState(newState);
    await updateProfile(updates);
  };

  const handleActivateOverclock = async () => {
    if ((userState.overclock_tokens || 0) <= 0) {
      setThreadWarning("No Overclock tokens. Purchase from the Market.");
      setTimeout(() => setThreadWarning(""), 3000);
      return;
    }

    // Set expiration to 24 hours from now
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const updates = {
      overclock_tokens: userState.overclock_tokens - 1,
      overclock_active_until: expiry,
    };

    setUserState({ ...userState, ...updates });
    await updateProfile(updates);
  };

  const handleEquipTheme = async (themeId) => {
    setUserState({ ...userState, active_theme: themeId });
    await updateProfile({ active_theme: themeId });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Check for newly-unlocked achievements after any XP/hash/streak change.
  // Pass `nextState` if you've optimistically updated userState locally —
  // we want to check against the freshest values, not stale ones.
  const checkAchievements = async (nextState = null) => {
    const stateToCheck = nextState || userState;
    if (!stateToCheck) return;
    const currentUnlocked = stateToCheck.unlocked_achievements || [];
    const newlyUnlocked = ACHIEVEMENTS.filter(
      (a) => !currentUnlocked.includes(a.id) && a.check(stateToCheck),
    );
    if (newlyUnlocked.length === 0) return;

    const updatedUnlocked = [
      ...currentUnlocked,
      ...newlyUnlocked.map((a) => a.id),
    ];
    setUserState((prev) => ({
      ...prev,
      unlocked_achievements: updatedUnlocked,
    }));

    await supabase
      .from("profiles")
      .update({ unlocked_achievements: updatedUnlocked })
      .eq("id", stateToCheck.id)
      .then(() => {})
      .catch((e) => console.error("Achievement persist failed:", e));

    // Show toast for the first newly-unlocked achievement
    const first = newlyUnlocked[0];
    setThreadWarning(`🏆 ACHIEVEMENT UNLOCKED: ${first.icon} ${first.name}`);
    setTimeout(() => setThreadWarning(""), 4500);
  };

  const handleAdminAction = async (type) => {
    if (type === "xp") {
      const newXp = userState.xp + 10000;
      const newHashes = userState.hashes + 10000;
      setUserState({ ...userState, xp: newXp, hashes: newHashes });
      await updateProfile({ xp: newXp, hashes: newHashes });
    } else if (type === "supporter") {
      setUserState({ ...userState, is_supporter: true });
      await updateProfile({ is_supporter: true });
    }
  };

  const handleClaimDailyReward = async (_xpReward, _hashReward) => {
    // The reward amounts and eligibility check live on the server now,
    // so the RPC is the source of truth — anti-cheat RLS blocks direct
    // updates to xp/hashes/last_reward from the client.
    try {
      const { data, error } = await supabase.rpc("claim_daily_reward");
      if (error) {
        console.error("Daily reward claim failed:", error);
        // The most common error is "Reward not ready yet" — surface it
        setShowDailyReward(false);
        setThreadWarning(
          error.message?.includes("not ready")
            ? "⏳ DROP NOT READY — check back later"
            : "⚠ DROP FAILED — try again",
        );
        setTimeout(() => setThreadWarning(""), 3500);
        return;
      }

      const xpReward = data.xp_reward;
      const hashReward = data.hash_reward;

      setUserState({
        ...userState,
        xp: data.xp,
        hashes: data.hashes,
        last_reward: data.last_reward,
      });
      setShowDailyReward(false);
      playSound("daily_reward");
      setThreadWarning("");
      setTimeout(() => {
        setThreadWarning(
          `⚡ SUPPLY DROP SECURED: +${xpReward} XP & +${hashReward} Hashes!`,
        );
        setTimeout(() => setThreadWarning(""), 4000);
      }, 200);

      // Check for new achievements with the authoritative server values
      checkAchievements({
        ...userState,
        xp: data.xp,
        hashes: data.hashes,
        last_reward: data.last_reward,
      });
    } catch (err) {
      console.error("Daily reward RPC threw:", err);
      setThreadWarning("⚠ NETWORK ERROR — try again");
      setTimeout(() => setThreadWarning(""), 3500);
    }
  };

  return (
    <>
      <style>{`
            :root {
              --theme-bg: ${activeTheme.bg};
              --theme-surface: ${activeTheme.surface};
              --theme-accent: ${activeTheme.accent};
              --theme-text: ${activeTheme.text};
            }

            /* Forces the outer background to be black, and centers the app inside it */
            html, body {
              margin: 0; padding: 0; width: 100%; min-height: 100dvh;
              background-color: #030303; overflow-x: hidden;
              -webkit-tap-highlight-color: transparent;
              -webkit-text-size-adjust: 100%;
              text-size-adjust: 100%;
            }

            #root {
              display: flex;
              justify-content: center;
              width: 100%;
              min-height: 100dvh;
            }

            * { box-sizing: border-box; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: var(--theme-bg); }
            ::-webkit-scrollbar-thumb { background: var(--theme-surface); border-radius: 3px; }
            pre { white-space: pre; overflow-x: auto; -webkit-overflow-scrolling: touch; }

            /* PREVENTS IOS FROM AUTO-ZOOMING, SCOPED ONLY TO TEXT FIELDS */
                        input[type="text"], input[type="password"], input[type="email"], textarea {
                          font-size: 16px !important;
                        }

            /* Base Mobile UI */
                        .app-container {
                          background: var(--theme-bg);
                          min-height: 100dvh;
                          width: 100%;
                          max-width: 500px;
                          font-family: 'Courier New', monospace;
                          color: var(--theme-text);
                          position: relative;
                          display: flex;
                          flex-direction: column;
                          box-shadow: 0 0 50px rgba(0,0,0,0.8);
                          transition: background-color 0.3s ease;

                          /* PREVENTS UI FROM HITTING THE CAMERA NOTCH */
                          padding-top: env(safe-area-inset-top);
                          /* iOS: ensures scroll content clears home indicator below nav bar */
                          padding-bottom: env(safe-area-inset-bottom);
                        }

                        /* Base Mobile Nav */
                        .nav-bar {
                          position: fixed; bottom: 0; left: 0; right: 0; margin: 0 auto;
                          width: 100%; max-width: 500px;
                          background: var(--theme-bg); border-top: 1px solid var(--theme-surface);
                          display: flex; justify-content: space-around; padding: 8px 0 16px; z-index: 100;

                          /* PUSHES ICONS ABOVE THE ANDROID SWIPE LINE */
                          padding-bottom: calc(16px + env(safe-area-inset-bottom));
                        }

            /* Desktop Expansion */
                    @media (min-width: 768px) {
                      .app-container { max-width: 100%; border-radius: 0; box-shadow: none; }
                      .nav-bar { max-width: 100%; }
                      .desktop-grid { display: flex; flex-direction: row; gap: 24px; align-items: flex-start; }
                      .desktop-grid > div { flex: 1; }
                    }
          `}</style>

      <div className="app-container">
        {threadWarning && (
          <div
            style={{
              position: "fixed",
              top: "calc(16px + env(safe-area-inset-top))",
              left: "50%",
              transform: "translateX(-50%)",
              background: "#ef4444",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: "bold",
              zIndex: 9999,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
            }}
          >
            ⚠️ {threadWarning}
          </div>
        )}
        {bootError ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: activeTheme.text,
              marginTop: "30%",
            }}
          >
            <div
              style={{
                fontSize: 40,
                marginBottom: 16,
              }}
            >
              ⚠️
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: "#ef4444",
                fontFamily: "monospace",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Uplink Failure
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#888",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              Could not establish secure connection. Check your network and
              retry.
            </div>
            <button
              onClick={handleRetryBoot}
              style={{
                padding: "12px 32px",
                background: activeTheme.accent,
                color: "#000",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                fontFamily: "monospace",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              RETRY CONNECTION
            </button>
          </div>
        ) : authLoading ? (
          <div
            style={{
              padding: 56,
              textAlign: "center",
              color: activeTheme.accent,
              marginTop: "50%",
            }}
          >
            [ INITIALIZING SECURE CONNECTION... ]
          </div>
        ) : !session ? (
          showAuth ? (
            <AuthScreen />
          ) : (
            <LandingScreen onEnterAuth={() => setShowAuth(true)} />
          )
        ) : !userState ? (
          // Session exists but profile hasn't loaded yet (OAuth signup edge case).
          // Show a loading state instead of the black screen that HomeScreen
          // returns when userState is null.
          <div
            style={{
              padding: 56,
              textAlign: "center",
              color: activeTheme.accent,
              marginTop: "40%",
              fontFamily: "monospace",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>[ SYNCING
            OPERATOR DATA... ]
          </div>
        ) : !userState.onboarding_completed ? (
          <OnboardingScreen
            userState={userState}
            theme={activeTheme}
            onComplete={async () => {
              setUserState({ ...userState, onboarding_completed: true });
              await supabase
                .from("profiles")
                .update({ onboarding_completed: true })
                .eq("id", userState.id);
            }}
          />
        ) : (
          <>
            {activeLesson && (
              <DynamicLessonScreen
                lessonMeta={activeLesson}
                userState={userState}
                theme={activeTheme}
                onClose={() => setActiveLesson(null)}
                onComplete={handleLessonComplete}
              />
            )}
            {completedLessonData && (
              <CompleteOverlay
                lessonData={completedLessonData}
                theme={activeTheme}
                onDismiss={() => setCompletedLessonData(null)}
              />
            )}

            {/* CSS-TOGGLED CALENDAR MODAL */}
            <PersistenceModal
              isOpen={showPersistence}
              userState={userState}
              theme={activeTheme}
              onClose={() => setShowPersistence(false)}
            />

            {/* PASSWORD RECOVERY OVERLAY */}
            {showPasswordReset && (
              <PasswordResetModal
                theme={activeTheme}
                onClose={() => setShowPasswordReset(false)}
              />
            )}

            {/* DAILY REWARD OVERLAY */}
            {showDailyReward && (
              <DailyRewardModal
                userState={userState}
                theme={activeTheme}
                onClose={() => setShowDailyReward(false)}
                onClaim={handleClaimDailyReward}
              />
            )}

            {/* THREAD REGEN OVERLAY */}
            {showThreadRegen && (
              <ThreadRegenModal
                userState={userState}
                theme={activeTheme}
                onClose={() => setShowThreadRegen(false)}
              />
            )}

            {/* RANK PROGRESSION OVERLAY */}
            {showRankProgression && (
              <RankProgressionModal
                userState={userState}
                theme={activeTheme}
                onClose={() => setShowRankProgression(false)}
              />
            )}

            {/* ACHIEVEMENTS OVERLAY */}
            {showAchievements && (
              <AchievementsModal
                userState={userState}
                theme={activeTheme}
                onClose={() => setShowAchievements(false)}
              />
            )}

            {!activeLesson && !completedLessonData && (
              <>
                {screen === "home" && screen !== "choosePath" && (
                  <HomeScreen
                    userState={userState}
                    curriculum={curriculum}
                    theme={activeTheme}
                    onOpenLesson={handleStartMission}
                    onChoosePath={() => setScreen("choosePath")}
                    onOpenPersistence={() => setShowPersistence(true)}
                    onOpenDailyReward={() => setShowDailyReward(true)}
                    onOpenThreadRegen={() => setShowThreadRegen(true)}
                    onOpenRankProgression={() => setShowRankProgression(true)}
                    onNav={setScreen}
                  />
                )}
                {screen === "skilltree" && (
                  <SkillTreeScreen
                    userState={userState}
                    curriculum={curriculum}
                    theme={activeTheme}
                    onOpenLesson={handleStartMission}
                  />
                )}
                {screen === "leaderboard" && (
                  <LeaderboardScreen
                    userState={userState}
                    theme={activeTheme}
                  />
                )}
                {screen === "market" && (
                  <BlackMarketScreen
                    userState={userState}
                    theme={activeTheme}
                    onPurchase={handlePurchase}
                    onEquipTheme={handleEquipTheme}
                    onActivateOverclock={handleActivateOverclock}
                  />
                )}

                {screen === "squads" && (
                  <SquadScreen userState={userState} theme={activeTheme} />
                )}

                {screen === "profile" && (
                  <OperatorScreen
                    userState={userState}
                    setScreen={setScreen}
                    theme={activeTheme}
                    onSignOut={handleSignOut}
                    onAdminAction={handleAdminAction}
                    onOpenAchievements={() => setShowAchievements(true)}
                  />
                )}

                {screen === "choosePath" && (
                  <div style={{ padding: "56px 16px" }}>
                    <h2
                      style={{
                        color: activeTheme.text,
                        marginBottom: 8,
                        textAlign: "center",
                      }}
                    >
                      ALIGNMENT SELECTION
                    </h2>
                    <p
                      style={{
                        color: "#888",
                        fontSize: 12,
                        textAlign: "center",
                        marginBottom: 32,
                      }}
                    >
                      Your path dictates your specialized Phase 3 curriculum.
                      This choice is permanent until explicitly realigned.
                    </p>
                    {["red", "blue", "purple"].map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePathChange(p)}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: 20,
                          marginBottom: 16,
                          background: activeTheme.surface,
                          color: PATHS[p].color,
                          border: `1px solid ${PATHS[p].color}50`,
                          fontWeight: "bold",
                          borderRadius: 12,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 24,
                            display: "block",
                            marginBottom: 8,
                          }}
                        >
                          {PATHS[p].emoji}
                        </span>
                        {PATHS[p].label}
                        <div
                          style={{
                            fontSize: 11,
                            color: "#888",
                            marginTop: 8,
                            fontWeight: "normal",
                          }}
                        >
                          {PATHS[p].desc}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <NavBar
                  active={screen === "choosePath" ? "profile" : screen}
                  theme={activeTheme}
                  onNav={setScreen}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
