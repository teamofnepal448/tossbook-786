"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlarmClock,
  CalendarClock,
  CalendarPlus,
  Check,
  Flag,
  Hourglass,
  Medal,
  Radio,
  RotateCcw,
  Swords,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import type { AdminMatchDTO } from "@/lib/types";
import { EmptyState, Spinner, TeamAvatar, cn } from "@/components/ui";
import { formatClock, formatCoins, formatDateTime } from "@/lib/format";

const LEAGUES = [
  "IPL 2026",
  "MEN'S T20",
  "WCL T20",
  "BBL 2025-26",
  "PSL 2026",
  "WOMEN'S T20",
  "THE HUNDRED",
  "CPL 2026",
  "ASIA CUP",
];

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MatchesPanel({
  onChanged,
  showToast,
}: {
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [matches, setMatches] = useState<AdminMatchDTO[] | null>(null);
  const [league, setLeague] = useState("IPL 2026");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() + 30 * 60000)));
  const [closeAt, setCloseAt] = useState(() => toLocalInput(new Date(Date.now() + 210 * 60000)));
  const [oddsA, setOddsA] = useState("1.97");
  const [oddsB, setOddsB] = useState("1.97");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/matches", { cache: "no-store", credentials: "include" });
      if (r.ok) setMatches(await r.json());
    } catch {
      /* keep */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 12000);
    return () => clearInterval(t);
  }, [load]);

  const groups = useMemo(() => {
    const list = matches ?? [];
    return {
      live: list.filter((m) => m.status === "live"),
      locked: list.filter((m) => m.status === "locked"),
      scheduled: list
        .filter((m) => m.status === "scheduled")
        .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)),
      settled: list
        .filter((m) => m.status === "finished" || m.status === "cancelled")
        .slice(0, 8),
    };
  }, [matches]);

  function quickStart(mins: number) {
    const start = new Date(Date.now() + mins * 60000);
    setStartAt(toLocalInput(start));
    setCloseAt(toLocalInput(new Date(start.getTime() + 180 * 60000)));
  }

  async function submit() {
    if (busy) return;
    setError("");
    if (!teamA.trim() || !teamB.trim()) {
      setError("Enter both teams");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          league,
          teamA: teamA.trim(),
          teamB: teamB.trim(),
          startTime: new Date(startAt).toISOString(),
          tossCloseTime: new Date(closeAt).toISOString(),
          oddsA: Number(oddsA) || 1.97,
          oddsB: Number(oddsB) || 1.97,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "Failed to schedule");
        setBusy(false);
        return;
      }
      showToast(`${teamA.trim()} vs ${teamB.trim()} scheduled`);
      setTeamA("");
      setTeamB("");
      setBusy(false);
      void load();
      onChanged();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* scheduler */}
      <div className="glass metal-border rounded-3xl p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <CalendarPlus size={16} />
          </span>
          <div>
            <h3 className="font-display text-[12.5px] font-black tracking-[0.24em] text-goldlight">
              SCHEDULE NEW CONTEST
            </h3>
            <p className="text-[10px] text-white/35">
              Opens automatically at start time - closes at toss time
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="LEAGUE / TOURNAMENT">
            <input
              value={league}
              onChange={(e) => setLeague(e.target.value.toUpperCase())}
              list="league-list"
              className="admin-input"
            />
            <datalist id="league-list">
              {LEAGUES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="TEAM A">
              <input
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                placeholder="e.g. Mumbai Indians"
                className="admin-input"
              />
            </Field>
            <Field label="TEAM B">
              <input
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                placeholder="e.g. Chennai Super Kings"
                className="admin-input"
              />
            </Field>
          </div>

          <Field label="START TIME (OPENS FOR BETTING)">
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="admin-input tabular"
            />
            <div className="mt-2 flex gap-2">
              {[
                { l: "+15m", v: 15 },
                { l: "+30m", v: 30 },
                { l: "+1h", v: 60 },
              ].map((q) => (
                <button
                  key={q.l}
                  type="button"
                  onClick={() => quickStart(q.v)}
                  className="glow-neon rounded-lg border border-neon/40 bg-neon/[0.07] px-3 py-1.5 font-mono text-[10.5px] font-bold text-neon transition-colors hover:bg-neon/[0.16]"
                >
                  {q.l}
                </button>
              ))}
              <span className="ml-auto self-center text-[9px] font-bold tracking-[0.14em] text-white/25">
                QUICK START
              </span>
            </div>
          </Field>

          <Field label="TOSS CLOSE TIME (BETTING LOCKS)">
            <input
              type="datetime-local"
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
              className="admin-input tabular"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="ODDS TEAM A">
              <input
                value={oddsA}
                onChange={(e) => setOddsA(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                inputMode="decimal"
                className="admin-input tabular font-mono"
              />
            </Field>
            <Field label="ODDS TEAM B">
              <input
                value={oddsB}
                onChange={(e) => setOddsB(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                inputMode="decimal"
                className="admin-input tabular font-mono"
              />
            </Field>
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-ruby/40 bg-ruby/10 px-3.5 py-2.5 text-[11px] font-semibold text-ruby"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={busy}
          className="gold-btn mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[12px] font-black tracking-[0.26em] sm:w-auto sm:px-10"
        >
          {busy ? <Spinner size={15} /> : <Flag size={15} />}
          {busy ? "SCHEDULING..." : "SCHEDULE MATCH"}
        </motion.button>
      </div>

      {/* lists */}
      {!matches ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="glass metal-border h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <MatchSection
            icon={Radio}
            tone="neon"
            title={`LIVE NOW (${groups.live.length})`}
            matches={groups.live}
            onChanged={() => {
              void load();
              onChanged();
            }}
            showToast={showToast}
          />
          <MatchSection
            icon={Hourglass}
            tone="amber"
            title={`AWAITING RESULT (${groups.locked.length})`}
            matches={groups.locked}
            onChanged={() => {
              void load();
              onChanged();
            }}
            showToast={showToast}
          />
          <MatchSection
            icon={CalendarClock}
            tone="gold"
            title={`SCHEDULED (${groups.scheduled.length})`}
            matches={groups.scheduled}
            onChanged={() => {
              void load();
              onChanged();
            }}
            showToast={showToast}
          />
          <section>
            <SectionHead icon={Medal} tone="gold" title={`RECENTLY SETTLED (${groups.settled.length})`} />
            {groups.settled.length === 0 ? (
              <EmptyState icon={Trophy} title="NO RESULTS YET" hint="Declared results appear here." />
            ) : (
              <div className="mt-3 space-y-3">
                {groups.settled.map((m) => {
                  const winner = m.winner === "A" ? m.teamA : m.winner === "B" ? m.teamB : null;
                  return (
                    <div key={m.id} className="glass metal-border flex flex-wrap items-center gap-4 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <TeamAvatar name={m.teamA} size={36} />
                        <span className="font-display text-[10px] font-black text-gold/60">VS</span>
                        <TeamAvatar name={m.teamB} size={36} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[9.5px] font-bold tracking-[0.22em] text-gold/80">{m.league}</p>
                        <p className="truncate text-[13px] font-bold text-[#efe9d8]">
                          {m.teamA} vs {m.teamB}
                        </p>
                        <p className="text-[9.5px] text-white/30">{m.settledAt && formatDateTime(m.settledAt)}</p>
                      </div>
                      {m.status === "cancelled" ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-ruby/40 bg-ruby/10 px-3 py-1.5 text-[9px] font-black tracking-[0.16em] text-ruby">
                          <RotateCcw size={11} /> CANCELLED - REFUNDED
                        </span>
                      ) : (
                        <span className="metal-border flex items-center gap-1.5 rounded-full bg-gold/[0.12] px-3.5 py-1.5 text-[9.5px] font-black tracking-[0.14em] text-goldlight">
                          <Trophy size={11} className="text-gold" />
                          {winner?.toUpperCase()} WON
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MatchSection({
  icon,
  tone,
  title,
  matches,
  onChanged,
  showToast,
}: {
  icon: typeof Radio;
  tone: "gold" | "neon" | "amber";
  title: string;
  matches: AdminMatchDTO[];
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [confirming, setConfirming] = useState<{ id: number; result: "A" | "B" | "cancel" } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [armDelete, setArmDelete] = useState<number | null>(null);

  async function settle(m: AdminMatchDTO, result: "A" | "B" | "cancel") {
    if (busyId) return;
    setBusyId(m.id);
    try {
      const r = await fetch(`/api/admin/matches/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ result }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(data.error || "Settlement failed");
      } else if (result === "cancel") {
        showToast(`Cancelled - refunded ${formatCoins(data.refunded)} coins`);
      } else {
        showToast(
          `Result declared - ${formatCoins(data.credited)} credited to ${data.winners} winner${data.winners === 1 ? "" : "s"}`,
        );
      }
    } catch {
      showToast("Network error");
    } finally {
      setBusyId(null);
      setConfirming(null);
      onChanged();
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/admin/matches/${id}`, { method: "DELETE", credentials: "include" });
      const data = await r.json().catch(() => ({}));
      showToast(r.ok ? "Match deleted" : data.error || "Delete failed");
    } catch {
      showToast("Network error");
    } finally {
      setBusyId(null);
      setArmDelete(null);
      onChanged();
    }
  }

  return (
    <section>
      <SectionHead icon={icon} tone={tone} title={title} />
      {matches.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center text-[10.5px] font-bold tracking-[0.2em] text-white/25">
          NOTHING HERE RIGHT NOW
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <AnimatePresence initial={false}>
            {matches.map((m) => {
              const isConfirming = confirming?.id === m.id;
              const busyRow = busyId === m.id;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="glass metal-border rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <div className="flex items-center gap-3">
                      <TeamAvatar name={m.teamA} size={38} />
                      <span className="font-display text-[10px] font-black text-gold/60">VS</span>
                      <TeamAvatar name={m.teamB} size={38} />
                    </div>

                    <div className="min-w-[11rem] flex-1">
                      <p className="font-display text-[9.5px] font-bold tracking-[0.22em] text-gold/80">
                        {m.league}
                      </p>
                      <p className="truncate text-[13.5px] font-bold text-[#efe9d8]">
                        {m.teamA} vs {m.teamB}
                      </p>
                      <p className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[9.5px] text-white/35">
                        <span className="flex items-center gap-1">
                          <Swords size={9} /> {formatDateTime(m.startTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <AlarmClock size={9} /> closes {formatClock(m.tossCloseTime)}
                        </span>
                        <span className="text-neon/80">
                          {m.oddsA.toFixed(2)}x / {m.oddsB.toFixed(2)}x
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[8px] font-black tracking-[0.2em] text-white/30">BETS</p>
                        <p className="tabular font-mono text-[12px] font-bold text-white/70">{m.betCount}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black tracking-[0.2em] text-white/30">PENDING POOL</p>
                        <p className="tabular font-mono text-[12px] font-bold text-neon">
                          {formatCoins(m.pendingStaked)}
                        </p>
                      </div>
                    </div>

                    {m.status !== "finished" && m.status !== "cancelled" && (
                      <div className="ml-auto flex items-center gap-2">
                        <SettleBtn
                          label={`DECLARE ${m.teamA}`}
                          tone="gold"
                          onClick={() => setConfirming({ id: m.id, result: "A" })}
                        />
                        <SettleBtn
                          label={`DECLARE ${m.teamB}`}
                          tone="gold"
                          onClick={() => setConfirming({ id: m.id, result: "B" })}
                        />
                        <SettleBtn
                          label="CANCEL & REFUND"
                          tone="ruby"
                          onClick={() => setConfirming({ id: m.id, result: "cancel" })}
                        />
                        {m.status === "scheduled" && m.betCount === 0 && (
                          <button
                            onClick={() => setArmDelete(m.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/35 transition-colors hover:border-ruby/40 hover:text-ruby"
                            aria-label="Delete match"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* confirm strip */}
                  <AnimatePresence>
                    {isConfirming && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-gold/25 bg-black/40 px-4 py-3">
                          <p className="text-[10.5px] font-bold tracking-[0.14em] text-goldlight">
                            {confirming.result === "cancel"
                              ? "CONFIRM CANCEL - 100% STAKES REFUNDED?"
                              : `CONFIRM RESULT - ${(confirming.result === "A" ? m.teamA : m.teamB).toUpperCase()} WINS THE TOSS?`}
                          </p>
                          <div className="ml-auto flex gap-2">
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              disabled={busyRow}
                              onClick={() => void settle(m, confirming.result)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[9.5px] font-black tracking-[0.16em]",
                                confirming.result === "cancel"
                                  ? "border-ruby/50 bg-ruby/[0.12] text-ruby"
                                  : "border-mint/50 bg-mint/[0.12] text-mint",
                              )}
                            >
                              {busyRow ? <Spinner size={12} /> : <Check size={12} />}
                              YES, SETTLE
                            </motion.button>
                            <button
                              onClick={() => setConfirming(null)}
                              className="flex items-center gap-1 rounded-lg border border-white/15 px-3.5 py-2 text-[9.5px] font-black tracking-[0.16em] text-white/50 hover:text-white"
                            >
                              <X size={12} /> NO
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {armDelete === m.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex items-center gap-3 rounded-xl border border-ruby/30 bg-ruby/[0.08] px-4 py-3">
                          <p className="text-[10.5px] font-bold tracking-[0.14em] text-ruby">
                            DELETE THIS MATCH PERMANENTLY?
                          </p>
                          <div className="ml-auto flex gap-2">
                            <button
                              onClick={() => void remove(m.id)}
                              className="rounded-lg border border-ruby/50 bg-ruby/[0.15] px-3.5 py-2 text-[9.5px] font-black tracking-[0.16em] text-ruby"
                            >
                              DELETE
                            </button>
                            <button
                              onClick={() => setArmDelete(null)}
                              className="rounded-lg border border-white/15 px-3.5 py-2 text-[9.5px] font-black tracking-[0.16em] text-white/50"
                            >
                              KEEP
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function SettleBtn({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "gold" | "ruby";
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3.5 py-2.5 font-display text-[9px] font-black tracking-[0.14em] transition-all",
        tone === "gold"
          ? "border-gold/45 bg-gold/[0.08] text-goldlight hover:bg-gold/[0.18] hover:shadow-[0_0_18px_rgba(212,175,55,0.25)]"
          : "border-ruby/40 bg-ruby/[0.07] text-ruby hover:bg-ruby/[0.15]",
      )}
    >
      {label.length > 18 ? `${label.slice(0, 16)}...` : label}
    </motion.button>
  );
}

function SectionHead({
  icon: Icon,
  tone,
  title,
}: {
  icon: typeof Radio;
  tone: "gold" | "neon" | "amber";
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "h-4 w-1 rounded-full",
          tone === "gold" && "bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]",
          tone === "neon" && "bg-neon shadow-[0_0_10px_rgba(0,242,254,0.8)]",
          tone === "amber" && "bg-amber2 shadow-[0_0_10px_rgba(243,156,18,0.8)]",
        )}
      />
      <p
        className={cn(
          "font-display text-[11px] font-black tracking-[0.26em]",
          tone === "gold" && "text-goldlight",
          tone === "neon" && "text-neon",
          tone === "amber" && "text-amber2",
        )}
      >
        {title}
      </p>
      <Icon size={13} className="text-white/25" />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-black tracking-[0.22em] text-white/35">{label}</p>
      {children}
    </div>
  );
}
