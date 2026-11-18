import React from "react";
import { motion } from "motion/react";
import { AlarmClock, TrendingUp } from "lucide-react";
import { Countdown } from "@/src/components/Countdown";
import { TeamAvatar, cn } from "@/src/components/ui";

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
}

export type MatchItem = {
  id: number;
  league: string;
  teamA: string;
  teamB: string;
  startTime: string;
  tossCloseTime: string;
  oddsA: number;
  oddsB: number;
  status: "scheduled" | "live" | "locked" | "finished" | "cancelled";
  winner: string | null;
  settledAt: string | null;
  createdAt: string;
};

export function MatchCard({
  match,
  index = 0,
  disabled = false,
  onBet,
  onExpire,
}: {
  match: MatchItem;
  index?: number;
  disabled?: boolean;
  onBet: (match: MatchItem, selection: "A" | "B") => void;
  onExpire: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }}
      transition={{
        type: "spring",
        stiffness: 140,
        damping: 18,
        delay: Math.min(index * 0.06, 0.3),
      }}
      className="glass metal-border group relative overflow-hidden rounded-3xl p-5 transition-shadow duration-500 hover:shadow-[0_0_44px_rgba(212,175,55,0.14)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="bg-gradient-to-r from-gold/25 to-transparent py-1 pl-2 pr-4 font-display text-[10.5px] font-bold tracking-[0.26em] text-goldlight">
          {match.league}
        </p>
        <span className="flex items-center gap-1.5 rounded-full border border-neon/35 bg-neon/[0.08] px-2.5 py-1 text-[9px] font-black tracking-[0.2em] text-neon">
          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-neon" />
          LIVE
        </span>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamAvatar name={match.teamA} size={48} />
          <p className="text-[12.5px] font-bold leading-tight text-[#f1ecdc]">
            {match.teamA}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <span className="metal-border flex h-9 w-9 rotate-45 items-center justify-center rounded-lg bg-[#12161f]">
            <span className="-rotate-45 font-display text-[11px] font-black text-gold">
              VS
            </span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamAvatar name={match.teamB} size={48} />
          <p className="text-[12.5px] font-bold leading-tight text-[#f1ecdc]">
            {match.teamB}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {(["A", "B"] as const).map((side) => {
          const team = side === "A" ? match.teamA : match.teamB;
          const odds = side === "A" ? match.oddsA : match.oddsB;
          return (
            <motion.button
              key={side}
              whileTap={{ scale: 0.95 }}
              disabled={disabled}
              onClick={() => onBet(match, side)}
              className={cn(
                "group/btn relative overflow-hidden rounded-xl border border-neon/25 bg-neon/[0.05] px-3 py-2.5 text-center transition-all duration-300",
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "hover:border-neon/60 hover:bg-neon/[0.12] hover:shadow-[0_0_26px_rgba(0,242,254,0.22)]",
              )}
            >
              <span className="block truncate text-[10px] font-bold tracking-[0.14em] text-white/55">
                {team.toUpperCase()}
              </span>
              <span className="mt-0.5 flex items-center justify-center gap-1.5 font-mono text-lg font-bold text-neon drop-shadow-[0_0_12px_rgba(0,242,254,0.45)]">
                <TrendingUp size={14} className="opacity-70" />
                {odds.toFixed(2)}x
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gold/15 bg-black/30 px-4 py-3">
        <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[9.5px] font-bold tracking-[0.22em] text-goldlight/80">
          <AlarmClock size={11} />
          TOSS BET CLOSE TIME: {formatClock(match.tossCloseTime)}
        </p>
        <Countdown
          target={match.tossCloseTime}
          onZero={onExpire}
          className="text-gold-grad flex items-baseline justify-center font-mono text-[22px] font-bold tracking-[0.12em] drop-shadow-[0_2px_16px_rgba(212,175,55,0.35)]"
        />
      </div>
    </motion.article>
  );
}
