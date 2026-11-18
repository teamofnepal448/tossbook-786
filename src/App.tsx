import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Eye,
  EyeOff,
  Headset,
  Inbox,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  NotebookPen,
  OctagonAlert,
  Radio,
  ReceiptText,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Trophy,
  User,
  X,
} from "lucide-react";
import { Logo } from "@/src/components/Logo";
import { ChangePasswordCard } from "@/src/components/ChangePasswordCard";
import { EmptyState, SafePosterImg, Spinner, cn } from "@/src/components/ui";
import { Countdown } from "@/src/components/Countdown";
import { calculateCancellationRefund, calculatePayout, sanitizeStake } from "@/src/lib/money";
import {
  type BetDTO,
  DEFAULT_BANNER,
  DEFAULT_WELCOME_TEMPLATE,
  type MatchItem,
  type MatchesPayload,
  type PublicSettings,
  type TxDTO,
  type UserMe,
  formatClock,
  formatCoins,
  formatDateTime,
  formatTelegramUrl,
  renderWelcomeMessage,
} from "@/src/lib/shared";

export {
  DEFAULT_WELCOME_TEMPLATE,
  formatClock,
  formatCoins,
  formatDateTime,
  formatTelegramUrl,
  renderWelcomeMessage,
};

const AdminView = React.lazy(() => import("@/src/components/AdminView"));

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (res.ok) {
        const u = await res.json();
        setCurrentUser(u);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setCurrentUser(null);
      showToast("Signed out successfully");
    }
  }

  if (authLoading) {
    return (
      <div className="bg-arena flex min-h-dvh flex-col items-center justify-center">
        <Logo size={90} priority className="animate-pulse" />
        <p className="text-gold-grad mt-4 font-display text-xs font-bold tracking-[0.3em]">
          CONNECTING TOSS BOOK 786...
        </p>
      </div>
    );
  }

  return (
    <>
      {!currentUser ? (
        <LoginView
          onSuccess={(u) => {
            setCurrentUser(u);
            showToast(`Welcome back, ${u.username}!`);
          }}
        />
      ) : currentUser.role === "admin" ? (
        <Suspense
          fallback={
            <div className="bg-arena flex min-h-dvh flex-col items-center justify-center">
              <Logo size={72} priority className="animate-pulse" />
              <p className="text-gold-grad mt-3 font-display text-xs font-bold tracking-[0.26em]">
                LOADING ADMIN PANEL...
              </p>
            </div>
          }
        >
          <AdminView
            user={currentUser}
            onLogout={handleLogout}
            onSessionCleared={() => setCurrentUser(null)}
            showToast={showToast}
          />
        </Suspense>
      ) : (
        <PunterView
          user={currentUser}
          onUserUpdate={setCurrentUser}
          onLogout={handleLogout}
          onSessionCleared={() => setCurrentUser(null)}
          showToast={showToast}
        />
      )}

      {/* Global Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="glass-deep metal-border glow-gold fixed bottom-6 left-1/2 z-[200] max-w-[92vw] -translate-x-1/2 rounded-2xl px-4 py-3 text-center shadow-2xl sm:px-5"
          >
            <p className="whitespace-normal font-display text-[11px] font-bold tracking-[0.12em] text-goldlight sm:whitespace-nowrap sm:text-[11.5px] sm:tracking-[0.14em]">
              {toast.msg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ==========================================================================
   LOGIN VIEW
   ========================================================================== */

function LoginView({ onSuccess }: { onSuccess: (u: UserMe) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState<"form" | null>(null);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setSettings(s))
      .catch(() => {});
  }, []);

  async function submit(u: string, p: string, mode: "form" = "form") {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed. Check your credentials.");
        setShakeKey((k) => k + 1);
        setLoading(null);
        return;
      }

      const meRes = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (meRes.ok) {
        const profile = await meRes.json();
        onSuccess(profile);
      } else {
        onSuccess({
          id: data.id || 1,
          username: data.username,
          role: data.role,
          phone: null,
          balance: data.role === "admin" ? 0 : 10000,
          banned: false,
          exposure: 0,
        });
      }
    } catch {
      setError("Network connection error. Please try again.");
      setShakeKey((k) => k + 1);
      setLoading(null);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(username.trim(), password, "form");
  }

  const telegramLink = formatTelegramUrl(settings?.telegramUrl || settings?.supportUrl || "https://t.me/+FNrv5zNv6lI0ODk1");
  const getNewIdLink = formatTelegramUrl(settings?.getNewIdUrl || settings?.supportUrl || settings?.telegramUrl);
  const supportLink = formatTelegramUrl(settings?.supportUrl || settings?.telegramUrl);

  return (
    <main className="bg-arena relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b0e14]/70 via-[#0b0e14]/55 to-[#0b0e14]" />
      <div className="animate-aurora pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[46rem] -translate-x-1/2 rounded-full bg-gold/12 blur-[130px]" />

      <div className="relative z-10 w-full max-w-[27rem]">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mb-6 flex flex-col items-center text-center"
        >
          <div className="relative">
            <Logo size={120} priority className="animate-float-slow" />
          </div>
          <h1 className="text-gold-grad text-shimmer mt-3 font-display text-[2rem] font-black leading-none tracking-[0.14em] sm:text-[2.2rem]">
            TOSS BOOK 786
          </h1>
          <p className="mt-2 text-[11px] font-bold tracking-[0.24em] text-white/60">
            Asia&rsquo;s No. 1 Gaming Platform since 2023
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-deep metal-border glow-gold rounded-3xl p-6 sm:p-7"
        >
          <motion.form
            key={shakeKey}
            animate={shakeKey ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
            transition={{ duration: 0.4 }}
            onSubmit={onSubmit}
          >
            <div className="mb-4">
              <label className="mb-1 block font-display text-[9.5px] font-black tracking-[0.25em] text-white/45">
                USERNAME
              </label>
              <div className="group relative">
                <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/60" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or Email"
                  autoComplete="username"
                  className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3.5 pl-11 pr-4 text-sm font-semibold text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-1 block font-display text-[9.5px] font-black tracking-[0.25em] text-white/45">
                PASSWORD
              </label>
              <div className="group relative">
                <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/60" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3.5 pl-11 pr-12 text-sm font-semibold text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-gold"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-ruby/40 bg-ruby/10 px-3.5 py-2.5 text-center text-xs font-semibold text-ruby">
                {error}
              </p>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#4facfe] py-3.5 font-display text-[13px] font-black tracking-[0.26em] text-[#0b0e14] shadow-[0_0_24px_rgba(0,242,254,0.35)] transition-all hover:shadow-[0_0_34px_rgba(0,242,254,0.55)] disabled:opacity-50"
            >
              {loading === "form" ? <Spinner size={16} className="text-black" /> : null}
              {loading === "form" ? "LOGGING IN..." : "LOGIN"}
            </motion.button>

            <div className="mt-5 space-y-2 text-center text-xs text-white/50">
              <p>
                New to the Book?{" "}
                <a href={getNewIdLink} target="_blank" rel="noopener noreferrer" className="font-bold text-goldlight hover:underline">
                  GET NEW ID
                </a>
              </p>
              <p>
                Need Help?{" "}
                <a href={supportLink} target="_blank" rel="noopener noreferrer" className="font-bold text-white/80 hover:underline">
                  Contact Support
                </a>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 border-t border-white/[0.06] pt-4">
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 font-display text-[10px] font-bold text-neon transition-colors hover:bg-neon/20"
                aria-label="Telegram"
              >
                <Send size={14} />
                TELEGRAM SUPPORT
              </a>
              <a
                href={getNewIdLink}
                target="_blank"
                rel="noopener noreferrer"
                className="glow-neon flex h-9 items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-4 font-display text-[10px] font-bold text-goldlight hover:bg-gold/25"
              >
                <Sparkles size={13} className="text-gold" />
                GET NEW ID
              </a>
            </div>
          </motion.form>
        </motion.div>
      </div>
    </main>
  );
}

/* ==========================================================================
   PUNTER VIEW (Real-time wallet sync, live odds, zero-reload updates)
   ========================================================================== */

function PunterView({
  user,
  onUserUpdate,
  onLogout,
  onSessionCleared,
  showToast,
}: {
  user: UserMe;
  onUserUpdate: (u: UserMe) => void;
  onLogout: () => void;
  onSessionCleared: () => void;
  showToast: (m: string) => void;
}) {
  const [payload, setPayload] = useState<MatchesPayload | null>(null);
  const [bets, setBets] = useState<BetDTO[] | null>(null);
  const [txns, setTxns] = useState<TxDTO[] | null>(null);
  const [view, setView] = useState<
    "lobby" | "bets" | "statement" | "achievements" | "rules" | "schedules" | "support" | "withdraw" | "deposit" | "profile"
  >("lobby");
  const [drawer, setDrawer] = useState(false);
  const [league, setLeague] = useState("ALL");
  const [betTarget, setBetTarget] = useState<{ match: MatchItem; selection: "A" | "B" } | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const prevBalanceRef = useRef<number>(user.balance);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    prevBalanceRef.current = user.balance;
  }, [user.balance]);

  const fetchMatches = useCallback(async () => {
    try {
      const r = await fetch("/api/matches", { cache: "no-store", credentials: "include" });
      if (r.ok) setPayload(await r.json());
    } catch {
      /* keep previous payload */
    }
  }, []);

  const fetchBets = useCallback(async () => {
    try {
      const r = await fetch("/api/bets", { cache: "no-store", credentials: "include" });
      if (r.ok) setBets(await r.json());
    } catch {
      /* keep */
    }
  }, []);

  const fetchTx = useCallback(async () => {
    try {
      const r = await fetch("/api/transactions", { cache: "no-store", credentials: "include" });
      if (r.ok) setTxns(await r.json());
    } catch {
      /* keep */
    }
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (r.ok) {
        const u: UserMe = await r.json();
        const prevBal = prevBalanceRef.current;
        if (typeof u.balance === "number" && u.balance > prevBal) {
          const gained = u.balance - prevBal;
          showToast(`🏆 +${formatCoins(gained)} Rs. credited to your wallet!`);
          void fetchBets();
          void fetchTx();
        }
        prevBalanceRef.current = u.balance;
        onUserUpdate(u);
      }
    } catch {
      /* keep */
    }
  }, [onUserUpdate, showToast, fetchBets, fetchTx]);

  useEffect(() => {
    const syncAll = () => {
      void fetchMatches();
      void fetchMe();
      if (viewRef.current === "bets") void fetchBets();
      if (viewRef.current === "statement") void fetchTx();
    };

    void fetchMatches();
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        syncAll();
      }
    }, 3000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") syncAll();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", syncAll);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", syncAll);
    };
  }, [fetchMatches, fetchMe, fetchBets, fetchTx]);

  useEffect(() => {
    if (view === "bets") void fetchBets();
    if (view === "statement") void fetchTx();
  }, [view, fetchBets, fetchTx]);

  const frozen = payload?.settings.marketFrozen ?? false;
  const telegram = payload?.settings.supportUrl ?? payload?.settings.telegramUrl ?? "https://t.me/+FNrv5zNv6lI0ODk1";
  const depositTelegramLink = formatTelegramUrl(payload?.settings.depositTelegramUrl || payload?.settings.telegramUrl);
  const withdrawTelegramLink = formatTelegramUrl(payload?.settings.withdrawTelegramUrl || payload?.settings.telegramUrl);

  const leagues = useMemo(() => {
    if (!payload) return [];
    const out: string[] = [];
    for (const m of [...payload.live, ...payload.scheduled]) {
      if (!out.includes(m.league)) out.push(m.league);
    }
    return out;
  }, [payload]);

  const liveFiltered = useMemo(() => {
    if (!payload) return [];
    return league === "ALL" ? payload.live : payload.live.filter((m) => m.league === league);
  }, [payload, league]);

  return (
    <div className="bg-arena min-h-dvh">
      <header className="glass-deep sticky top-0 z-40 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => setView("lobby")} className="flex min-w-0 items-center gap-2">
              <Logo size={38} priority />
              <div className="min-w-0 text-left">
                <p className="truncate font-display text-[8px] font-black tracking-[0.16em] text-gold/70 sm:text-[9px] sm:tracking-[0.2em]">
                  SET MATCH ID
                </p>
                <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-[#f2ecda] sm:text-xs">
                  <User size={11} className="shrink-0 text-gold" />
                  <span className="truncate max-w-[6.5rem] sm:max-w-none">{user.username}</span>
                </div>
              </div>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="rounded-xl border border-neon/40 bg-neon/[0.08] px-2 py-1 text-right sm:px-3 sm:py-1.5">
              <span className="block text-[7.5px] font-black tracking-[0.14em] text-neon/70 sm:text-[8px]">BALANCE</span>
              <span className="font-mono text-[11px] font-bold text-neon sm:text-sm">
                {formatCoins(user.balance)} RS.
              </span>
            </div>

            <div className="rounded-xl border border-amber2/40 bg-amber2/[0.08] px-2 py-1 text-right sm:px-3 sm:py-1.5">
              <span className="block text-[7.5px] font-black tracking-[0.14em] text-amber2/70 sm:text-[8px]">EXPOSURE</span>
              <span className="font-mono text-[11px] font-bold text-amber2 sm:text-sm">
                {formatCoins(user.exposure)} RS.
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setDrawer(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 sm:h-10 sm:w-10"
              aria-label="Open menu"
            >
              <Menu size={19} />
            </motion.button>
          </div>
        </div>

        {/* Scrolling Announcement Marquee */}
        <div className="overflow-hidden border-y border-gold/25 bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 py-2 shadow-inner">
          <div className="animate-marquee-smooth flex whitespace-nowrap">
            <div className="flex shrink-0 items-center gap-6 pr-6 font-display text-[11.5px] font-black tracking-[0.18em] text-goldlight">
              <span className="animate-spin-normal inline-block text-sm drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🏏</span>
              <span>
                {payload?.settings.marqueeText ||
                  "Welcome to the Toss Book. Asia's No. 1 Gaming Platform. Min bet 100, Min Withdraw 500, Get 200 for Each Referral. Instant 24x7 Royal Service!"}
              </span>
              <span className="animate-spin-normal inline-block text-sm drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🪙</span>
              <span className="font-mono text-[10.5px] text-neon/90">⚡ 24x7 INSTANT DEPOSIT & WITHDRAWAL</span>
            </div>
            <div className="flex shrink-0 items-center gap-6 pr-6 font-display text-[11.5px] font-black tracking-[0.18em] text-goldlight">
              <span className="animate-spin-normal inline-block text-sm drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🏏</span>
              <span>
                {payload?.settings.marqueeText ||
                  "Welcome to the Toss Book. Asia's No. 1 Gaming Platform. Min bet 100, Min Withdraw 500, Get 200 for Each Referral. Instant 24x7 Royal Service!"}
              </span>
              <span className="animate-spin-normal inline-block text-sm drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]">🪙</span>
              <span className="font-mono text-[10.5px] text-neon/90">⚡ 24x7 INSTANT DEPOSIT & WITHDRAWAL</span>
            </div>
          </div>
        </div>

        {frozen && (
          <div className="border-b border-ruby/40 bg-ruby/20 py-2 text-center">
            <p className="flex items-center justify-center gap-2 font-display text-xs font-black tracking-widest text-ruby">
              <OctagonAlert size={14} className="animate-pulse" />
              EMERGENCY MARKET CLOSE - ALL BETTING IS SUSPENDED
            </p>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-5">
        {view === "lobby" ? (
          <div>
            <div className="no-scrollbar -mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
              {["ALL", ...leagues].map((l) => {
                const active = league === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLeague(l)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 font-display text-[10px] font-bold tracking-[0.14em] transition-all",
                      active
                        ? "border-gold bg-gold/20 text-goldlight shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:border-gold/30 hover:text-white/80",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            {/* Match Schedule PNG Banner & Clean Team Details */}
            <div className="mb-6 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-b from-[#141b2a]/95 via-[#0e1320]/95 to-[#090d14]/95 shadow-[0_0_35px_rgba(212,175,55,0.15)]">
              <div className="relative overflow-hidden bg-black/40">
                <SafePosterImg
                  src={payload?.settings?.matchScheduleBanner || DEFAULT_BANNER}
                  alt="Official Match Schedule PNG"
                  priority
                  className="max-h-56 w-full object-cover object-center transition-transform duration-700 hover:scale-[1.01]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0e1320] via-black/20 to-black/40" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-black/85 px-3 py-1 font-display text-[9.5px] font-black tracking-widest text-goldlight shadow-lg backdrop-blur-md sm:text-[10px]">
                    <Sparkles size={11} className="text-gold" /> OFFICIAL MATCH SCHEDULE
                  </span>
                  <span className="rounded-full border border-neon/40 bg-black/85 px-3 py-1 font-mono text-[9px] font-bold text-neon backdrop-blur-md sm:text-[9.5px]">
                    ⚡ TODAY&apos;S FIXTURES
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-[10px] font-black tracking-[0.2em] text-white/50">
                    MATCH FIXTURES & TEAMS
                  </span>
                  <span className="font-mono text-[10px] text-goldlight">TOSS MARKET OPEN</span>
                </div>

                <div className="space-y-2.5">
                  {payload?.live && payload.live.length > 0 ? (
                    payload.live.slice(0, 2).map((m) => (
                      <div
                        key={`sched-top-${m.id}`}
                        className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition-all hover:border-gold/30 hover:bg-white/[0.05] sm:flex-row sm:items-center"
                      >
                        <div>
                          <span className="font-display text-[9px] font-black tracking-wider text-gold/80">
                            {m.league}
                          </span>
                          <h3 className="font-display text-base font-black tracking-wider text-white">
                            {m.teamA} VS {m.teamB}
                          </h3>
                          <p className="font-mono text-[10.5px] text-white/50">
                            Toss Close Time: <strong className="text-neon">{formatClock(m.tossCloseTime)}</strong>
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            disabled={m.status === "locked" || frozen}
                            onClick={() => {
                              if (frozen) {
                                showToast("Markets are frozen by Admin right now");
                                return;
                              }
                              if (m.status === "locked") {
                                showToast("Betting is suspended for this toss contest");
                                return;
                              }
                              setBetTarget({ match: m, selection: "A" });
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2 font-display text-[10px] font-black tracking-wider transition-all",
                              m.status === "locked" || frozen
                                ? "cursor-not-allowed border-white/10 bg-black/60 text-white/40"
                                : "glow-neon border-neon/50 bg-neon/15 text-neon hover:bg-neon/25",
                            )}
                          >
                            {m.teamA} ({m.oddsA.toFixed(2)}x)
                          </button>
                          <button
                            disabled={m.status === "locked" || frozen}
                            onClick={() => {
                              if (frozen) {
                                showToast("Markets are frozen by Admin right now");
                                return;
                              }
                              if (m.status === "locked") {
                                showToast("Betting is suspended for this toss contest");
                                return;
                              }
                              setBetTarget({ match: m, selection: "B" });
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2 font-display text-[10px] font-black tracking-wider transition-all",
                              m.status === "locked" || frozen
                                ? "cursor-not-allowed border-white/10 bg-black/60 text-white/40"
                                : "glow-neon border-neon/50 bg-neon/15 text-neon hover:bg-neon/25",
                            )}
                          >
                            {m.teamB} ({m.oddsB.toFixed(2)}x)
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:flex-row sm:items-center">
                      <div>
                        <span className="font-display text-[9px] font-black tracking-wider text-gold/80">
                          TOSS 786 SPECIAL
                        </span>
                        <h3 className="font-display text-base font-black tracking-wider text-white">
                          INDIA VS NEPAL
                        </h3>
                        <p className="font-mono text-[10px] text-white/50">
                          Scheduled Today • 95 Paise Royal Market
                        </p>
                      </div>
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-xs font-bold text-goldlight">
                        UPCOMING
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Contests Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-neon" />
                <h2 className="font-display text-sm font-black tracking-[0.24em] text-[#f2ecda]">
                  LIVE CONTESTS
                </h2>
                {payload && (
                  <span className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-neon">
                    {liveFiltered.length}
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSpinning(true);
                  void Promise.all([fetchMatches(), fetchMe()]).finally(() => {
                    setTimeout(() => setSpinning(false), 500);
                  });
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 font-display text-[10px] font-bold tracking-[0.15em] text-gold/80 hover:bg-white/[0.04]"
              >
                <RefreshCw size={12} className={spinning ? "animate-spin text-gold" : ""} />
                RELOAD
              </button>
            </div>

            {/* Match Cards */}
            {!payload ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="glass metal-border h-36 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : liveFiltered.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="NO LIVE CONTESTS RIGHT NOW"
                hint="New matches open round the clock. Check Schedules for upcoming games."
              />
            ) : (
              <div className="space-y-4">
                {liveFiltered.map((m) => (
                  <div
                    key={m.id}
                    className="glass metal-border overflow-hidden rounded-2xl p-4 transition-all hover:border-gold/30"
                  >
                    <div className="relative mb-3.5 overflow-hidden rounded-xl border border-gold/25 bg-black/70 shadow-lg">
                      <SafePosterImg
                        src={m.matchImg || payload?.settings?.matchScheduleBanner || DEFAULT_BANNER}
                        alt={`${m.teamA} vs ${m.teamB}`}
                        className="h-36 w-full object-cover object-center transition-transform duration-700 hover:scale-[1.03] sm:h-44"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0e1320] via-black/35 to-black/30" />

                      <div className="absolute left-3 right-3 top-2.5 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-gold/40 bg-black/80 px-2.5 py-0.5 font-display text-[9px] font-black tracking-widest text-goldlight backdrop-blur-md">
                          {m.league}
                        </span>
                        {m.status === "locked" ? (
                          <span className="flex items-center gap-1.5 rounded-full border border-ruby/50 bg-black/85 px-2.5 py-0.5 font-mono text-[9px] font-bold text-ruby backdrop-blur-md">
                            <Lock size={10} /> SUSPENDED (BET CLOSED)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full border border-neon/30 bg-black/85 px-2.5 py-0.5 font-mono text-[9px] font-bold text-neon backdrop-blur-md">
                            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-neon" />
                            LIVE TOSS
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="font-display text-base font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {m.teamA} VS {m.teamB}
                          </p>
                          <p className="font-mono text-[10px] font-bold text-goldlight drop-shadow">
                            Toss Close: {formatClock(m.tossCloseTime)}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/20 bg-black/75 px-2 py-0.5 font-mono text-[9px] font-bold text-white/80 backdrop-blur-sm">
                          95 PAISE MARKET
                        </span>
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <button
                        disabled={m.status === "locked" || frozen}
                        onClick={() => {
                          if (frozen) {
                            showToast("Markets are frozen by Admin");
                            return;
                          }
                          if (m.status === "locked") {
                            showToast("Betting is suspended for this toss contest");
                            return;
                          }
                          setBetTarget({ match: m, selection: "A" });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border py-3 transition-all",
                          m.status === "locked" || frozen
                            ? "cursor-not-allowed border-white/10 bg-black/60 opacity-60"
                            : "border-neon/30 bg-black/40 hover:border-neon hover:bg-neon/[0.08]",
                        )}
                      >
                        <span className="font-display text-xs font-black tracking-wide text-white">
                          {m.teamA}
                        </span>
                        <span className="mt-1 font-mono text-xs font-bold text-neon">
                          {m.status === "locked" ? "SUSPENDED" : `95 PAISE (${m.oddsA.toFixed(2)}x)`}
                        </span>
                      </button>

                      <button
                        disabled={m.status === "locked" || frozen}
                        onClick={() => {
                          if (frozen) {
                            showToast("Markets are frozen by Admin");
                            return;
                          }
                          if (m.status === "locked") {
                            showToast("Betting is suspended for this toss contest");
                            return;
                          }
                          setBetTarget({ match: m, selection: "B" });
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border py-3 transition-all",
                          m.status === "locked" || frozen
                            ? "cursor-not-allowed border-white/10 bg-black/60 opacity-60"
                            : "border-neon/30 bg-black/40 hover:border-neon hover:bg-neon/[0.08]",
                        )}
                      >
                        <span className="font-display text-xs font-black tracking-wide text-white">
                          {m.teamB}
                        </span>
                        <span className="mt-1 font-mono text-xs font-bold text-neon">
                          {m.status === "locked" ? "SUSPENDED" : `95 PAISE (${m.oddsB.toFixed(2)}x)`}
                        </span>
                      </button>
                    </div>

                    {m.status === "locked" ? (
                      <div className="rounded-xl border border-ruby/30 bg-ruby/[0.08] px-3 py-2 text-center">
                        <p className="flex items-center justify-center gap-1.5 font-display text-[10.5px] font-black tracking-[0.16em] text-ruby">
                          <Lock size={12} /> TOSS BET CLOSED (SUSPENDED)
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/50">
                          Closed at {formatClock(m.tossCloseTime)} • Waiting for Toss Result
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gold/20 bg-gold/[0.08] px-3 py-2 text-center">
                        <p className="font-display text-[10.5px] font-black tracking-[0.16em] text-goldlight">
                          TOSS BET CLOSE TIME: {formatClock(m.tossCloseTime)}
                        </p>
                        <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-xs text-neon">
                          <span>CLOSING IN:</span>
                          <Countdown
                            target={m.tossCloseTime}
                            compact
                            className="font-bold text-neon"
                            onZero={() => void fetchMatches()}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => setView("lobby")}
              className="mb-4 flex items-center gap-1 text-xs font-bold text-gold hover:underline"
            >
              ← BACK TO LOBBY
            </button>

            {view === "bets" && (
              <PunterBets
                bets={bets}
                showToast={showToast}
                onBetCancelled={(res) => {
                  prevBalanceRef.current = res.balance;
                  onUserUpdate({
                    ...user,
                    balance: res.balance,
                    exposure: res.exposure,
                  });
                  void fetchBets();
                  void fetchTx();
                  void fetchMatches();
                }}
              />
            )}
            {view === "statement" && <PunterStatement txns={txns} />}
            {view === "rules" && <PunterRules />}
            {view === "schedules" && (
              <PunterSchedules
                scheduled={payload?.scheduled ?? []}
                finishedToday={payload?.finishedToday ?? []}
              />
            )}
            {view === "achievements" && <PunterAchievements />}
            {view === "profile" && (
              <div className="space-y-4">
                <div className="glass metal-border rounded-3xl p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-3 border-b border-gold/15 pb-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/15 font-display text-sm font-black text-goldlight">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-black tracking-widest text-goldlight">
                        {user.username}
                      </h3>
                      <p className="font-mono text-[10.5px] text-white/45">
                        Phone: {user.phone || "Not Linked"} • PREMIUM MEMBER
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-neon/30 bg-neon/[0.06] p-3.5">
                      <span className="block font-display text-[9px] font-black tracking-[0.18em] text-neon/75">
                        AVAILABLE BALANCE
                      </span>
                      <span className="mt-1 block font-mono text-base font-bold text-neon sm:text-lg">
                        {formatCoins(user.balance)} Rs.
                      </span>
                    </div>
                    <div className="rounded-2xl border border-amber2/30 bg-amber2/[0.06] p-3.5">
                      <span className="block font-display text-[9px] font-black tracking-[0.18em] text-amber2/75">
                        ACTIVE EXPOSURE
                      </span>
                      <span className="mt-1 block font-mono text-base font-bold text-amber2 sm:text-lg">
                        {formatCoins(user.exposure)} Rs.
                      </span>
                    </div>
                  </div>
                </div>

                <ChangePasswordCard
                  username={user.username}
                  showToast={showToast}
                  onPasswordChanged={onSessionCleared}
                />
              </div>
            )}
            {(view === "support" || view === "deposit" || view === "withdraw") && (
              <PunterCare
                mode={view}
                telegram={telegram}
                depositUrl={depositTelegramLink}
                withdrawUrl={withdrawTelegramLink}
                username={user.username}
              />
            )}
          </div>
        )}
      </div>

      {/* Drawer Menu */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="glass-deep fixed inset-y-0 right-0 z-[110] flex w-72 max-w-[85vw] flex-col border-l border-gold/20 p-5 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-display text-sm font-black tracking-[0.25em] text-goldlight">
                  MENU
                </span>
                <button onClick={() => setDrawer(false)} className="text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <nav className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto">
                {[
                  { key: "lobby", label: "LOBBY", icon: Radio },
                  { key: "bets", label: "PENDING BETS", icon: ReceiptText },
                  { key: "statement", label: "STATEMENT", icon: NotebookPen },
                  { key: "achievements", label: "ACHIEVEMENT POSTS", icon: Trophy },
                  { key: "rules", label: "RULES", icon: Scale },
                  { key: "schedules", label: "SCHEDULES", icon: CalendarClock },
                  { key: "profile", label: "PROFILE & PASSWORD", icon: KeyRound },
                  { key: "support", label: "CUSTOMER SUPPORT", icon: Headset },
                  { key: "withdraw", label: "WITHDRAW", icon: ArrowUpFromLine, href: withdrawTelegramLink },
                  { key: "deposit", label: "DEPOSIT", icon: ArrowDownToLine, href: depositTelegramLink },
                ].map(({ key, label, icon: Icon, href }) =>
                  href ? (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setDrawer(false)}
                      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left font-display text-xs font-bold tracking-[0.16em] text-white/60 transition-all hover:bg-white/[0.04] hover:text-white"
                    >
                      <Icon size={16} className="text-gold" />
                      <span>{label}</span>
                    </a>
                  ) : (
                    <button
                      key={key}
                      onClick={() => {
                        setView(key as typeof view);
                        setDrawer(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left font-display text-xs font-bold tracking-[0.16em] transition-all",
                        view === key
                          ? "border border-gold/40 bg-gold/15 text-goldlight"
                          : "text-white/60 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <Icon size={16} className="text-gold" />
                      <span>{label}</span>
                    </button>
                  ),
                )}
              </nav>

              <div className="border-t border-white/[0.08] pt-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 font-bold text-gold">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-goldlight">{user.username}</p>
                    <p className="text-[9px] font-bold text-white/40">PREMIUM MEMBER</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setView("profile");
                    setDrawer(false);
                  }}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gold/35 bg-gold/10 py-2.5 font-display text-xs font-black tracking-widest text-goldlight hover:bg-gold/20"
                >
                  <KeyRound size={14} /> CHANGE PASSWORD
                </button>

                <button
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-ruby/40 bg-ruby/10 py-2.5 font-display text-xs font-black tracking-widest text-ruby hover:bg-ruby/20"
                >
                  <LogOut size={14} /> SIGN OUT
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Bet Modal */}
      <BetModal
        target={betTarget}
        balance={user.balance}
        minBet={payload?.settings.minBet ?? 100}
        onClose={() => setBetTarget(null)}
        onSuccess={(newBal, newExp) => {
          prevBalanceRef.current = newBal;
          onUserUpdate({
            ...user,
            balance: newBal,
            exposure: typeof newExp === "number" ? newExp : user.exposure,
          });
          void fetchMatches();
          void fetchBets();
          void fetchTx();
          showToast("Bet successfully placed! Wallet & exposure synced.");
        }}
      />

      {depositOpen && (
        <PunterDepositModal
          telegram={telegram}
          username={user.username}
          minBet={payload?.settings.minBet ?? 100}
          onClose={() => setDepositOpen(false)}
        />
      )}

      {withdrawOpen && (
        <PunterWithdrawModal
          telegram={telegram}
          username={user.username}
          balance={user.balance}
          minWithdraw={payload?.settings.minWithdraw ?? 500}
          onClose={() => setWithdrawOpen(false)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   BET MODAL
   ========================================================================== */

function BetModal({
  target,
  balance,
  minBet,
  onClose,
  onSuccess,
}: {
  target: { match: MatchItem; selection: "A" | "B" } | null;
  balance: number;
  minBet: number;
  onClose: () => void;
  onSuccess: (newBalance: number, newExposure?: number) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selection, setSelection] = useState<"A" | "B">("A");
  const [stakeStr, setStakeStr] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (target) {
      setStep(1);
      setSelection(target.selection);
      setStakeStr(String(Math.max(100, minBet)));
      setError("");
      setBusy(false);
    }
  }, [target, minBet]);

  if (!target) return null;

  const match = target.match;
  const stake = sanitizeStake(stakeStr);
  const odds = selection === "A" ? match.oddsA : match.oddsB;
  const chosenTeam = selection === "A" ? match.teamA : match.teamB;
  const potential = calculatePayout(stake, odds);
  const isInsufficient = stake > balance;

  async function handleConfirm() {
    if (busy) return;
    if (stake < minBet) {
      setError(`Minimum bet is ${minBet} Rs.`);
      return;
    }
    if (isInsufficient) {
      setError("Insufficient wallet balance (Rs.) to place this bet.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matchId: match.id, selection, stake }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Bet could not be placed.");
        setBusy(false);
        return;
      }
      onSuccess(data.balance, data.exposure);
      onClose();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-black tracking-[0.2em] text-goldlight">
            PLACE YOUR BET
          </h3>
          <button
            disabled={busy}
            onClick={onClose}
            className="text-white/40 hover:text-white disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {step === 1 ? (
          <div>
            <p className="mb-2 font-display text-[9px] font-black tracking-widest text-white/40">
              SELECT TEAM
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelection("A")}
                className={cn(
                  "rounded-xl border p-2.5 text-center font-display text-xs font-bold transition-all",
                  selection === "A"
                    ? "border-neon bg-neon/15 text-neon shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                    : "border-white/10 bg-white/[0.03] text-white/60",
                )}
              >
                {match.teamA}
              </button>
              <button
                onClick={() => setSelection("B")}
                className={cn(
                  "rounded-xl border p-2.5 text-center font-display text-xs font-bold transition-all",
                  selection === "B"
                    ? "border-neon bg-neon/15 text-neon shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                    : "border-white/10 bg-white/[0.03] text-white/60",
                )}
              >
                {match.teamB}
              </button>
            </div>

            <p className="mb-2 font-display text-[9px] font-black tracking-widest text-white/40">
              ENTER BET AMOUNT (MIN {minBet} RS.)
            </p>
            <div className="relative mb-3">
              <input
                value={stakeStr}
                onChange={(e) => setStakeStr(e.target.value.replace(/\D/g, ""))}
                placeholder={String(minBet)}
                className="w-full rounded-xl border border-gold/20 bg-black/40 py-3 pl-4 pr-12 font-mono text-lg font-bold text-goldlight outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-white/40">
                RS.
              </span>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-1.5">
              {[100, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStakeStr(String(sanitizeStake(stakeStr) + v))}
                  className="rounded-lg border border-gold/25 bg-gold/[0.06] py-1.5 font-mono text-xs text-goldlight hover:bg-gold/[0.15]"
                >
                  +{v}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStakeStr(String(Math.max(0, Math.floor(balance))))}
                className="rounded-lg border border-neon/40 bg-neon/[0.08] py-1.5 font-mono text-xs font-bold text-neon"
              >
                MAX
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2 text-[11px]">
              <span className="text-white/50">EST. RETURN ({odds.toFixed(2)}x)</span>
              <span className="font-mono font-bold text-mint">{formatCoins(potential)} Rs.</span>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={stake < minBet || isInsufficient}
              className="gold-btn w-full rounded-xl py-3 font-display text-xs font-black tracking-widest disabled:opacity-40"
            >
              {isInsufficient ? "INSUFFICIENT BALANCE" : "REVIEW BET"}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 font-display text-[10px] font-black tracking-widest text-goldlight">
              CONFIRM SELECTION
            </p>
            <div className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">SUPPORTING</span>
                <span className="font-bold text-neon">{chosenTeam}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">BET AMOUNT</span>
                <span className="font-mono font-bold text-white">{formatCoins(stake)} Rs.</span>
              </div>
              <div className="flex justify-between border-t border-white/[0.06] pt-2">
                <span className="text-white/40">POTENTIAL RETURN</span>
                <span className="font-mono font-bold text-mint">{formatCoins(potential)} Rs.</span>
              </div>
            </div>

            {isInsufficient && (
              <p className="mb-3 text-center text-xs font-semibold text-ruby">
                Insufficient wallet balance (Rs.) to place this bet.
              </p>
            )}

            {error && <p className="mb-3 text-center text-xs font-semibold text-ruby">{error}</p>}

            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-white/15 py-3 font-display text-xs font-bold text-white/70 disabled:opacity-40"
              >
                BACK
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || isInsufficient || stake < minBet}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint py-3 font-display text-xs font-black tracking-widest text-black disabled:opacity-40"
              >
                {busy ? <Spinner size={14} className="text-black" /> : null}
                {busy ? "PLACING..." : "CONFIRM BET"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PUNTER SECONDARY VIEWS
   ========================================================================== */

function PunterRules() {
  const rules = [
    "IF TOSS RESULT COME BEFORE OUR TOSS BET CLOSE TIME, THEN THAT BET SHOULD BE INVALID ✕.",
    "WITHDRAWAL ANYTIME ONCE A DAY.",
    "EMERGENCY WITHDRAWAL AVAILABLE ONCE A MONTH.",
    "BALANCE TRANSFER FORM TOSS ID TO MATCH ID OR MATCH ID TO TOSS ID ARE AVAILABLE.",
    "THERE IS NO DEPOSIT BONUS ON TOSS BOOK.",
    "GET ₹200 FOR EACH REFERRAL.",
    "WITHDRAWALS WILL BE PROCESS ON THE SAME ACCOUNT YOU MADE THE DEPOSIT.",
    "YOU MUST COMPLETE A 100% ROLLING ON ALL DEPOSITED OR TRANSFERRED FUNDS BEFORE MAKING A WITHDRAWAL. ADDITIONALLY, FOLLOWING YOUR LAST WITHDRAWAL, THE REMAINING BALANCE REQUIRES ANOTHER 100% ROLLING BEFORE YOU CAN WITHDRAW AGAIN.",
    "TOSS RATE 95PAISE (1.95x).",
    "PAYMENT DETAILS ARE VALID ONLY FOR 10 MINUTES.",
    "EVERY TIME ASK FOR DEPOSIT DETAILS, THEN DO DEPOSIT.",
    "ALWAYS SEND FULL DETAILED PAYMENT SCREENSHOT.",
    "ONCE BET IS CLOSED ON SITE, DON'T DISTURB US ON TELEGRAM.",
    "IF YOU ARE BLOCKED FOR A WHOLE LIFE AND WANT TO GET UNBLOCKED THEN YOU WILL HAVE TO PAY A FINE OF RS 1000.",
  ];

  return (
    <div className="glass metal-border rounded-3xl p-6 sm:p-7">
      <h3 className="mb-4 font-display text-sm font-black tracking-widest text-goldlight">
        SOME BASIC RULES
      </h3>
      <div className="space-y-3.5">
        {rules.map((r, i) => (
          <div key={i} className="flex gap-3 text-xs leading-relaxed text-white/75">
            <span className="font-display font-bold text-gold">{i + 1}.</span>
            <span>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PunterBets({
  bets,
  showToast,
  onBetCancelled,
}: {
  bets: BetDTO[] | null;
  showToast: (m: string) => void;
  onBetCancelled: (res: { balance: number; exposure: number }) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost" | "cancelled">("all");
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  if (!bets) return <p className="text-center text-xs text-white/40">Loading bets...</p>;
  if (bets.length === 0) {
    return <EmptyState icon={Inbox} title="NO BETS PLACED" hint="Back a team in Live Contests to see your slips here." />;
  }

  const filtered = bets.filter((b) => (filter === "all" ? true : b.status === filter));

  async function confirmCancel(bet: BetDTO) {
    if (cancellingId !== null) return;
    setCancellingId(bet.id);
    try {
      const res = await fetch(`/api/bets/${bet.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Could not cancel bet");
        setConfirmCancelId(null);
        return;
      }
      showToast(
        `Bet cancelled! ${formatCoins(data.refunded)} Rs. refunded (${formatCoins(data.fee)} Rs. 2% fee deducted).`,
      );
      setConfirmCancelId(null);
      onBetCancelled({ balance: Number(data.balance), exposure: Number(data.exposure) });
    } catch {
      showToast("Network error while cancelling bet");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { key: "all", label: `ALL (${bets.length})` },
            { key: "pending", label: `PENDING (${bets.filter((b) => b.status === "pending").length})` },
            { key: "won", label: "WON" },
            { key: "lost", label: "LOST" },
            { key: "cancelled", label: "CANCELLED" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 font-display text-[9.5px] font-bold tracking-wider transition-all",
              filter === key
                ? "border-gold bg-gold/20 text-goldlight"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="NO MATCHING BETS" hint="Switch filter tabs above to view other bet slips." />
      ) : (
        filtered.map((b) => {
          const isPending = b.status === "pending";
          const canCancel = isPending && b.canCancel !== false && b.matchStatus === "open";
          const isConfirming = confirmCancelId === b.id;
          const isBusy = cancellingId === b.id;
          const { fee, refund } = calculateCancellationRefund(b.stake, 2);

          return (
            <div key={b.id} className="glass metal-border rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-bold text-gold">{b.league}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-mono text-[9px] font-black",
                    b.status === "won"
                      ? "bg-mint/15 text-mint"
                      : b.status === "lost"
                        ? "bg-ruby/15 text-ruby"
                        : b.status === "refunded" || b.status === "cancelled"
                          ? "bg-amber2/15 text-amber2"
                          : "bg-neon/15 text-neon",
                  )}
                >
                  {b.status.toUpperCase()}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-[#f0ebdb]">
                {b.teamA} vs {b.teamB}
              </p>
              <p className="mt-0.5 font-mono text-[9.5px] text-white/35">
                Placed: {formatDateTime(b.createdAt)}
                {b.settledAt ? ` · Updated: ${formatDateTime(b.settledAt)}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-xs">
                <span>
                  Backed: <strong className="text-goldlight">{b.selectionTeam}</strong> @ {b.odds.toFixed(2)}x
                </span>
                <span>
                  Stake: <strong className="text-goldlight">{formatCoins(b.stake)} Rs.</strong>
                </span>
                <span>
                  {b.status === "won"
                    ? "Credited: "
                    : b.status === "lost"
                      ? "Payout: "
                      : b.status === "refunded"
                        ? "Refunded: "
                        : b.status === "cancelled"
                          ? "Refunded (98%): "
                          : "Potential: "}
                  <strong
                    className={cn(
                      b.status === "lost"
                        ? "text-ruby"
                        : b.status === "refunded" || b.status === "cancelled"
                          ? "text-amber2"
                          : "text-mint",
                    )}
                  >
                    {b.status === "lost"
                      ? "0 Rs."
                      : b.status === "refunded"
                        ? `${formatCoins(b.stake)} Rs.`
                        : b.status === "cancelled"
                          ? `${formatCoins(refund)} Rs.`
                          : `${formatCoins(b.potential)} Rs.`}
                  </strong>
                </span>
              </div>

              {canCancel && (
                <div className="mt-3 border-t border-white/[0.05] pt-3">
                  {isConfirming ? (
                    <div className="rounded-xl border border-amber2/40 bg-amber2/[0.08] p-3">
                      <p className="font-display text-[10px] font-black tracking-wider text-amber2">
                        CONFIRM BET CANCELLATION (2% FEE DEDUCTION)
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-black/40 p-2 text-center font-mono text-[10px]">
                        <div>
                          <span className="block text-[8px] text-white/40">STAKE</span>
                          <strong className="text-white">{formatCoins(b.stake)} Rs.</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] text-ruby/80">2% FEE</span>
                          <strong className="text-ruby">-{formatCoins(fee)} Rs.</strong>
                        </div>
                        <div>
                          <span className="block text-[8px] text-mint/80">98% REFUND</span>
                          <strong className="text-mint">+{formatCoins(refund)} Rs.</strong>
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmCancelId(null)}
                          className="flex-1 rounded-lg border border-white/15 py-2 font-display text-[10px] font-bold text-white/70 hover:text-white disabled:opacity-40"
                        >
                          KEEP BET
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void confirmCancel(b)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber2 py-2 font-display text-[10px] font-black text-black disabled:opacity-50"
                        >
                          {isBusy ? <Spinner size={12} className="text-black" /> : null}
                          {isBusy ? "CANCELLING..." : `CONFIRM (+${formatCoins(refund)} RS.)`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={cancellingId !== null}
                      onClick={() => setConfirmCancelId(b.id)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber2/35 bg-amber2/[0.08] py-2 font-display text-[10px] font-black tracking-wider text-amber2 transition-all hover:bg-amber2/20 disabled:opacity-40"
                    >
                      CANCEL BET (2% FEE • REFUND {formatCoins(refund)} RS.)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function PunterStatement({ txns }: { txns: TxDTO[] | null }) {
  if (!txns) return <p className="text-center text-xs text-white/40">Loading statement...</p>;
  if (txns.length === 0) {
    return <EmptyState icon={Inbox} title="NO TRANSACTIONS" hint="Wallet movements and winnings appear here." />;
  }

  return (
    <div className="glass metal-border overflow-hidden rounded-2xl">
      {txns.map((t, i) => {
        const isLoss = t.type === "loss" || t.amount === 0;
        const isCancelRefund = t.type === "bet_cancelled";
        return (
          <div
            key={t.id}
            className={cn("flex items-center justify-between gap-3 p-4", i !== txns.length - 1 && "border-b border-white/[0.05]")}
          >
            <div className="min-w-0">
              <p
                className={cn(
                  "font-display text-[10.5px] font-bold",
                  isCancelRefund ? "text-amber2" : "text-white/75",
                )}
              >
                {isCancelRefund ? "BET CANCELLED (98% REFUND)" : t.type.toUpperCase()}
              </p>
              {t.note && <p className="mt-0.5 text-xs text-white/40">{t.note}</p>}
              <p className="mt-0.5 text-[9.5px] text-white/25">
                {formatDateTime(t.createdAt)} · Balance: {formatCoins(t.balanceAfter)} Rs.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 font-mono text-sm font-bold",
                isLoss ? "text-white/45" : isCancelRefund ? "text-amber2" : t.amount > 0 ? "text-mint" : "text-ruby",
              )}
            >
              {isLoss
                ? "0 Rs."
                : t.amount > 0
                  ? `+${formatCoins(t.amount)} Rs.`
                  : `${formatCoins(t.amount)} Rs.`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PunterSchedules({ scheduled, finishedToday }: { scheduled: MatchItem[]; finishedToday: MatchItem[] }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 font-display text-xs font-bold tracking-widest text-neon">
          UPCOMING CONTESTS ({scheduled.length})
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {scheduled.map((m) => (
            <div key={m.id} className="glass metal-border overflow-hidden rounded-2xl p-4 transition-all hover:border-gold/30">
              <div className="relative mb-3 overflow-hidden rounded-xl border border-gold/25 bg-black/70 shadow-md">
                <SafePosterImg
                  src={m.matchImg || DEFAULT_BANNER}
                  alt={`${m.teamA} vs ${m.teamB}`}
                  className="h-32 w-full object-cover object-center transition-transform duration-500 hover:scale-105 sm:h-36"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute left-2.5 top-2 rounded-full border border-gold/40 bg-black/80 px-2 py-0.5 font-display text-[9px] font-black text-goldlight backdrop-blur-md">
                  {m.league}
                </span>
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                  <p className="font-display text-sm font-black text-white drop-shadow">
                    {m.teamA} VS {m.teamB}
                  </p>
                  <span className="rounded-full border border-neon/30 bg-neon/15 px-2 py-0.5 font-mono text-[8.5px] font-bold text-neon">
                    UPCOMING FIXTURE
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5">
                <div>
                  <p className="font-mono text-[10px] text-white/50">
                    Match Time: <strong className="text-white">{formatClock(m.startTime)}</strong>
                  </p>
                  <p className="font-mono text-[9.5px] text-amber2">
                    Toss Close: {formatClock(m.tossCloseTime)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[9px] text-neon">STARTS IN:</span>
                  <Countdown target={m.startTime} compact className="font-mono text-xs font-bold text-neon" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-xs font-bold tracking-widest text-goldlight">
          FINISHED TODAY ({finishedToday.length})
        </p>
        <div className="space-y-2">
          {finishedToday.map((m) => (
            <div key={m.id} className="glass metal-border flex items-center justify-between rounded-xl p-3">
              <div>
                <p className="text-[10px] text-gold">{m.league}</p>
                <p className="text-xs font-bold">
                  {m.teamA} vs {m.teamB}
                </p>
              </div>
              <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-[10px] text-goldlight">
                {m.status === "cancelled" ? "CANCELLED" : `${m.winner === "A" ? m.teamA : m.teamB} WON`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PunterAchievements() {
  return (
    <div className="glass metal-border rounded-3xl p-6 text-center">
      <Trophy size={40} className="mx-auto mb-3 text-gold" />
      <h3 className="font-display text-sm font-black tracking-widest text-goldlight">
        RECENT ROYAL WINNERS
      </h3>
      <p className="mt-2 text-xs text-white/50">
        Top punter payouts processed instantly via 24/7 Telegram concierge.
      </p>
      <div className="mt-4 space-y-2 font-mono text-xs text-white/70">
        <div className="flex justify-between border-b border-white/[0.05] py-2">
          <span>punter_9812</span>
          <span className="text-mint">+48,750 Rs.</span>
        </div>
        <div className="flex justify-between border-b border-white/[0.05] py-2">
          <span>devil_786</span>
          <span className="text-mint">+97,500 Rs.</span>
        </div>
        <div className="flex justify-between py-2">
          <span>royal_king</span>
          <span className="text-mint">+25,000 Rs.</span>
        </div>
      </div>
    </div>
  );
}

function PunterCare({
  mode,
  telegram,
  depositUrl,
  withdrawUrl,
  username,
}: {
  mode: "support" | "deposit" | "withdraw";
  telegram: string;
  depositUrl: string;
  withdrawUrl: string;
  username: string;
}) {
  return (
    <div className="glass metal-border rounded-3xl p-8 text-center">
      <h3 className="text-gold-grad font-display text-lg font-black tracking-widest">
        {mode === "deposit"
          ? "INSTANT DEPOSIT VIA TELEGRAM"
          : mode === "withdraw"
            ? "INSTANT WITHDRAWAL VIA TELEGRAM"
            : "CUSTOMER CONCIERGE 24/7"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/50">
        Direct official Telegram concierge redirection. Message admin directly with your ID!
      </p>
      <div className="mx-auto my-4 max-w-xs rounded-xl border border-gold/20 bg-black/40 p-3 font-mono text-xs text-goldlight">
        YOUR ID: <strong className="text-neon">{username}</strong>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {mode === "deposit" && (
          <a
            href={depositUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-mint px-6 py-3.5 font-display text-xs font-black tracking-widest text-black shadow-[0_0_20px_rgba(47,230,167,0.3)] transition-all hover:scale-[1.02]"
          >
            <Send size={15} /> OPEN DEPOSIT (TELEGRAM)
          </a>
        )}
        {mode === "withdraw" && (
          <a
            href={withdrawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-amber2 px-6 py-3.5 font-display text-xs font-black tracking-widest text-black shadow-[0_0_20px_rgba(243,156,18,0.3)] transition-all hover:scale-[1.02]"
          >
            <Send size={15} /> OPEN WITHDRAW (TELEGRAM)
          </a>
        )}
        <a
          href={telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="glow-neon inline-flex items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/10 px-6 py-3.5 font-display text-xs font-black tracking-widest text-neon transition-all hover:scale-[1.02]"
        >
          <Headset size={15} /> 24x7 CUSTOMER SUPPORT
        </a>
      </div>
    </div>
  );
}

function PunterDepositModal({
  telegram,
  username,
  minBet,
  onClose,
}: {
  telegram: string;
  username: string;
  minBet: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("500");

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-black tracking-widest text-mint">DEPOSIT COINS</h3>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs text-white/50">
          Enter deposit amount. Minimum deposit is {minBet} Rs. Ask Telegram support for current QR/UPI details.
        </p>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          className="mb-4 w-full rounded-xl border border-gold/20 bg-black/40 p-3 font-mono text-lg font-bold text-goldlight outline-none"
        />
        <a
          href={`${telegram}?text=${encodeURIComponent(`Hello, I want to deposit ${amount} Rs into Toss Book ID: ${username}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint py-3 font-display text-xs font-black tracking-widest text-black"
        >
          <Send size={14} /> SEND DEPOSIT REQUEST ON TELEGRAM
        </a>
      </div>
    </div>
  );
}

function PunterWithdrawModal({
  telegram,
  username,
  balance,
  minWithdraw,
  onClose,
}: {
  telegram: string;
  username: string;
  balance: number;
  minWithdraw: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(minWithdraw));

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-sm font-black tracking-widest text-amber2">WITHDRAW COINS</h3>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="mb-1 text-xs text-white/50">
          Available balance: <strong className="text-goldlight">{formatCoins(balance)} Rs.</strong>
        </p>
        <p className="mb-3 text-xs text-white/50">
          Minimum withdrawal is {minWithdraw} Rs. Processed 24/7.
        </p>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          className="mb-4 w-full rounded-xl border border-gold/20 bg-black/40 p-3 font-mono text-lg font-bold text-goldlight outline-none"
        />
        <a
          href={`${telegram}?text=${encodeURIComponent(`Hello, I want to withdraw ${amount} Rs from Toss Book ID: ${username}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber2 py-3 font-display text-xs font-black tracking-widest text-black"
        >
          <Send size={14} /> REQUEST WITHDRAWAL ON TELEGRAM
        </a>
      </div>
    </div>
  );
}
