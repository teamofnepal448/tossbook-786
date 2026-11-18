"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Crown,
  Eye,
  EyeOff,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/ui";

const FALLBACK_TG = "https://t.me/+FNrv5zNv6lI0ODk1";
const TRUST = [
  { icon: ShieldCheck, label: "SECURE PLATFORM" },
  { icon: Zap, label: "INSTANT WALLET" },
  { icon: Crown, label: "ROYAL ODDS" },
];

export default function LoginClient() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState<"form" | "demo" | null>(null);
  const [enteredAs, setEnteredAs] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [telegram, setTelegram] = useState(FALLBACK_TG);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.telegramUrl) setTelegram(s.telegramUrl);
      })
      .catch(() => {});
  }, []);

  async function submit(u: string, p: string, mode: "form" | "demo") {
    if (loading) return;
    setLoading(mode);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password: p }),
      });
      const data: { ok?: boolean; role?: string; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed. Check your credentials.");
        setShakeKey((k) => k + 1);
        setLoading(null);
        return;
      }
      const target = data.role === "admin" ? "/admin" : "/dashboard";
      setEnteredAs(data.role === "admin" ? "ADMIN CONTROL" : "THE ARENA");
      // Bulletproof session-synced navigation (full reload sends the cookie).
      window.location.assign(target);
      setTimeout(() => {
        if (window.location.pathname === "/login") {
          window.location.replace(target);
        }
      }, 1200);
    } catch {
      setError("Network error - please try again.");
      setShakeKey((k) => k + 1);
      setLoading(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(username.trim(), password, "form");
  }

  function demoLogin() {
    setUsername("DEMO1");
    setPassword("demo123");
    void submit("DEMO1", "demo123", "demo");
  }

  return (
    <main className="bg-arena relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* ambience */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/55 to-ink" />
      <div className="animate-aurora pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 rounded-full bg-gold/12 blur-[130px]" />
      <div className="animate-float-slow pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-neon/8 blur-[110px]" />

      <div className="relative z-10 w-full max-w-[26.5rem]">
        {/* brand */}
        <motion.div
          initial={{ opacity: 0, y: -26, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="mb-7 flex flex-col items-center text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-gold/25 blur-3xl" />
            <Logo size={118} priority className="animate-float-slow drop-shadow-[0_10px_36px_rgba(212,175,55,0.4)]" />
          </div>
          <h1 className="text-gold-grad text-shimmer mt-4 font-display text-[2.1rem] font-black leading-none tracking-[0.14em] drop-shadow-[0_2px_18px_rgba(212,175,55,0.35)]">
            TOSS BOOK 786
          </h1>
          <p className="mt-2.5 flex items-center gap-2 text-[10.5px] font-bold tracking-[0.34em] text-neon/90">
            <Sparkles size={12} />
            ASIA&rsquo;S NO. 1 PREMIUM TOSS PLATFORM
            <Sparkles size={12} />
          </p>
        </motion.div>

        {/* card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 17, delay: 0.12 }}
        >
          <motion.form
            key={shakeKey}
            animate={shakeKey ? { x: [0, -11, 11, -7, 7, 0] } : undefined}
            transition={{ duration: 0.45 }}
            onSubmit={onSubmit}
            className="glass-deep metal-border glow-gold rounded-3xl p-6 sm:p-7"
          >
            <p className="mb-5 text-center font-display text-[11px] font-bold tracking-[0.3em] text-white/45">
              PUNTER LOGIN
            </p>

            <label className="group relative mb-3.5 block">
              <User
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/60 transition-colors group-focus-within:text-gold"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username / ID"
                autoComplete="username"
                spellCheck={false}
                className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3.5 pl-11 pr-4 text-sm font-semibold tracking-wide text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
              />
            </label>

            <label className="group relative mb-4 block">
              <Lock
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/60 transition-colors group-focus-within:text-gold"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3.5 pl-11 pr-12 text-sm font-semibold tracking-wide text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-gold"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-lg border border-ruby/40 bg-ruby/10 px-3.5 py-2.5 text-center text-xs font-semibold tracking-wide text-ruby"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading !== null}
              className="gold-btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13px] font-black tracking-[0.28em]"
            >
              {loading === "form" ? <Spinner size={16} /> : <Crown size={16} />}
              {loading === "form" ? "ENTERING..." : "LOGIN"}
            </motion.button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <span className="text-[9.5px] font-bold tracking-[0.32em] text-white/30">
                INSTANT ACCESS
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={demoLogin}
                disabled={loading !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-gold/45 bg-gold/[0.06] py-3 font-display text-[11px] font-bold tracking-[0.2em] text-goldlight transition-all hover:bg-gold/[0.14] hover:shadow-[0_0_22px_rgba(212,175,55,0.25)] disabled:opacity-50"
              >
                {loading === "demo" ? <Spinner size={14} /> : <Zap size={14} />}
                DEMO LOGIN
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => window.open(telegram, "_blank", "noopener")}
                className="glow-neon flex items-center justify-center gap-2 rounded-xl border border-neon/60 bg-neon/[0.07] py-3 font-display text-[11px] font-bold tracking-[0.2em] text-neon transition-all hover:bg-neon/[0.16]"
              >
                <Send size={14} />
                GET NEW ID
              </motion.button>
            </div>
          </motion.form>
        </motion.div>

        {/* trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-6 flex items-center justify-center gap-5"
        >
          {TRUST.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.22em] text-white/30"
            >
              <Icon size={12} className="text-gold/60" />
              {label}
            </span>
          ))}
        </motion.div>

        <p className="mt-4 text-center text-[10px] tracking-[0.18em] text-white/20">
          18+ ONLY - PLAY RESPONSIBLY - PREMIUM TOSS SIMULATOR
        </p>
      </div>

      {/* post-login transition overlay */}
      <AnimatePresence>
        {enteredAs && (
          <motion.div
            key="entering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink/90 backdrop-blur-xl"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gold/30 blur-3xl"
              />
              <Logo size={96} priority />
            </div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-gold-grad text-shimmer mt-6 font-display text-[13px] font-black tracking-[0.4em]"
            >
              ENTERING {enteredAs}
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className="mt-4 h-0.5 w-40 origin-left rounded-full bg-gradient-to-r from-golddeep via-goldlight to-golddeep"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
