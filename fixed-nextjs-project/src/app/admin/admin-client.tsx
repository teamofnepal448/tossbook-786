"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  Coins,
  Download,
  LogOut,
  Radio,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { AdminStatsDTO } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { cn } from "@/components/ui";
import { formatCoins } from "@/lib/format";
import UsersPanel from "./users-panel";
import MatchesPanel from "./matches-panel";
import SettingsPanel from "./settings-panel";

type Tab = "users" | "matches" | "settings";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "users", label: "PUNTERS", icon: Users },
  { key: "matches", label: "MATCH CONTROL", icon: CalendarClock },
  { key: "settings", label: "SETTINGS", icon: Settings2 },
];

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>("users");
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [links, setLinks] = useState({
    websiteUrl: "https://tossbook786.com",
    telegramUrl: "https://t.me/+FNrv5zNv6lI0ODk1",
  });
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const showToast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/stats", { cache: "no-store", credentials: "include" });
      if (r.status === 401 || r.status === 403) {
        window.location.href = "/login";
        return;
      }
      if (r.ok) setStats(await r.json());
    } catch {
      /* keep */
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const t = setInterval(() => void fetchStats(), 9000);
    return () => clearInterval(t);
  }, [fetchStats]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.websiteUrl)
          setLinks({ websiteUrl: s.websiteUrl, telegramUrl: s.telegramUrl });
      })
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  }

  const statCards = [
    {
      icon: Users,
      label: "TOTAL PUNTERS",
      value: stats ? String(stats.totalPunters) : "0",
      sub: stats ? `${stats.bannedPunters} banned` : "",
      cls: "text-gold border-gold/25 bg-gold/[0.07]",
    },
    {
      icon: Coins,
      label: "COINS CIRCULATING",
      value: stats ? formatCoins(stats.coinsInCirculation) : "0",
      sub: "across all wallets",
      cls: "text-goldlight border-gold/25 bg-gold/[0.07]",
    },
    {
      icon: Radio,
      label: "LIVE MARKETS",
      value: stats ? String(stats.liveMatches) : "0",
      sub: stats ? `${stats.scheduledMatches} upcoming · ${stats.lockedMatches} awaiting` : "",
      cls: "text-neon border-neon/25 bg-neon/[0.06]",
    },
    {
      icon: ReceiptText,
      label: "PENDING BETS",
      value: stats ? String(stats.pendingBets) : "0",
      sub: stats ? `${formatCoins(stats.pendingStakes)} locked` : "",
      cls: "text-mint border-mint/25 bg-mint/[0.06]",
    },
  ];

  return (
    <div className="bg-arena min-h-dvh">
      {/* header */}
      <header className="glass-deep sticky top-0 z-40 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-5">
          <Logo size={38} priority />
          <div className="min-w-0">
            <p className="text-gold-grad truncate font-display text-[12.5px] font-black tracking-[0.18em]">
              TOSS BOOK 786
            </p>
            <p className="flex items-center gap-1 text-[9px] font-black tracking-[0.3em] text-ruby">
              <ShieldCheck size={10} /> ADMIN CONTROL
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/api/download-zip"
              download="tossbook786-fixed.zip"
              className="glow-neon hidden items-center gap-1.5 rounded-xl border border-neon/50 bg-neon/[0.08] px-3.5 py-2 font-display text-[10px] font-bold tracking-[0.16em] text-neon transition-colors hover:bg-neon/[0.18] sm:flex"
            >
              <Download size={13} />
              DOWNLOAD ZIP
            </a>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-ruby/30 bg-ruby/[0.07] px-4 py-2 font-display text-[10.5px] font-bold tracking-[0.18em] text-ruby transition-colors hover:bg-ruby/[0.15]"
            >
              <LogOut size={13} />
              SIGN OUT
            </motion.button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-5">
        {/* stats */}
        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ icon: Icon, label, value, sub, cls }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass metal-border rounded-2xl p-4"
            >
              <span
                className={cn(
                  "mb-3 flex h-9 w-9 items-center justify-center rounded-xl border",
                  cls,
                )}
              >
                <Icon size={16} />
              </span>
              <p className="tabular font-mono text-xl font-bold text-[#f2ecda]">
                {value}
              </p>
              <p className="mt-1 text-[8.5px] font-black tracking-[0.22em] text-white/40">
                {label}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-white/25">
                <Activity size={9} /> {sub}
              </p>
            </motion.div>
          ))}
        </div>

        {/* tabs */}
        <div className="mb-6 flex gap-1.5 rounded-2xl border border-gold/15 bg-black/30 p-1.5">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-3 font-display text-[10px] font-black tracking-[0.18em] transition-colors sm:text-[11px]",
                  active ? "text-[#151003]" : "text-white/45 hover:text-goldlight",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-tab"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="gold-btn absolute inset-0 rounded-xl"
                  />
                )}
                <Icon size={14} className="relative z-10" />
                <span className="relative z-10 hidden min-[420px]:inline">{label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "users" && (
              <UsersPanel
                links={links}
                onChanged={fetchStats}
                showToast={showToast}
              />
            )}
            {tab === "matches" && (
              <MatchesPanel onChanged={fetchStats} showToast={showToast} />
            )}
            {tab === "settings" && <SettingsPanel showToast={showToast} />}
          </motion.div>
        </AnimatePresence>
      </div>

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
