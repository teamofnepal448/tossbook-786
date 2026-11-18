import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronLeft,
  Coins,
  ShieldAlert,
  Swords,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { Spinner, TeamAvatar, cn } from "@/src/components/ui";
import type { MatchItem } from "./MatchCard";

export function formatCoins(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export type BetTarget = { match: MatchItem; selection: "A" | "B" };

const QUICK = [100, 500, 1000];

export function BetModal({
  target,
  balance,
  onClose,
  onSuccess,
}: {
  target: BetTarget | null;
  balance: number;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selection, setSelection] = useState<"A" | "B">("A");
  const [stakeStr, setStakeStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placedInfo, setPlacedInfo] = useState<{
    selectionTeam: string;
    odds: number;
    stake: number;
    potential: number;
  } | null>(null);
  const [newBalance, setNewBalance] = useState(0);

  const stake = Math.floor(Number(stakeStr)) || 0;

  useEffect(() => {
    if (target) {
      setStep(1);
      setSelection(target.selection);
      setStakeStr("");
      setError("");
      setBusy(false);
      setPlacedInfo(null);
    }
  }, [target]);

  const match = target?.match ?? null;
  const odds = match ? (selection === "A" ? match.oddsA : match.oddsB) : 1;
  const team = match ? (selection === "A" ? match.teamA : match.teamB) : "";
  const potential = useMemo(() => Math.round(stake * odds), [stake, odds]);
  const valid = stake >= 1 && stake <= balance;

  function quickAdd(v: number) {
    setError("");
    setStakeStr((s) => {
      const cur = Math.floor(Number(s)) || 0;
      return String(Math.min(balance, cur + v));
    });
  }

  async function confirm() {
    if (!match || busy) return;
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
        setStep(1);
        return;
      }
      setPlacedInfo({
        selectionTeam: data.bet.selectionTeam,
        odds: data.bet.odds,
        stake: data.bet.stake,
        potential: data.bet.potential,
      });
      setNewBalance(data.balance);
      setStep(3);
      onSuccess(data.balance);
      setTimeout(onClose, 2000);
    } catch {
      setError("Network error - try again.");
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {target && match && (
        <motion.div
          key="bet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            key="bet-panel"
            initial={{ y: 90, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 70, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-deep metal-border glow-gold max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
                  <Swords size={15} />
                </span>
                <h3 className="font-display text-[13px] font-black tracking-[0.24em] text-goldlight">
                  {step === 3 ? "BET SLIP" : step === 2 ? "REVIEW BET" : "PLACE YOUR BET"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:border-gold/40 hover:text-gold"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {step !== 3 && (
              <div className="mb-5 rounded-2xl border border-gold/12 bg-black/30 px-4 py-3 text-center">
                <p className="font-display text-[10px] font-bold tracking-[0.28em] text-gold/80">
                  {match.league}
                </p>
                <p className="mt-1 text-sm font-bold text-[#f2ecda]">
                  {match.teamA} <span className="text-gold/70">vs</span> {match.teamB}
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-4 grid grid-cols-2 gap-2.5">
                    {(["A", "B"] as const).map((side) => {
                      const t = side === "A" ? match.teamA : match.teamB;
                      const o = side === "A" ? match.oddsA : match.oddsB;
                      const active = selection === side;
                      return (
                        <motion.button
                          key={side}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelection(side)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 transition-all duration-300",
                            active
                              ? "glow-neon border-neon/60 bg-neon/[0.09]"
                              : "border-white/10 bg-white/[0.02] hover:border-white/25",
                          )}
                        >
                          <TeamAvatar name={t} size={40} />
                          <span className="w-full truncate text-center text-[11.5px] font-bold text-[#efe9d8]">
                            {t}
                          </span>
                          <span className="font-mono text-sm font-bold text-neon">
                            {o.toFixed(2)}x
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <p className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-[0.24em] text-white/40">
                    STAKE (COINS)
                    <span className="flex items-center gap-1.5 tracking-normal text-goldlight/80">
                      <Wallet size={12} />
                      Available: {formatCoins(balance)}
                    </span>
                  </p>
                  <label className="relative mb-3 block">
                    <Coins
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/70"
                    />
                    <input
                      value={stakeStr}
                      onChange={(e) => {
                        setError("");
                        const v = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
                        setStakeStr(v);
                      }}
                      inputMode="numeric"
                      placeholder="0"
                      className="tabular w-full rounded-xl border border-gold/20 bg-white/[0.03] py-3.5 pl-11 pr-4 font-mono text-lg font-bold text-goldlight outline-none transition-all placeholder:text-white/20 focus:border-gold/55 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
                    />
                  </label>

                  <div className="mb-4 grid grid-cols-4 gap-2">
                    {QUICK.map((v) => (
                      <motion.button
                        key={v}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => quickAdd(v)}
                        className="rounded-lg border border-gold/25 bg-gold/[0.06] py-2 font-mono text-[12px] font-bold text-goldlight transition-colors hover:bg-gold/[0.15]"
                      >
                        +{v}
                      </motion.button>
                    ))}
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => {
                        setError("");
                        setStakeStr(String(balance));
                      }}
                      className="glow-neon rounded-lg border border-neon/45 bg-neon/[0.08] py-2 font-mono text-[12px] font-black text-neon transition-colors hover:bg-neon/[0.16]"
                    >
                      MAX
                    </motion.button>
                  </div>

                  {stake > 0 && (
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-mint/25 bg-mint/[0.06] px-4 py-2.5 text-xs font-bold">
                      <span className="tracking-[0.16em] text-white/45">
                        POTENTIAL PAYOUT
                      </span>
                      <span className="font-mono text-sm text-mint">
                        {formatCoins(potential)}
                      </span>
                    </div>
                  )}

                  {error && <ErrorLine msg={error} />}
                  {stake > balance && balance >= 0 && stakeStr !== "" && (
                    <ErrorLine msg="Insufficient balance for this stake" />
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={!valid}
                    onClick={() => setStep(2)}
                    className="gold-btn mt-2 w-full rounded-xl py-3.5 font-display text-[12.5px] font-black tracking-[0.26em]"
                  >
                    REVIEW BET
                  </motion.button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="mb-4 space-y-2.5 rounded-2xl border border-gold/15 bg-black/30 p-4">
                    <Row k="SELECTION" v={team} gold />
                    <Row k="ODDS" v={`${odds.toFixed(2)}x`} mono neon />
                    <Row k="STAKE" v={formatCoins(stake)} mono />
                    <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                    <Row k="POTENTIAL PAYOUT" v={formatCoins(potential)} mono mint big />
                    <Row
                      k="BALANCE AFTER BET"
                      v={formatCoins(balance - stake)}
                      mono
                      dim
                    />
                  </div>

                  {error && <ErrorLine msg={error} />}

                  <div className="flex gap-2.5">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setStep(1)}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 py-3.5 text-[11px] font-bold tracking-[0.18em] text-white/60 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-40"
                    >
                      <ChevronLeft size={14} /> BACK
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={confirm}
                      disabled={busy}
                      className="gold-btn flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[12.5px] font-black tracking-[0.26em]"
                    >
                      {busy ? <Spinner size={15} /> : <Trophy size={15} />}
                      {busy ? "PLACING..." : "CONFIRM BET"}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && placedInfo && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  className="flex flex-col items-center py-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.08 }}
                    className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-mint/70 bg-mint/10 text-mint shadow-[0_0_44px_rgba(47,230,167,0.4)]"
                  >
                    <Check size={38} strokeWidth={3} />
                  </motion.div>
                  <h4 className="text-gold-grad font-display text-lg font-black tracking-[0.22em]">
                    BET CONFIRMED
                  </h4>
                  <p className="mt-2 text-xs text-white/55">
                    {placedInfo.selectionTeam} @ {placedInfo.odds.toFixed(2)}x - stake{" "}
                    {formatCoins(placedInfo.stake)}
                  </p>
                  <p className="mt-3 font-mono text-sm text-mint">
                    Payout on win: {formatCoins(placedInfo.potential)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-white/35">
                    Wallet: {formatCoins(newBalance)}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({
  k,
  v,
  gold = false,
  neon = false,
  mint = false,
  mono = false,
  big = false,
  dim = false,
}: {
  k: string;
  v: string;
  gold?: boolean;
  neon?: boolean;
  mint?: boolean;
  mono?: boolean;
  big?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9.5px] font-bold tracking-[0.24em] text-white/40">
        {k}
      </span>
      <span
        className={cn(
          "text-right font-bold",
          mono && "tabular font-mono",
          big ? "text-base" : "text-[13px]",
          gold && "text-goldlight",
          neon && "text-neon",
          mint && "text-mint",
          dim && "text-white/45",
          !gold && !neon && !mint && !dim && "text-[#f2ecda]",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 flex items-center gap-2 rounded-lg border border-ruby/40 bg-ruby/10 px-3.5 py-2.5 text-[11px] font-semibold text-ruby"
    >
      <ShieldAlert size={14} className="shrink-0" />
      {msg}
    </motion.p>
  );
}
