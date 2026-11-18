"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Coins,
  Download,
  Menu,
  OctagonAlert,
  Radio,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type {
  BetDTO,
  MatchDTO,
  MatchesPayload,
  MeDTO,
  TxDTO,
} from "@/lib/types";
import { Logo } from "@/components/Logo";
import { MatchCard } from "@/components/MatchCard";
import { BetModal, type BetTarget } from "@/components/BetModal";
import { DrawerMenu, type DrawerView } from "@/components/DrawerMenu";
import { EmptyState, cn } from "@/components/ui";
import { formatCoins } from "@/lib/format";
import {
  BetsView,
  CareView,
  RulesView,
  SchedulesView,
  StatementView,
} from "./views";

const VIEW_TITLES: Record<Exclude<DrawerView, "lobby">, string> = {
  bets: "PENDING BETS",
  statement: "WALLET STATEMENT",
  rules: "HOUSE RULES",
  schedules: "SCHEDULES & RESULTS",
  support: "CUSTOMER SUPPORT",
  withdraw: "WITHDRAW",
  deposit: "DEPOSIT",
};

export default function DashboardClient() {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [payload, setPayload] = useState<MatchesPayload | null>(null);
  const [bets, setBets] = useState<BetDTO[] | null>(null);
  const [txns, setTxns] = useState<TxDTO[] | null>(null);
  const [view, setView] = useState<DrawerView>("lobby");
  const [drawer, setDrawer] = useState(false);
  const [league, setLeague] = useState("ALL");
  const [betTarget, setBetTarget] = useState<BetTarget | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast({ id: Date.now(), msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchMe = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (r.ok) setMe(await r.json());
    } catch {
      /* keep old data */
    }
  }, []);

  const fetchMatches = useCallback(async () => {
    try {
      const r = await fetch("/api/matches", { cache: "no-store", credentials: "include" });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (r.ok) setPayload(await r.json());
    } catch {
      /* keep old data */
    }
  }, []);

  const fetchBets = useCallback(async () => {
    try {
      const r = await fetch("/api/bets", { cache: "no-store", credentials: "include" });
      if (r.ok) setBets(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  const fetchTx = useCallback(async () => {
    try {
      const r = await fetch("/api/transactions", { cache: "no-store", credentials: "include" });
      if (r.ok) setTxns(await r.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchMe();
    void fetchMatches();
    const t = setInterval(() => {
      void fetchMe();
      void fetchMatches();
    }, 6000);
    return () => clearInterval(t);
  }, [fetchMe, fetchMatches]);

  useEffect(() => {
    if (view === "bets") {
      void fetchBets();
      const t = setInterval(() => void fetchBets(), 8000);
      return () => clearInterval(t);
    }
    if (view === "statement") void fetchTx();
  }, [view, fetchBets, fetchTx]);

  const scheduleRefresh = useCallback(() => {
    if (expireTimer.current) clearTimeout(expireTimer.current);
    expireTimer.current = setTimeout(() => {
      void fetchMatches();
    }, 900);
  }, [fetchMatches]);

  const frozen = payload?.settings.marketFrozen ?? false;
  const banned = me?.banned ?? false;
  const blocked = frozen || banned;

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
    return league === "ALL"
      ? payload.live
      : payload.live.filter((m) => m.league === league);
  }, [payload, league]);

  const onBet = useCallback(
    (match: MatchDTO, selection: "A" | "B") => {
      if (banned) {
        showToast("Account suspended - betting disabled");
        return;
      }
      if (frozen) {
        showToast("Emergency market close - betting frozen");
        return;
      }
      setBetTarget({ match, selection });
    },
    [banned, frozen, showToast],
  );

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  }

  const telegram =
    payload?.settings.supportUrl ??
    payload?.settings.telegramUrl ??
    "https://t.me/+FNrv5zNv6lI0ODk1";

  return (
    <div className="bg-arena min-h-dvh">
      {/* header */}
      <header className="glass-deep sticky top-0 z-40 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setDrawer(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/[0.06] text-gold transition-colors hover:bg-gold/[0.14]"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </motion.button>

          <button
            onClick={() => setView("lobby")}
            className="flex min-w-0 items-center gap-2.5"
            aria-label="Lobby"
          >
            <Logo size={38} priority />
            <span className="text-gold-grad hidden font-display text-[13px] font-black tracking-[0.18em] min-[420px]:block">
              TOSS BOOK 786
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/api/download-zip"
              download="tossbook786-fixed.zip"
              className="glow-neon hidden items-center gap-1.5 rounded-xl border border-neon/50 bg-neon/[0.08] px-3 py-2 font-display text-[10px] font-bold tracking-[0.16em] text-neon transition-colors hover:bg-neon/[0.18] md:flex"
            >
              <Download size={13} />
              DOWNLOAD ZIP
            </a>

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                setSpinning(true);
                void Promise.all([fetchMe(), fetchMatches()]).finally(() =>
                  setTimeout(() => setSpinning(false), 500),
                );
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/45 transition-colors hover:border-gold/40 hover:text-gold"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={spinning ? "animate-spin" : ""} />
            </motion.button>

            <button
              onClick={() => setView("statement")}
              className="metal-border flex items-center gap-2 rounded-xl bg-gold/[0.08] px-3.5 py-2 transition-all hover:bg-gold/[0.16]"
            >
              <Coins size={14} className="text-gold" />
              <span className="tabular font-mono text-[13px] font-bold text-goldlight">
                {me ? formatCoins(me.balance) : "..."}
              </span>
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-neon/25 bg-neon/[0.05] px-3.5 py-2 sm:flex">
              <Activity size={14} className="text-neon" />
              <span className="tabular font-mono text-[13px] font-bold text-neon">
                {me ? formatCoins(me.exposure) : "0"}
              </span>
            </div>
          </div>
        </div>

        {/* emergency / suspension banners */}
        <AnimatePresence>
          {frozen && (
            <motion.div
              key="frozen"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-ruby/40 bg-ruby/[0.14]"
            >
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-4 py-2.5 text-center">
                <OctagonAlert size={15} className="animate-pulse text-ruby" />
                <p className="text-[10.5px] font-black tracking-[0.24em] text-ruby">
                  EMERGENCY MARKET CLOSE - ALL BETTING SUSPENDED
                </p>
                <OctagonAlert size={15} className="animate-pulse text-ruby" />
              </div>
            </motion.div>
          )}

          {banned && (
            <motion.div
              key="banned"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-amber2/40 bg-amber2/[0.12]"
            >
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-2.5 px-4 py-2.5 text-center">
                <ShieldAlert size={15} className="text-amber2" />
                <p className="text-[10.5px] font-black tracking-[0.2em] text-amber2">
                  ACCOUNT SUSPENDED - BETTING DISABLED - CONTACT SUPPORT
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* body */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-5">
        <AnimatePresence mode="wait">
          {view === "lobby" ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {/* category chips */}
              <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {["ALL", ...leagues].map((l) => {
                  const active = league === l;
                  return (
                    <motion.button
                      key={l}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setLeague(l)}
                      className={cn(
                        "relative shrink-0 rounded-full border px-4 py-2 font-display text-[10.5px] font-bold tracking-[0.18em] transition-all duration-300",
                        active
                          ? "border-gold/70 bg-gold/[0.14] text-goldlight shadow-[0_0_22px_rgba(212,175,55,0.25)]"
                          : "border-white/10 bg-white/[0.03] text-white/45 hover:border-gold/30 hover:text-white/70",
                      )}
                    >
                      {l}
                      {active && (
                        <motion.span
                          layoutId="chip-glow"
                          className="absolute inset-0 -z-10 rounded-full bg-gold/20 blur-md"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* live section */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="animate-pulse-dot h-2.5 w-2.5 rounded-full bg-neon" />
                  <h2 className="font-display text-[15px] font-black tracking-[0.26em] text-[#f2ecda]">
                    LIVE CONTESTS
                  </h2>
                  {payload && (
                    <span className="rounded-full border border-neon/30 bg-neon/[0.08] px-2.5 py-0.5 font-mono text-[10px] font-bold text-neon">
                      {liveFiltered.length}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setView("schedules")}
                  className="font-display text-[10px] font-bold tracking-[0.2em] text-gold/70 transition-colors hover:text-gold"
                >
                  SCHEDULES &gt;
                </button>
              </div>

              {!payload ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="glass metal-border h-64 animate-pulse rounded-3xl"
                    />
                  ))}
                </div>
              ) : liveFiltered.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="NO LIVE CONTESTS"
                  hint="Fresh toss markets open round the clock. Peek at Schedules for what's next."
                />
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {liveFiltered.map((m, i) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        index={i}
                        disabled={blocked}
                        onBet={onBet}
                        onExpire={scheduleRefresh}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-3xl"
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="h-4 w-1 rounded-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
                <h2 className="font-display text-[15px] font-black tracking-[0.26em] text-[#f2ecda]">
                  {VIEW_TITLES[view]}
                </h2>
              </div>

              {view === "bets" && <BetsView bets={bets} />}
              {view === "statement" && <StatementView txns={txns} />}
              {view === "rules" && <RulesView />}
              {view === "schedules" && (
                <SchedulesView
                  scheduled={payload?.scheduled ?? []}
                  finishedToday={payload?.finishedToday ?? []}
                  onRefresh={scheduleRefresh}
                />
              )}
              {(view === "support" || view === "deposit" || view === "withdraw") && (
                <CareView
                  mode={view}
                  telegram={telegram}
                  username={me?.username ?? ""}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* drawer */}
      <DrawerMenu
        open={drawer}
        me={me}
        view={view}
        onClose={() => setDrawer(false)}
        onNavigate={(v) => setView(v)}
        onLogout={logout}
      />

      {/* bet modal */}
      <BetModal
        target={betTarget}
        balance={me?.balance ?? 0}
        onClose={() => setBetTarget(null)}
        onSuccess={(newBalance) => {
          setMe((m) => (m ? { ...m, balance: newBalance } : m));
          void fetchMe();
          void fetchBets();
          showToast("Bet placed - good luck, champion!");
        }}
      />

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="glass-deep metal-border glow-gold fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-2xl px-5 py-3"
          >
            <p className="whitespace-nowrap text-[11.5px] font-bold tracking-[0.12em] text-goldlight">
              {toast.msg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
