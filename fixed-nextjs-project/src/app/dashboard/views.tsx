"use client";

import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  History,
  Hourglass,
  Inbox,
  Medal,
  RotateCcw,
  Scale,
  Send,
  Swords,
  Trophy,
  UserRound,
} from "lucide-react";
import type { BetDTO, MatchDTO, TxDTO } from "@/lib/types";
import { Countdown } from "@/components/Countdown";
import { EmptyState, TeamAvatar, cn } from "@/components/ui";
import { formatClock, formatCoins, formatDateTime } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

/* ---------------- pending bets ---------------- */

const BET_STATUS: Record<
  BetDTO["status"],
  { label: string; cls: string; Icon: LucideIcon }
> = {
  pending: {
    label: "PENDING",
    cls: "border-neon/40 bg-neon/10 text-neon",
    Icon: Hourglass,
  },
  won: {
    label: "WON",
    cls: "border-mint/40 bg-mint/10 text-mint",
    Icon: Trophy,
  },
  lost: {
    label: "LOST",
    cls: "border-ruby/40 bg-ruby/10 text-ruby",
    Icon: History,
  },
  refunded: {
    label: "REFUNDED",
    cls: "border-amber2/40 bg-amber2/10 text-amber2",
    Icon: RotateCcw,
  },
};

export function BetsView({ bets }: { bets: BetDTO[] | null }) {
  if (!bets) return <LoadingBlock label="Loading your bets..." />;
  if (bets.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="NO BETS YET"
        hint="Back a team from Live Contests and your slips will appear here."
      />
    );

  const pending = bets.filter((b) => b.status === "pending");
  const settled = bets.filter((b) => b.status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <SectionLabel label={`PENDING (${pending.length})`} tone="neon" />
          <div className="mt-3 space-y-3">
            {pending.map((b, i) => (
              <BetCard key={b.id} bet={b} index={i} />
            ))}
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <SectionLabel label={`SETTLED HISTORY (${settled.length})`} />
          <div className="mt-3 space-y-3">
            {settled.map((b, i) => (
              <BetCard key={b.id} bet={b} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BetCard({ bet, index }: { bet: BetDTO; index: number }) {
  const st = BET_STATUS[bet.status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="glass metal-border rounded-2xl p-4"
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="font-display text-[10px] font-bold tracking-[0.26em] text-gold">
          {bet.league}
        </p>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.18em]",
            st.cls,
          )}
        >
          <st.Icon size={11} />
          {st.label}
        </span>
      </div>

      <p className="text-[13px] font-bold text-[#f0ebdb]">
        {bet.teamA} <span className="text-gold/60">vs</span> {bet.teamB}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-gold/30 bg-gold/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-goldlight">
          {bet.selectionTeam}
        </span>
        <span className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[10.5px] font-bold text-neon">
          {bet.odds.toFixed(2)}x
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-center">
        <MiniStat label="STAKE" value={formatCoins(bet.stake)} />
        <MiniStat
          label="POTENTIAL"
          value={formatCoins(bet.potential)}
          tone="text-mint"
        />
        <MiniStat
          label="PLACED"
          value={formatDateTime(bet.createdAt)}
          tone="text-white/50"
        />
      </div>
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  tone = "text-goldlight",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[8.5px] font-bold tracking-[0.2em] text-white/30">
        {label}
      </p>
      <p className={cn("tabular mt-0.5 font-mono text-[11.5px] font-bold", tone)}>
        {value}
      </p>
    </div>
  );
}

/* ---------------- statement ---------------- */

const TX_META: Record<TxDTO["type"], { Icon: LucideIcon; cls: string; label: string }> = {
  bet: { Icon: Swords, cls: "text-gold border-gold/30 bg-gold/10", label: "BET PLACED" },
  win: { Icon: Trophy, cls: "text-mint border-mint/30 bg-mint/10", label: "WIN CREDIT" },
  refund: { Icon: RotateCcw, cls: "text-amber2 border-amber2/30 bg-amber2/10", label: "REFUND" },
  admin_credit: {
    Icon: ArrowDownLeft,
    cls: "text-mint border-mint/30 bg-mint/10",
    label: "ADMIN CREDIT",
  },
  admin_debit: {
    Icon: ArrowUpRight,
    cls: "text-ruby border-ruby/30 bg-ruby/10",
    label: "ADMIN DEBIT",
  },
};

export function StatementView({ txns }: { txns: TxDTO[] | null }) {
  if (!txns) return <LoadingBlock label="Loading statement..." />;
  if (txns.length === 0)
    return (
      <EmptyState
        icon={Inbox}
        title="NO TRANSACTIONS"
        hint="Wallet movements, bets and winnings will be recorded here."
      />
    );

  return (
    <div className="glass metal-border overflow-hidden rounded-2xl">
      {txns.map((t, i) => {
        const meta = TX_META[t.type] ?? TX_META.bet;
        const pos = t.amount >= 0;
        return (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.4) }}
            className={cn(
              "flex items-center gap-3.5 px-4 py-3.5",
              i !== txns.length - 1 && "border-b border-white/[0.05]",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                meta.cls,
              )}
            >
              <meta.Icon size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black tracking-[0.2em] text-white/60">
                {meta.label}
              </p>
              {t.note && (
                <p className="mt-0.5 truncate text-[10.5px] text-white/35">{t.note}</p>
              )}
              <p className="mt-0.5 text-[9.5px] font-semibold tracking-wide text-white/25">
                {formatDateTime(t.createdAt)} - Bal {formatCoins(t.balanceAfter)}
              </p>
            </div>
            <p
              className={cn(
                "tabular shrink-0 font-mono text-[14px] font-bold",
                pos ? "text-mint" : "text-ruby",
              )}
            >
              {pos ? "+" : ""}
              {formatCoins(Math.abs(t.amount))}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------------- rules ---------------- */

const RULES = [
  "The official referee's toss result is final. All settlements follow that declaration.",
  "Winning bets are credited instantly at Stake * Odds once the admin declares the result.",
  "If a match is cancelled or abandoned before the toss, 100% of the stake is refunded to your wallet.",
  "A confirmed bet cannot be edited or cancelled by the punter.",
  "MAX stake is limited by your available wallet balance. Coins locked in pending bets show as Exposure.",
  "Multi-accounting, bonus abuse or suspicious patterns lead to instant account suspension.",
  "Deposits and withdrawals are processed only via official Telegram support 24x7.",
  "Markets may close during the Emergency Freeze without prior notice. Pending stakes remain safe.",
  "18+ only. Play responsibly - this is a premium skill-based simulator.",
];

export function RulesView() {
  return (
    <div className="glass metal-border rounded-2xl p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Scale size={18} />
        </span>
        <div>
          <h3 className="font-display text-[13px] font-black tracking-[0.24em] text-goldlight">
            ROYAL HOUSE RULES
          </h3>
          <p className="text-[10.5px] text-white/35">
            Fair play. Instant settlement. Zero tolerance for fraud.
          </p>
        </div>
      </div>

      <ol className="space-y-3.5">
        {RULES.map((r, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3.5"
          >
            <span className="text-gold-grad font-display text-[13px] font-black">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[12.5px] leading-relaxed text-white/60">{r}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- schedules ---------------- */

export function SchedulesView({
  scheduled,
  finishedToday,
  onRefresh,
}: {
  scheduled: MatchDTO[];
  finishedToday: MatchDTO[];
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <SectionLabel label={`UPCOMING CONTESTS (${scheduled.length})`} tone="neon" />
        {scheduled.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={CalendarClock}
              title="NOTHING SCHEDULED"
              hint="New contests open through the day. Check back soon."
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {scheduled.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.35) }}
                className="glass metal-border rounded-2xl p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-display text-[10px] font-bold tracking-[0.26em] text-gold">
                    {m.league}
                  </p>
                  <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black tracking-[0.18em] text-white/50">
                    UPCOMING
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <TeamAvatar name={m.teamA} size={40} />
                    <p className="text-[11.5px] font-bold leading-tight text-[#efe9d8]">
                      {m.teamA}
                    </p>
                  </div>
                  <span className="font-display text-[11px] font-black text-gold/70">
                    VS
                  </span>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <TeamAvatar name={m.teamB} size={40} />
                    <p className="text-[11.5px] font-bold leading-tight text-[#efe9d8]">
                      {m.teamB}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-neon/15 bg-neon/[0.04] px-3 py-2.5 text-center">
                  <p className="text-[9px] font-bold tracking-[0.22em] text-neon/70">
                    OPENS IN
                  </p>
                  <Countdown
                    target={m.startTime}
                    onZero={onRefresh}
                    compact
                    className="font-mono text-lg font-bold text-neon"
                  />
                  <p className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-white/35">
                    TOSS CLOSE: {formatClock(m.tossCloseTime)} - ODDS {m.oddsA.toFixed(2)}x
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel label={`FINISHED TODAY (${finishedToday.length})`} />
        {finishedToday.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={Medal}
              title="NO SETTLED CONTESTS"
              hint="Results declared today will appear here with winner badges."
            />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {finishedToday.map((m, i) => {
              const winner = m.winner === "A" ? m.teamA : m.winner === "B" ? m.teamB : null;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="glass metal-border flex flex-wrap items-center gap-4 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <TeamAvatar name={m.teamA} size={38} />
                    <span className="font-display text-[10px] font-black text-gold/60">
                      VS
                    </span>
                    <TeamAvatar name={m.teamB} size={38} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[9.5px] font-bold tracking-[0.24em] text-gold/80">
                      {m.league}
                    </p>
                    <p className="truncate text-[13px] font-bold text-[#efe9d8]">
                      {m.teamA} vs {m.teamB}
                    </p>
                  </div>
                  {m.status === "cancelled" ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-ruby/40 bg-ruby/10 px-3 py-1.5 text-[9.5px] font-black tracking-[0.18em] text-ruby">
                      <RotateCcw size={11} /> CANCELLED - REFUNDED
                    </span>
                  ) : (
                    <span className="metal-border flex items-center gap-1.5 rounded-full bg-gold/[0.12] px-3.5 py-1.5 text-[10px] font-black tracking-[0.14em] text-goldlight shadow-[0_0_18px_rgba(212,175,55,0.2)]">
                      <Trophy size={12} className="text-gold" />
                      {winner?.toUpperCase()} WON TOSS
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- support / deposit / withdraw ---------------- */

export function CareView({
  mode,
  telegram,
  username,
}: {
  mode: "support" | "deposit" | "withdraw";
  telegram: string;
  username: string;
}) {
  const meta = {
    support: {
      title: "CUSTOMER SUPPORT",
      desc: "Royal concierge at your service, 24/7. Ping us on Telegram for instant help with your ID, wallet or contest queries.",
      cta: "OPEN TELEGRAM SUPPORT",
    },
    deposit: {
      title: "DEPOSIT COINS",
      desc: "Share your User ID on Telegram and get coins loaded instantly. Minimum deposit 100 coins. Lightning-fast credits, royal-grade service.",
      cta: "DEPOSIT VIA TELEGRAM",
    },
    withdraw: {
      title: "WITHDRAW COINS",
      desc: "Cash out your winnings any time. Minimum withdrawal 1,000 coins. Share your User ID on Telegram - payouts are processed 24/7.",
      cta: "WITHDRAW VIA TELEGRAM",
    },
  }[mode];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-deep metal-border glow-gold relative overflow-hidden rounded-3xl p-8 text-center sm:p-12"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 bg-gold/[0.08] text-gold shadow-[0_0_34px_rgba(212,175,55,0.2)]">
          <Send size={26} />
        </span>
        <h3 className="text-gold-grad font-display text-xl font-black tracking-[0.2em]">
          {meta.title}
        </h3>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/50">
          {meta.desc}
        </p>
        <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
          <UserRound size={15} className="text-gold/70" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40">
            YOUR ID:
          </span>
          <span className="truncate font-mono text-[12px] font-bold text-goldlight">
            {username}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => window.open(telegram, "_blank", "noopener")}
          className="glow-neon mx-auto mt-6 flex items-center gap-2.5 rounded-xl border border-neon/55 bg-neon/[0.08] px-8 py-4 font-display text-[12px] font-black tracking-[0.22em] text-neon transition-all hover:bg-neon/[0.16]"
        >
          <Send size={15} />
          {meta.cta}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ---------------- shared bits ---------------- */

function SectionLabel({ label, tone = "gold" }: { label: string; tone?: "gold" | "neon" }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "h-4 w-1 rounded-full",
          tone === "gold" ? "bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]" : "bg-neon shadow-[0_0_10px_rgba(0,242,254,0.8)]",
        )}
      />
      <p
        className={cn(
          "font-display text-[11px] font-black tracking-[0.26em]",
          tone === "gold" ? "text-goldlight" : "text-neon",
        )}
      >
        {label}
      </p>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="glass metal-border flex items-center justify-center gap-3 rounded-2xl py-14">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      <span className="text-[11px] font-bold tracking-[0.2em] text-white/40">
        {label.toUpperCase()}
      </span>
    </div>
  );
}
