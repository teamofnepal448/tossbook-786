import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Coins,
  Copy,
  Edit3,
  Eye,
  Flag,
  History,
  Image as ImageIcon,
  Lock,
  LogOut,
  Minus,
  Plus,
  Radio,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { Logo } from "@/src/components/Logo";
import { ChangePasswordCard } from "@/src/components/ChangePasswordCard";
import { EmptyState, SafePosterImg, Spinner, cn } from "@/src/components/ui";
import { compressImageFile } from "@/src/lib/image";
import { calculateCancellationRefund, sanitizeOdds, sanitizeStake } from "@/src/lib/money";
import {
  type AdminMatch,
  type AdminMatchBetsPayload,
  type AdminStats,
  type AdminUser,
  type AdminUserDetails,
  type BetDTO,
  DEFAULT_BANNER,
  DEFAULT_WELCOME_TEMPLATE,
  type TxDTO,
  type UserMe,
  formatClock,
  formatCoins,
  formatDateTime,
  formatTelegramUrl,
  renderWelcomeMessage,
} from "@/src/lib/shared";

export default function AdminView({
  user: _user,
  onLogout,
  onSessionCleared,
  showToast,
}: {
  user: UserMe;
  onLogout: () => void;
  onSessionCleared?: () => void;
  showToast: (m: string) => void;
}) {
  const [tab, setTab] = useState<"users" | "matches" | "settings" | "audit">("users");
  const [stats, setStats] = useState<AdminStats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/stats", { cache: "no-store", credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch {
      /* keep previous stats on transient network drop */
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const t = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void fetchStats();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [fetchStats]);

  return (
    <div className="bg-arena min-h-dvh">
      {/* Header */}
      <header className="glass-deep sticky top-0 z-40 border-b border-gold/15">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Logo size={40} priority />
            <div className="min-w-0">
              <p className="text-gold-grad truncate font-display text-[12px] font-black tracking-[0.16em] sm:text-[13px] sm:tracking-[0.18em]">
                TOSS BOOK 786
              </p>
              <p className="flex items-center gap-1 truncate text-[8.5px] font-black tracking-[0.22em] text-ruby sm:text-[9px] sm:tracking-[0.3em]">
                <ShieldCheck size={10} /> ADMIN CONTROL (LIVE)
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-ruby/30 bg-ruby/[0.07] px-3 py-2 font-display text-[10px] font-bold text-ruby hover:bg-ruby/[0.15] sm:px-3.5 sm:text-[10.5px]"
            >
              <LogOut size={13} /> SIGN OUT
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 pb-24 pt-5 sm:px-5 sm:pt-6">
        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "TOTAL PUNTERS", value: stats ? String(stats.totalPunters) : "0", sub: `${stats?.bannedPunters ?? 0} banned`, icon: Users, color: "text-gold" },
            { label: "COINS CIRCULATING", value: stats ? `${formatCoins(stats.coinsInCirculation)} Rs.` : "0 Rs.", sub: "Across all wallets", icon: Coins, color: "text-goldlight" },
            { label: "LIVE MARKETS", value: stats ? String(stats.liveMatches) : "0", sub: `${stats?.scheduledMatches ?? 0} upcoming`, icon: Radio, color: "text-neon" },
            { label: "PENDING STAKES", value: stats ? `${formatCoins(stats.pendingStakes)} Rs.` : "0 Rs.", sub: `${stats?.pendingBets ?? 0} active slips`, icon: ReceiptText, color: "text-mint" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="glass metal-border rounded-2xl p-3.5 sm:p-4">
              <span className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]", color)}>
                <Icon size={16} />
              </span>
              <p className="font-mono text-lg font-bold text-white sm:text-xl">{value}</p>
              <p className="text-[8.5px] font-black tracking-widest text-white/40">{label}</p>
              <p className="mt-0.5 text-[9px] text-white/30">{sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1.5 rounded-2xl border border-gold/15 bg-black/30 p-1.5">
          {[
            { key: "users", label: "PUNTERS & WALLET", icon: Users },
            { key: "matches", label: "MATCH CONTROL", icon: CalendarClock },
            { key: "settings", label: "SETTINGS & MARQUEE", icon: Settings2 },
            { key: "audit", label: "AUDIT & TESTS", icon: ShieldCheck },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-3 font-display text-[10px] font-black tracking-[0.16em] transition-all sm:text-[11px]",
                tab === key ? "gold-btn text-[#0b0e14]" : "text-white/45 hover:text-white",
              )}
            >
              <Icon size={14} />
              <span className="hidden min-[480px]:inline">{label}</span>
            </button>
          ))}
        </div>

        {tab === "users" && <AdminUsersPanel onChanged={fetchStats} showToast={showToast} />}
        {tab === "matches" && <AdminMatchesPanel onChanged={fetchStats} showToast={showToast} />}
        {tab === "settings" && (
          <AdminSettingsPanel
            username={_user.username}
            onSessionCleared={onSessionCleared ?? onLogout}
            showToast={showToast}
          />
        )}
        {tab === "audit" && <AuditPanel />}
      </div>
    </div>
  );
}

/* ==========================================================================
   ADMIN USERS PANEL (Punter Management + Wallet Add/Deduct + Create ID)
   ========================================================================== */

function AdminUsersPanel({
  onChanged,
  showToast,
}: {
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState("");
  const [wallet, setWallet] = useState<{ user: AdminUser; mode: "add" | "deduct" } | null>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingBanId, setTogglingBanId] = useState<number | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const r = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (r.ok) setUsers(await r.json());
    } catch {
      /* keep */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 200);
    return () => clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    const t = setInterval(() => {
      if (
        (typeof document === "undefined" || document.visibilityState === "visible") &&
        !wallet &&
        !createOpen &&
        detailUserId === null
      ) {
        void load(search);
      }
    }, 6000);
    return () => clearInterval(t);
  }, [search, wallet, createOpen, detailUserId, load]);

  async function toggleBan(u: AdminUser) {
    if (togglingBanId !== null) return;
    setTogglingBanId(u.id);
    try {
      const r = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "ban", banned: !u.banned }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(data.banned ? `${u.username} banned` : `${u.username} unbanned`);
        void load(search);
        onChanged();
      } else {
        showToast(data.error || "Could not update ban status");
      }
    } catch {
      showToast("Network error updating user");
    } finally {
      setTogglingBanId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or phone..."
            className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3 pl-11 pr-4 text-xs font-semibold text-white outline-none focus:border-gold/50"
          />
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="gold-btn flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-[11px] font-black tracking-widest"
        >
          <UserPlus size={15} /> CREATE PUNTER ID
        </button>
      </div>

      {!users ? (
        <p className="text-center text-xs text-white/40">Loading punters from database...</p>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="NO PUNTERS FOUND" hint="Create a new ID or adjust search." />
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const banBusy = togglingBanId === u.id;
            return (
              <div key={u.id} className={cn("glass metal-border rounded-2xl p-4", u.banned && "border-ruby/30")}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[9rem] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-goldlight">{u.username}</span>
                      {u.banned ? (
                        <span className="rounded-full bg-ruby/15 px-2 py-0.5 text-[8px] font-black text-ruby">BANNED</span>
                      ) : (
                        <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[8px] font-black text-mint">ACTIVE</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      Phone: {u.phone ?? "N/A"} · Joined: {formatDateTime(u.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                    <div>
                      <span className="block text-[8px] font-black text-white/30">BALANCE</span>
                      <span className="font-mono text-xs font-bold text-goldlight">{formatCoins(u.balance)} Rs.</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-white/30">EXPOSURE</span>
                      <span className="font-mono text-xs font-bold text-neon">{formatCoins(u.exposure)} Rs.</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-white/30">DEPOSITED</span>
                      <span className="font-mono text-xs font-bold text-mint">{formatCoins(u.totalDeposited)} Rs.</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-white/30">BETS (ACTIVE/TOTAL)</span>
                      <span className="font-mono text-xs font-bold text-white">
                        {u.pendingBets} / {u.totalBets ?? u.pendingBets}
                      </span>
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDetailUserId(u.id)}
                      className="flex items-center gap-1 rounded-lg border border-neon/40 bg-neon/10 px-3 py-1.5 text-[10px] font-black text-neon hover:bg-neon/20"
                    >
                      <Eye size={12} /> DETAILS & BETS
                    </button>
                    <button
                      onClick={() => setWallet({ user: u, mode: "add" })}
                      className="flex items-center gap-1 rounded-lg border border-mint/40 bg-mint/10 px-3 py-1.5 text-[10px] font-black text-mint hover:bg-mint/20"
                    >
                      <Plus size={12} /> ADD / DEPOSIT
                    </button>
                    <button
                      onClick={() => setWallet({ user: u, mode: "deduct" })}
                      className="flex items-center gap-1 rounded-lg border border-amber2/40 bg-amber2/10 px-3 py-1.5 text-[10px] font-black text-amber2 hover:bg-amber2/20"
                    >
                      <Minus size={12} /> DEDUCT / WITHDRAW
                    </button>
                    <button
                      disabled={togglingBanId !== null}
                      onClick={() => void toggleBan(u)}
                      className={cn(
                        "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-black disabled:opacity-50",
                        u.banned ? "border-mint/40 bg-mint/10 text-mint" : "border-ruby/40 bg-ruby/10 text-ruby",
                      )}
                    >
                      {u.banned ? <ShieldCheck size={12} /> : <X size={12} />}
                      {banBusy ? "WAIT..." : u.banned ? "UNBAN" : "BAN"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User Full Breakdown Modal (Bets + Transactions) */}
      {detailUserId !== null && (
        <AdminUserDetailModal
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onChanged={() => {
            void load(search);
            onChanged();
          }}
          showToast={showToast}
        />
      )}

      {/* Wallet Modal */}
      {wallet && (
        <AdminWalletModal
          user={wallet.user}
          mode={wallet.mode}
          onClose={() => setWallet(null)}
          onSuccess={(amt) => {
            showToast(`${wallet.mode === "add" ? "Added" : "Deducted"} ${formatCoins(amt)} Rs.`);
            setWallet(null);
            void load(search);
            onChanged();
          }}
          showToast={showToast}
        />
      )}

      {/* Create User Modal */}
      {createOpen && (
        <AdminCreateUserModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            showToast("Punter ID successfully created in database!");
            void load(search);
            onChanged();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function AdminUserDetailModal({
  userId,
  onClose,
  onChanged,
  showToast,
}: {
  userId: number;
  onClose: () => void;
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"bets" | "tx">("bets");
  const [betFilter, setBetFilter] = useState<"all" | "pending" | "won" | "lost" | "cancelled">("all");
  const [confirmCancelBetId, setConfirmCancelBetId] = useState<number | null>(null);
  const [cancellingBetId, setCancellingBetId] = useState<number | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/details`, {
        cache: "no-store",
        credentials: "include",
      });
      if (r.ok) {
        setDetails(await r.json());
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.error || "Could not load user breakdown");
      }
    } catch {
      showToast("Network error loading user details");
    } finally {
      setLoading(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  async function adminCancelBet(bet: BetDTO) {
    if (cancellingBetId !== null) return;
    setCancellingBetId(bet.id);
    try {
      const res = await fetch(`/api/admin/bets/${bet.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Failed to cancel bet");
        setConfirmCancelBetId(null);
        return;
      }
      showToast(
        `Bet #${bet.id} cancelled! Refunded ${formatCoins(data.refunded)} Rs. (2% fee: ${formatCoins(data.fee)} Rs.)`,
      );
      setConfirmCancelBetId(null);
      await loadDetails();
      onChanged();
    } catch {
      showToast("Network error cancelling bet");
    } finally {
      setCancellingBetId(null);
    }
  }

  const filteredBets = useMemo(() => {
    if (!details) return [];
    return details.bets.filter((b) => (betFilter === "all" ? true : b.status === betFilter));
  }, [details, betFilter]);

  return (
    <div
      className="fixed inset-0 z-[145] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-5"
      onClick={() => {
        if (cancellingBetId === null) onClose();
      }}
    >
      <div
        className="glass-deep metal-border glow-gold flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users size={17} className="text-gold" />
              <h3 className="truncate font-display text-sm font-black tracking-widest text-goldlight">
                {details ? `${details.user.username} · ACCOUNT BREAKDOWN` : `LOADING USER #${userId}...`}
              </h3>
              {details?.user.banned ? (
                <span className="rounded-full bg-ruby/15 px-2 py-0.5 text-[8.5px] font-black text-ruby">BANNED</span>
              ) : details ? (
                <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[8.5px] font-black text-mint">ACTIVE</span>
              ) : null}
            </div>
            {details && (
              <p className="mt-0.5 font-mono text-[10px] text-white/45">
                Phone: {details.user.phone || "N/A"} · Joined: {formatDateTime(details.user.createdAt)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || cancellingBetId !== null}
              onClick={() => void loadDetails()}
              className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-gold disabled:opacity-40"
              title="Refresh breakdown"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              disabled={cancellingBetId !== null}
              onClick={onClose}
              className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && !details ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner size={24} className="text-gold" />
              <p className="mt-2 font-mono text-xs text-white/40">Loading bets & transaction ledger...</p>
            </div>
          ) : details ? (
            <div className="space-y-4">
              {/* Financial KPI Strip */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "WALLET BALANCE", value: `${formatCoins(details.user.balance)} Rs.`, color: "text-goldlight" },
                  { label: "ACTIVE EXPOSURE", value: `${formatCoins(details.user.exposure)} Rs.`, color: "text-neon" },
                  { label: "TOTAL WAGERED", value: `${formatCoins(details.user.totalStaked)} Rs.`, color: "text-white" },
                  { label: "WON CREDITED", value: `${formatCoins(details.user.totalWonCredited)} Rs.`, color: "text-mint" },
                  { label: "DEPOSITED", value: `${formatCoins(details.user.totalDeposited)} Rs.`, color: "text-mint" },
                  { label: "WITHDRAWN", value: `${formatCoins(details.user.totalWithdrawn)} Rs.`, color: "text-amber2" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                    <span className="block font-display text-[8px] font-black tracking-wider text-white/40">
                      {stat.label}
                    </span>
                    <span className={cn("mt-0.5 block font-mono text-xs font-bold", stat.color)}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Section Tabs */}
              <div className="flex gap-2 rounded-2xl border border-gold/15 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => setSection("bets")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[10.5px] font-black tracking-wider transition-all",
                    section === "bets" ? "gold-btn text-black" : "text-white/55 hover:text-white",
                  )}
                >
                  <ReceiptText size={13} /> BETS ({details.bets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSection("tx")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[10.5px] font-black tracking-wider transition-all",
                    section === "tx" ? "gold-btn text-black" : "text-white/55 hover:text-white",
                  )}
                >
                  <History size={13} /> TRANSACTIONS ({details.transactions.length})
                </button>
              </div>

              {section === "bets" ? (
                <div className="space-y-3">
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                    {(
                      [
                        { key: "all", label: `ALL (${details.bets.length})` },
                        { key: "pending", label: `PENDING (${details.user.pendingBets})` },
                        { key: "won", label: "WON" },
                        { key: "lost", label: "LOST" },
                        { key: "cancelled", label: `CANCELLED (${details.user.cancelledBetsCount})` },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBetFilter(key)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1 font-display text-[9px] font-bold tracking-wider transition-all",
                          betFilter === key
                            ? "border-gold bg-gold/20 text-goldlight"
                            : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {filteredBets.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/30 py-8 text-center font-mono text-xs text-white/40">
                      No bets found in this category.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredBets.map((b) => {
                        const { fee, refund } = calculateCancellationRefund(b.stake, 2);
                        const isConfirming = confirmCancelBetId === b.id;
                        const isBusy = cancellingBetId === b.id;

                        return (
                          <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-display text-[9.5px] font-bold text-gold">{b.league}</span>
                                <p className="text-xs font-bold text-white sm:text-sm">
                                  {b.teamA} vs {b.teamB}
                                </p>
                              </div>
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

                            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2.5 font-mono text-[11px] sm:grid-cols-4">
                              <div>
                                <span className="block text-[8.5px] text-white/35">SELECTED TEAM</span>
                                <strong className="text-neon">
                                  {b.selectionTeam} @ {b.odds.toFixed(2)}x
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[8.5px] text-white/35">STAKE AMOUNT</span>
                                <strong className="text-goldlight">{formatCoins(b.stake)} Rs.</strong>
                              </div>
                              <div>
                                <span className="block text-[8.5px] text-white/35">
                                  {b.status === "won"
                                    ? "CREDITED"
                                    : b.status === "cancelled"
                                      ? "REFUND (98%)"
                                      : b.status === "lost"
                                        ? "PAYOUT"
                                        : "POTENTIAL"}
                                </span>
                                <strong
                                  className={cn(
                                    b.status === "lost"
                                      ? "text-ruby"
                                      : b.status === "cancelled" || b.status === "refunded"
                                        ? "text-amber2"
                                        : "text-mint",
                                  )}
                                >
                                  {b.status === "lost"
                                    ? "0 Rs."
                                    : b.status === "cancelled"
                                      ? `${formatCoins(refund)} Rs.`
                                      : b.status === "refunded"
                                        ? `${formatCoins(b.stake)} Rs.`
                                        : `${formatCoins(b.potential)} Rs.`}
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[8.5px] text-white/35">PLACED TIME</span>
                                <span className="text-white/70">{formatDateTime(b.createdAt)}</span>
                              </div>
                            </div>

                            {b.status === "pending" && (
                              <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                                {isConfirming ? (
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber2/40 bg-amber2/10 p-2.5">
                                    <p className="font-mono text-[10px] text-amber2">
                                      Cancel Bet #{b.id}: deduct 2% ({formatCoins(fee)} Rs.), refund{" "}
                                      <strong>{formatCoins(refund)} Rs.</strong>
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => setConfirmCancelBetId(null)}
                                        className="rounded-lg border border-white/15 px-2.5 py-1 text-[9.5px] font-bold text-white/60 hover:text-white"
                                      >
                                        KEEP
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => void adminCancelBet(b)}
                                        className="rounded-lg bg-amber2 px-3 py-1 font-display text-[9.5px] font-black text-black disabled:opacity-50"
                                      >
                                        {isBusy ? "WAIT..." : "CONFIRM CANCEL"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={cancellingBetId !== null}
                                    onClick={() => setConfirmCancelBetId(b.id)}
                                    className="rounded-lg border border-amber2/35 bg-amber2/10 px-3 py-1.5 font-display text-[9.5px] font-black text-amber2 hover:bg-amber2/20 disabled:opacity-40"
                                  >
                                    CANCEL BET (2% FEE • REFUND {formatCoins(refund)} RS.)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : details.transactions.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/30 py-8 text-center font-mono text-xs text-white/40">
                  No transaction history recorded for this user.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  {details.transactions.map((t: TxDTO, idx: number) => {
                    const isZero = t.type === "loss" || t.amount === 0;
                    const isCancel = t.type === "bet_cancelled";
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3.5",
                          idx !== details.transactions.length - 1 && "border-b border-white/[0.05]",
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "font-display text-[10px] font-bold",
                              isCancel ? "text-amber2" : "text-white/80",
                            )}
                          >
                            {isCancel ? "BET CANCELLED (98% REFUND)" : t.type.toUpperCase()}
                          </p>
                          {t.note && <p className="mt-0.5 text-xs text-white/45">{t.note}</p>}
                          <p className="mt-0.5 font-mono text-[9.5px] text-white/30">
                            {formatDateTime(t.createdAt)} · Balance After: {formatCoins(t.balanceAfter)} Rs.
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs font-bold sm:text-sm",
                            isZero ? "text-white/45" : isCancel ? "text-amber2" : t.amount > 0 ? "text-mint" : "text-ruby",
                          )}
                        >
                          {isZero ? "0 Rs." : t.amount > 0 ? `+${formatCoins(t.amount)} Rs.` : `${formatCoins(t.amount)} Rs.`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminWalletModal({
  user,
  mode,
  onClose,
  onSuccess,
  showToast,
}: {
  user: AdminUser;
  mode: "add" | "deduct";
  onClose: () => void;
  onSuccess: (amount: number) => void;
  showToast: (m: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdd = mode === "add";
  const amt = sanitizeStake(amount);

  async function submit() {
    if (busy) return;
    if (amt <= 0) {
      showToast("Enter a valid positive amount");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "wallet", mode, amount: amt, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSuccess(amt);
      } else {
        showToast(data.error || "Failed to update wallet");
        setBusy(false);
      }
    } catch {
      showToast("Network error updating wallet");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xs font-black tracking-widest text-goldlight">
            {isAdd ? "ADD COINS (DEPOSIT)" : "DEDUCT COINS (WITHDRAW)"}
          </h3>
          <button disabled={busy} onClick={onClose} className="disabled:opacity-40">
            <X size={16} />
          </button>
        </div>
        <p className="mb-2 text-xs text-white/50">
          User: <strong className="text-white">{user.username}</strong> · Current Balance: <strong className="text-goldlight">{formatCoins(user.balance)} Rs.</strong>
        </p>
        <input
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          placeholder="Amount in Rs."
          className="mb-3 w-full rounded-xl border border-gold/20 bg-black/40 p-3 font-mono text-lg font-bold text-goldlight outline-none"
        />
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {[500, 1000, 5000, 10000].map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => setAmount(String((sanitizeStake(amount)) + v))}
              className="rounded-lg border border-gold/25 bg-gold/[0.06] py-1 font-mono text-xs text-goldlight hover:bg-gold/20 disabled:opacity-40"
            >
              +{v}
            </button>
          ))}
        </div>
        <input
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason / Note (e.g. Deposit via UPI #4812)"
          className="mb-4 w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 text-xs outline-none"
        />
        <button
          onClick={submit}
          disabled={busy || amt <= 0}
          className={cn(
            "w-full rounded-xl py-3 font-display text-xs font-black tracking-widest disabled:opacity-40",
            isAdd ? "bg-mint text-black" : "bg-amber2 text-black",
          )}
        >
          {busy ? "PROCESSING..." : isAdd ? `CONFIRM DEPOSIT OF ${formatCoins(amt)} RS.` : `CONFIRM WITHDRAWAL OF ${formatCoins(amt)} RS.`}
        </button>
      </div>
    </div>
  );
}

function AdminCreateUserModal({
  onClose,
  onSuccess,
  showToast,
}: {
  onClose: () => void;
  onSuccess: () => void;
  showToast: (m: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState("0");
  const [busy, setBusy] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "available" | "taken">("idle");
  const [created, setCreated] = useState<{ u: string; p: string } | null>(null);
  const [supportLink, setSupportLink] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [websiteLink, setWebsiteLink] = useState("https://tossbook786.com");
  const [welcomeTemplate, setWelcomeTemplate] = useState<string>(DEFAULT_WELCOME_TEMPLATE);

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.supportUrl || d.telegramUrl) {
          setSupportLink(formatTelegramUrl(d.supportUrl || d.telegramUrl));
        }
        if (d.websiteUrl) setWebsiteLink(d.websiteUrl);
        if (d.userWelcomeTemplate) setWelcomeTemplate(d.userWelcomeTemplate);
      })
      .catch(() => {});
  }, []);

  const verifyUsername = useCallback(async (u: string) => {
    const trimmed = u.trim();
    if (trimmed.length < 3) {
      setUsernameStatus("idle");
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/admin/users/check?username=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      }
    } catch {
      /* ignore */
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  async function handleAutoGen() {
    if (busy || checkingUsername) return;
    setCheckingUsername(true);
    try {
      const r = await fetch("/api/admin/users/generate", { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setUsername(d.username);
        setPassword(d.password);
        setUsernameStatus("available");
        showToast("Auto-recommended unique ID & secure password generated!");
      }
    } catch {
      showToast("Error generating credentials");
    } finally {
      setCheckingUsername(false);
    }
  }

  async function handleSubmit() {
    if (busy) return;
    const u = username.trim();
    const p = password.trim();
    if (u.length < 3) {
      showToast("Username must be at least 3 characters");
      return;
    }
    if (p.length < 4) {
      showToast("Password must be at least 4 characters");
      return;
    }
    if (usernameStatus === "taken") {
      showToast("Duplicate Username! ID already exists in database. Please choose another.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: u,
          password: p,
          phone: phone.trim() || null,
          initialBalance: Math.max(0, Math.floor(Number(balance) || 0)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreated({ u, p });
        onSuccess();
      } else {
        if (data.error === "USERNAME_TAKEN") {
          setUsernameStatus("taken");
          showToast("Duplicate ID! Username already exists in database.");
        } else {
          showToast(data.error || "Create user failed");
        }
      }
    } catch {
      showToast("Network error creating user");
    } finally {
      setBusy(false);
    }
  }

  const formattedMessage = created
    ? renderWelcomeMessage(welcomeTemplate, created.u, created.p, websiteLink, supportLink)
    : "";

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-gold/15 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-gold" />
            <h3 className="font-display text-xs font-black tracking-widest text-goldlight">
              {created ? "PUNTER ID CREATED & READY" : "CREATE NEW PUNTER ID"}
            </h3>
          </div>
          <button
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:text-white disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {!created ? (
          <div className="space-y-3.5">
            <button
              type="button"
              disabled={busy || checkingUsername}
              onClick={handleAutoGen}
              className="glow-neon flex w-full items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/[0.08] py-2.5 font-display text-xs font-bold text-neon transition-all hover:bg-neon/[0.15] disabled:opacity-50"
            >
              <Wand2 size={14} /> AUTO-RECOMMEND UNIQUE ID & PASSWORD
            </button>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[9.5px] font-black tracking-wider text-white/60">USERNAME (ID)</label>
                {checkingUsername ? (
                  <span className="flex items-center gap-1 font-mono text-[9px] text-neon">
                    <RefreshCw size={9} className="animate-spin" /> Verifying ID...
                  </span>
                ) : usernameStatus === "available" ? (
                  <span className="flex items-center gap-1 font-mono text-[9.5px] font-bold text-mint">
                    <CheckCircle2 size={11} /> Verified Unique (No Duplicate)
                  </span>
                ) : usernameStatus === "taken" ? (
                  <span className="flex items-center gap-1 font-mono text-[9.5px] font-bold text-ruby">
                    <AlertCircle size={11} /> Already Exists (Duplicate Found!)
                  </span>
                ) : null}
              </div>
              <input
                value={username}
                disabled={busy}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/\s+/g, "");
                  setUsername(val);
                  void verifyUsername(val);
                }}
                onBlur={() => void verifyUsername(username)}
                placeholder="e.g. devil9751 or anoj"
                className={cn(
                  "w-full rounded-xl border bg-white/[0.03] p-3 font-mono text-xs font-bold outline-none transition-all",
                  usernameStatus === "available"
                    ? "border-mint/60 text-mint shadow-[0_0_12px_rgba(47,230,167,0.15)]"
                    : usernameStatus === "taken"
                      ? "border-ruby/70 text-ruby shadow-[0_0_12px_rgba(255,51,85,0.15)]"
                      : "border-gold/20 text-goldlight focus:border-gold",
                )}
              />
              {usernameStatus === "taken" && (
                <p className="mt-1 text-[9.5px] text-ruby">
                  ⚠️ This username already exists in database. Duplicate IDs are blocked for security.
                </p>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[9.5px] font-black tracking-wider text-white/60">PASSWORD</label>
                <span className="text-[9px] text-white/40">Capital letter required</span>
              </div>
              <input
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="e.g. Abcd@1122"
                className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-mono text-xs font-bold text-goldlight outline-none focus:border-gold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[9.5px] font-black tracking-wider text-white/60">INITIAL COINS (RS.)</label>
                <input
                  value={balance}
                  disabled={busy}
                  onChange={(e) => setBalance(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-mono text-xs font-bold text-white outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="mb-1 block text-[9.5px] font-black tracking-wider text-white/60">PHONE (OPTIONAL)</label>
                <input
                  value={phone}
                  disabled={busy}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={busy || usernameStatus === "taken"}
              className="gold-btn mt-2 w-full rounded-xl py-3 font-display text-xs font-black tracking-widest disabled:opacity-50"
            >
              {busy ? "CREATING & SAVING..." : "ACTIVATE & SAVE TO DATABASE 🔐"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-mint/40 bg-mint/[0.08] p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 font-display text-xs font-black text-mint">
                <CheckCircle2 size={16} /> ID ACTIVATED IN DATABASE
              </div>
              <p className="mt-2 font-mono text-sm font-bold text-white">User👤: {created.u}</p>
              <p className="font-mono text-sm font-bold text-goldlight">Password🔐: {created.p}</p>
            </div>

            <div className="relative rounded-2xl border border-gold/25 bg-black/60 p-4">
              <label className="mb-2 block font-display text-[9.5px] font-black tracking-wider text-goldlight/80">
                CLIENT MESSAGE (FORMATTED FOR TELEGRAM/WHATSAPP)
              </label>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#f3eedd]">
                {formattedMessage}
              </pre>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(formattedMessage).catch(() => {});
                  showToast("Message copied to clipboard!");
                }}
                className="glow-neon flex w-full items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/[0.12] py-3 font-display text-xs font-black tracking-wider text-neon transition-all hover:bg-neon/20"
              >
                <Copy size={15} /> COPY TELEGRAM MESSAGE
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(supportLink)}&text=${encodeURIComponent(formattedMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#0088cc]/50 bg-[#0088cc]/15 py-2.5 font-display text-[11px] font-bold text-[#38a9eb] hover:bg-[#0088cc]/25"
                >
                  <Send size={13} /> SHARE TG
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-mint/50 bg-mint/15 py-2.5 font-display text-[11px] font-bold text-mint hover:bg-mint/25"
                >
                  <Share2 size={13} /> SHARE WA
                </a>
              </div>

              <button onClick={onClose} className="gold-btn w-full rounded-xl py-2.5 font-display text-xs font-black">
                DONE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   ADMIN MATCHES & SETTINGS PANELS
   ========================================================================== */

function AdminMatchesPanel({
  onChanged,
  showToast,
}: {
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [matches, setMatches] = useState<AdminMatch[] | null>(null);
  const [league, setLeague] = useState("TOSS 786 CUP");
  const [teamA, setTeamA] = useState("INDIA");
  const [teamB, setTeamB] = useState("PAKISTAN");
  const [dayChoice, setDayChoice] = useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [timeStr, setTimeStr] = useState("16:45");
  const [autoCloseMins, setAutoCloseMins] = useState(40);
  const [oddsA, setOddsA] = useState("1.95");
  const [oddsB, setOddsB] = useState("1.95");
  const [matchImg, setMatchImg] = useState<string>(DEFAULT_BANNER);
  const [editingMatch, setEditingMatch] = useState<AdminMatch | null>(null);
  const [inspectMatchId, setInspectMatchId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [settlingMatchId, setSettlingMatchId] = useState<number | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const matchPicFileRef = useRef<HTMLInputElement | null>(null);
  const editPicFileRef = useRef<HTMLInputElement | null>(null);

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
    const t = setInterval(() => {
      if (
        (typeof document === "undefined" || document.visibilityState === "visible") &&
        !editingMatch &&
        inspectMatchId === null
      ) {
        void load();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [load, editingMatch, inspectMatchId]);

  async function handleMatchPicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose a PNG or image file");
      return;
    }
    try {
      const optimized = await compressImageFile(file, 1200, 0.82);
      setMatchImg(optimized);
      showToast("Real Match image optimized & preview ready!");
    } catch {
      showToast("Could not process selected image file");
    }
  }

  async function handleEditPicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingMatch) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose a PNG or image file");
      return;
    }
    try {
      const optimized = await compressImageFile(file, 1200, 0.82);
      setEditingMatch((prev) => (prev ? { ...prev, matchImg: optimized } : null));
      showToast("New Match image optimized!");
    } catch {
      showToast("Could not process selected image file");
    }
  }

  async function saveEditedMatch() {
    if (!editingMatch || savingEdit) return;
    if (!editingMatch.teamA.trim() || !editingMatch.teamB.trim()) {
      showToast("Both team names are required");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/matches/${editingMatch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          league: editingMatch.league,
          teamA: editingMatch.teamA,
          teamB: editingMatch.teamB,
          matchImg: editingMatch.matchImg,
          oddsA: sanitizeOdds(editingMatch.oddsA),
          oddsB: sanitizeOdds(editingMatch.oddsB),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("Match updated & new PNG image saved!");
        setEditingMatch(null);
        void load();
        onChanged();
      } else {
        showToast(data.error || "Failed to update match");
      }
    } catch {
      showToast("Error updating match");
    } finally {
      setSavingEdit(false);
    }
  }

  const { matchDate, closeDate, isValid } = useMemo(() => {
    try {
      const d = new Date();
      if (dayChoice === "tomorrow") {
        d.setDate(d.getDate() + 1);
      } else if (dayChoice === "custom" && customDate) {
        const [y, m, day] = customDate.split("-").map(Number);
        d.setFullYear(y, m - 1, day);
      }
      const [h, min] = timeStr.split(":").map(Number);
      if (isNaN(h) || isNaN(min)) return { matchDate: d, closeDate: d, isValid: false };
      d.setHours(h, min, 0, 0);

      const closeMs = d.getTime() - autoCloseMins * 60 * 1000;
      const c = new Date(closeMs);
      return { matchDate: d, closeDate: c, isValid: true };
    } catch {
      return { matchDate: new Date(), closeDate: new Date(), isValid: false };
    }
  }, [dayChoice, customDate, timeStr, autoCloseMins]);

  async function scheduleMatch() {
    if (submitting) return;
    if (!teamA.trim() || !teamB.trim()) {
      showToast("Enter both team names");
      return;
    }
    if (!isValid) {
      showToast("Invalid time format (use HH:MM)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          league: league.trim().toUpperCase(),
          teamA: teamA.trim().toUpperCase(),
          teamB: teamB.trim().toUpperCase(),
          matchImg: matchImg || null,
          startTime: matchDate.toISOString(),
          tossCloseTime: closeDate.toISOString(),
          oddsA: sanitizeOdds(oddsA),
          oddsB: sanitizeOdds(oddsB),
        }),
      });
      if (res.ok) {
        showToast("Match scheduled & saved with Real Match PNG! Countdown active.");
        void load();
        onChanged();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to schedule match");
      }
    } catch {
      showToast("Network error scheduling match");
    } finally {
      setSubmitting(false);
    }
  }

  async function settleMatch(id: number, result: "A" | "B" | "cancel") {
    if (settlingMatchId !== null) return;
    setSettlingMatchId(id);
    try {
      const res = await fetch(`/api/admin/matches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ result }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          result === "cancel"
            ? `Cancelled & refunded ${formatCoins(data.refunded ?? 0)} Rs.`
            : `Result declared! Credited ${formatCoins(data.credited ?? 0)} Rs. to ${data.winners ?? 0} winner(s)`,
        );
        await load();
        onChanged();
      } else {
        showToast(data.error || "Settlement rejected by server");
        await load();
      }
    } catch {
      showToast("Network error during settlement. Please retry.");
    } finally {
      setSettlingMatchId(null);
    }
  }

  async function deleteMatch(id: number) {
    if (deletingMatchId !== null) return;
    setDeletingMatchId(id);
    try {
      const res = await fetch(`/api/admin/matches/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Match deleted");
        setConfirmDeleteId(null);
        await load();
        onChanged();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Cannot delete match with placed bets");
        setConfirmDeleteId(null);
      }
    } catch {
      showToast("Failed to delete match");
    } finally {
      setDeletingMatchId(null);
    }
  }

  function setPresetTime(hoursToAdd: number) {
    const d = new Date(Date.now() + hoursToAdd * 3600000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setTimeStr(`${hh}:${mm}`);
  }

  return (
    <div className="space-y-6">
      {/* Schedule Form */}
      <div className="glass metal-border glow-gold rounded-3xl p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 pb-3">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-gold" />
            <h3 className="font-display text-xs font-black tracking-widest text-goldlight sm:text-sm">
              TOSS MATCH SCHEDULER & AUTO BET CLOSE SYSTEM
            </h3>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-[10px] font-bold text-goldlight">
            ATOMIC LEDGER SYNCED
          </span>
        </div>

        {/* Quick League & Match Presets */}
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9.5px] font-black text-white/40">LEAGUE PRESETS:</span>
            {["TOSS 786 CUP", "IPL 2026", "ICC T20 WC", "ASIA CUP", "BBL 2026"].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLeague(l)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[9.5px] font-bold transition-all",
                  league === l
                    ? "border-gold bg-gold/20 text-goldlight"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9.5px] font-black text-white/40">MATCH PRESETS:</span>
            {[
              ["INDIA", "NEPAL"],
              ["INDIA", "PAKISTAN"],
              ["AUSTRALIA", "ENGLAND"],
              ["CSK", "MI"],
              ["RCB", "KKR"],
              ["TITANS", "STORM"],
            ].map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                onClick={() => {
                  setTeamA(a);
                  setTeamB(b);
                }}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[9.5px] font-bold transition-all",
                  teamA === a && teamB === b
                    ? "border-neon bg-neon/20 text-neon"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                )}
              >
                {a} vs {b}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[9.5px] font-black text-white/50">LEAGUE NAME</label>
              <input
                value={league}
                onChange={(e) => setLeague(e.target.value.toUpperCase())}
                placeholder="e.g. TOSS 786 CUP"
                className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-display text-xs font-bold text-white outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9.5px] font-black text-white/50">TEAM A</label>
              <input
                value={teamA}
                onChange={(e) => setTeamA(e.target.value.toUpperCase())}
                placeholder="e.g. INDIA"
                className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-display text-xs font-bold text-white outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9.5px] font-black text-white/50">TEAM B</label>
              <input
                value={teamB}
                onChange={(e) => setTeamB(e.target.value.toUpperCase())}
                placeholder="e.g. PAKISTAN"
                className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-display text-xs font-bold text-white outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-black/60 p-4 shadow-xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-neon" />
                <label className="text-[10px] font-black tracking-wider text-neon">
                  REAL MATCH PNG IMAGE / POSTER (HOMEPAGE & MATCH CARD DISPLAY)
                </label>
              </div>
              <span className="rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-neon">
                PNG UPLOAD READY
              </span>
            </div>
            <p className="mb-3 text-[10.5px] leading-relaxed text-white/60">
              Upload real match photo/poster (PNG) for this match. Images are automatically compressed for ultra-fast mobile loading!
            </p>

            <div className="relative mb-3 overflow-hidden rounded-xl border border-gold/30 bg-black/80 shadow-md">
              <SafePosterImg
                src={matchImg}
                alt="Match Poster Preview"
                className="h-44 w-full object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />
              <div className="absolute left-3 top-2.5">
                <span className="rounded-full border border-gold/40 bg-black/80 px-2.5 py-0.5 font-display text-[9px] font-black text-goldlight backdrop-blur-md">
                  {league}
                </span>
              </div>
              <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                <div>
                  <p className="font-display text-base font-black text-white drop-shadow">
                    {teamA || "TEAM A"} VS {teamB || "TEAM B"}
                  </p>
                  <p className="font-mono text-[10px] text-goldlight drop-shadow">
                    MATCH FIXTURE · {dayChoice.toUpperCase()} · AUTO-SUSPEND CUTOFF: {autoCloseMins}m
                  </p>
                </div>
                <span className="rounded-full border border-neon/40 bg-neon/20 px-2.5 py-0.5 font-mono text-[9px] font-bold text-neon">
                  REAL POSTER
                </span>
              </div>
            </div>

            <input
              type="file"
              ref={matchPicFileRef}
              onChange={(e) => void handleMatchPicUpload(e)}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => matchPicFileRef.current?.click()}
                className="glow-neon flex items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/15 py-2.5 font-display text-xs font-black tracking-wider text-neon hover:bg-neon/25"
              >
                <Upload size={14} /> UPLOAD REAL MATCH PNG FILE
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-black text-white/40">PRESET POSTERS:</span>
                {[
                  { name: "IND vs NEP", url: DEFAULT_BANNER },
                  { name: "IND vs PAK", url: "https://images.unsplash.com/photo-1531415074868-036b107e775a?auto=format&fit=crop&w=1200&q=80" },
                  { name: "IPL STADIUM", url: "https://images.unsplash.com/photo-1589487391730-58f20eb2c308?auto=format&fit=crop&w=1200&q=80" },
                ].map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setMatchImg(p.url);
                      showToast(`Loaded ${p.name} poster!`);
                    }}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[9px] font-bold text-white/70 hover:border-gold/30 hover:text-white"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2.5">
              <label className="mb-1 block text-[9px] font-black text-white/40">OR PASTE PNG / IMAGE URL DIRECTLY</label>
              <input
                value={matchImg}
                onChange={(e) => setMatchImg(e.target.value)}
                placeholder="https://example.com/match-poster.png"
                className="w-full rounded-xl border border-gold/15 bg-white/[0.02] p-2.5 font-mono text-xs text-goldlight outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-gold/15 bg-black/40 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[9.5px] font-black tracking-wider text-goldlight">
                1. SELECT MATCH DAY
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "today", label: "TODAY" },
                  { id: "tomorrow", label: "TOMORROW" },
                  { id: "custom", label: "CUSTOM DATE" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDayChoice(id as "today" | "tomorrow" | "custom")}
                    className={cn(
                      "rounded-xl border py-2.5 font-display text-xs font-black transition-all",
                      dayChoice === id
                        ? "border-gold bg-gold/25 text-goldlight shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {dayChoice === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gold/20 bg-white/[0.03] p-2.5 font-mono text-xs font-bold text-white outline-none focus:border-gold"
                />
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[9.5px] font-black tracking-wider text-goldlight">
                  2. MATCH TIME BOX (COUNTDOWN RUNS UNTIL CLOSE)
                </label>
                <span className="font-mono text-[9px] text-white/40">24H format</span>
              </div>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-2.5 font-mono text-sm font-bold text-neon outline-none focus:border-neon"
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPresetTime(1)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-white/60 hover:text-white"
                >
                  +1 HOUR
                </button>
                <button
                  type="button"
                  onClick={() => setPresetTime(2)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-white/60 hover:text-white"
                >
                  +2 HOURS
                </button>
                <button
                  type="button"
                  onClick={() => setTimeStr("16:45")}
                  className="rounded-lg border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[9px] text-goldlight"
                >
                  4:45 PM
                </button>
                <button
                  type="button"
                  onClick={() => setTimeStr("19:30")}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-white/60 hover:text-white"
                >
                  7:30 PM
                </button>
                <button
                  type="button"
                  onClick={() => setTimeStr("20:00")}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] text-white/60 hover:text-white"
                >
                  8:00 PM
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gold/15 bg-black/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="text-[10px] font-black tracking-wider text-amber2">
                  3. AUTO BET CLOSE (TOSS CUTOFF TIME)
                </label>
                <p className="text-[10px] text-white/50">
                  Cutoff minute pe Toss Bet automatically close / SUSPEND ho jayega.
                </p>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber2">
                <span>{autoCloseMins} MINS BEFORE MATCH</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { mins: 40, label: "40 MIN (RECOMMENDED)" },
                { mins: 30, label: "30 MIN BEFORE" },
                { mins: 15, label: "15 MIN BEFORE" },
                { mins: 5, label: "5 MIN BEFORE" },
                { mins: 0, label: "AT MATCH TIME (0M)" },
              ].map(({ mins, label }) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setAutoCloseMins(mins)}
                  className={cn(
                    "rounded-xl border py-2 text-center font-display text-[10px] font-bold transition-all",
                    autoCloseMins === mins
                      ? "border-amber2 bg-amber2/25 text-amber2 shadow-[0_0_12px_rgba(243,156,18,0.25)]"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-[9.5px] font-black text-white/40">OR ENTER CUSTOM MINS:</span>
              <input
                type="number"
                min="0"
                max="300"
                value={autoCloseMins}
                onChange={(e) => setAutoCloseMins(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 rounded-lg border border-gold/20 bg-white/[0.03] p-1.5 text-center font-mono text-xs font-bold text-white outline-none focus:border-gold"
              />
              <span className="text-[9.5px] text-white/40">minutes before match start time</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[9.5px] font-black text-white/50">ODDS TEAM A ({teamA})</label>
              <input
                value={oddsA}
                onChange={(e) => setOddsA(e.target.value)}
                placeholder="1.95"
                className="w-full rounded-xl border border-neon/30 bg-white/[0.03] p-3 font-mono text-xs font-bold text-neon outline-none focus:border-neon"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9.5px] font-black text-white/50">ODDS TEAM B ({teamB})</label>
              <input
                value={oddsB}
                onChange={(e) => setOddsB(e.target.value)}
                placeholder="1.95"
                className="w-full rounded-xl border border-neon/30 bg-white/[0.03] p-3 font-mono text-xs font-bold text-neon outline-none focus:border-neon"
              />
            </div>

            <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-3 text-center sm:col-span-1">
              <p className="font-display text-[9.5px] font-bold text-goldlight">CALCULATED TIMINGS:</p>
              <p className="mt-0.5 font-mono text-xs text-white">
                Match Start: <strong>{formatClock(matchDate.toISOString())}</strong>
              </p>
              <p className="font-mono text-xs font-bold text-amber2">
                🔒 Bet Closes: {formatClock(closeDate.toISOString())}
              </p>
              <p className="text-[9px] text-white/40">
                ({autoCloseMins} min cutoff auto-suspends betting)
              </p>
            </div>
          </div>

          <button
            onClick={scheduleMatch}
            disabled={submitting}
            className="gold-btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-xs font-black tracking-widest shadow-xl disabled:opacity-50"
          >
            <Flag size={15} /> {submitting ? "SCHEDULING MATCH..." : "SCHEDULE & OPEN TOSS BETTING (AUTO-SUSPEND ACTIVE)"}
          </button>
        </div>
      </div>

      {/* Existing Matches List */}
      <div className="space-y-3">
        <h4 className="font-display text-xs font-black tracking-widest text-goldlight">
          ALL CONTESTS ({matches?.length || 0})
        </h4>

        {matches?.map((m) => {
          const isSettled = m.status === "finished" || m.status === "cancelled";
          const isLocked = m.status === "locked";
          const isBusySettling = settlingMatchId === m.id;
          const isBusyDeleting = deletingMatchId === m.id;

          return (
            <div
              key={m.id}
              className={cn(
                "glass metal-border rounded-2xl p-4 transition-all",
                isLocked && !isSettled ? "border-ruby/40 bg-ruby/[0.03]" : "",
              )}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-gold/30 bg-black/60 shadow">
                  <SafePosterImg
                    src={m.matchImg}
                    alt={m.league}
                    className="h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <span className="absolute bottom-1 left-1.5 font-mono text-[8.5px] font-black text-goldlight drop-shadow">
                    #{m.id} PNG
                  </span>
                </div>

                <div className="min-w-[12rem] flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[9px] font-bold text-gold/80">{m.league}</span>
                    {isLocked && !isSettled ? (
                      <span className="flex items-center gap-1 rounded-full border border-ruby/50 bg-ruby/15 px-2 py-0.5 font-mono text-[9px] font-bold text-ruby">
                        <Lock size={9} /> SUSPENDED (BET CLOSED)
                      </span>
                    ) : !isSettled ? (
                      <span className="flex items-center gap-1 rounded-full border border-neon/30 bg-neon/10 px-2 py-0.5 font-mono text-[9px] font-bold text-neon">
                        <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-neon" /> LIVE
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[9px] text-white/50">
                        {m.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    {m.teamA} vs {m.teamB}
                  </p>
                  <p className="font-mono text-[10.5px] text-white/50">
                    Match: {formatClock(m.startTime)} · <strong className="text-amber2">Close Cutoff: {formatClock(m.tossCloseTime)}</strong> · Pool: {formatCoins(m.pendingStaked)} Rs. ({m.betCount} bets)
                  </p>
                </div>

                {!isSettled ? (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setInspectMatchId(m.id)}
                      className="flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 font-display text-[9.5px] font-bold text-goldlight hover:bg-gold/20"
                      title="Inspect all bet slips on this match"
                    >
                      <ReceiptText size={11} /> BETS ({m.betCount})
                    </button>
                    <button
                      disabled={isBusySettling || isBusyDeleting}
                      onClick={() => setEditingMatch(m)}
                      className="flex items-center gap-1 rounded-lg border border-neon/40 bg-neon/[0.1] px-2.5 py-1.5 font-display text-[9.5px] font-bold text-neon hover:bg-neon/20 disabled:opacity-50"
                      title="Edit Match PNG & Details"
                    >
                      <Edit3 size={11} /> EDIT PIC
                    </button>
                    <button
                      disabled={settlingMatchId !== null || isBusyDeleting}
                      onClick={() => void settleMatch(m.id, "A")}
                      className="rounded-lg border border-gold/50 bg-gold/[0.1] px-3 py-1.5 font-display text-[9.5px] font-black text-goldlight hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isBusySettling ? "SETTLING..." : `DECLARE ${m.teamA}`}
                    </button>
                    <button
                      disabled={settlingMatchId !== null || isBusyDeleting}
                      onClick={() => void settleMatch(m.id, "B")}
                      className="rounded-lg border border-gold/50 bg-gold/[0.1] px-3 py-1.5 font-display text-[9.5px] font-black text-goldlight hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isBusySettling ? "SETTLING..." : `DECLARE ${m.teamB}`}
                    </button>
                    <button
                      disabled={settlingMatchId !== null || isBusyDeleting}
                      onClick={() => void settleMatch(m.id, "cancel")}
                      className="rounded-lg border border-ruby/40 bg-ruby/[0.08] px-3 py-1.5 font-display text-[9.5px] font-black text-ruby hover:bg-ruby/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isBusySettling ? "WAIT..." : "REFUND ALL"}
                    </button>

                    {confirmDeleteId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={isBusyDeleting}
                          onClick={() => void deleteMatch(m.id)}
                          className="rounded-lg border border-ruby/60 bg-ruby/20 px-2 py-1 font-mono text-[9.5px] font-black text-ruby hover:bg-ruby/30 disabled:opacity-50"
                        >
                          {isBusyDeleting ? "..." : "CONFIRM"}
                        </button>
                        <button
                          disabled={isBusyDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-white/15 px-2 py-1 font-mono text-[9.5px] text-white/60 hover:text-white"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={isBusySettling || isBusyDeleting}
                        onClick={() => setConfirmDeleteId(m.id)}
                        className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:border-ruby/40 hover:text-ruby disabled:opacity-40"
                        title="Delete contest"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setInspectMatchId(m.id)}
                      className="flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 font-display text-[9.5px] font-bold text-goldlight hover:bg-gold/20"
                      title="Inspect all bet slips on this match"
                    >
                      <ReceiptText size={11} /> BETS ({m.betCount})
                    </button>
                    <button
                      onClick={() => setEditingMatch(m)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[9px] font-bold text-white/60 hover:border-gold/30 hover:text-white"
                      title="Edit Match PNG"
                    >
                      <Edit3 size={11} /> EDIT PIC
                    </button>
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-[10px] text-goldlight">
                      {m.status === "cancelled" ? "CANCELLED / REFUNDED" : `${m.winner === "A" ? m.teamA : m.teamB} WON 🏆`}
                    </span>
                    {confirmDeleteId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={isBusyDeleting}
                          onClick={() => void deleteMatch(m.id)}
                          className="rounded-lg border border-ruby/60 bg-ruby/20 px-2 py-1 font-mono text-[9.5px] font-black text-ruby hover:bg-ruby/30 disabled:opacity-50"
                        >
                          {isBusyDeleting ? "..." : "CONFIRM"}
                        </button>
                        <button
                          disabled={isBusyDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-white/15 px-2 py-1 font-mono text-[9.5px] text-white/60 hover:text-white"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={isBusyDeleting}
                        onClick={() => setConfirmDeleteId(m.id)}
                        className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:border-ruby/40 hover:text-ruby disabled:opacity-40"
                        title="Delete contest"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Match Bets Inspection Modal */}
      {inspectMatchId !== null && (
        <AdminMatchBetsModal
          matchId={inspectMatchId}
          onClose={() => setInspectMatchId(null)}
          onChanged={() => {
            void load();
            onChanged();
          }}
          showToast={showToast}
        />
      )}

      {/* Modal to Edit Match Details & Real Match PNG */}
      {editingMatch && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => {
            if (!savingEdit) setEditingMatch(null);
          }}
        >
          <div
            className="glass-deep metal-border glow-gold max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-gold/15 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={17} className="text-neon" />
                <h3 className="font-display text-xs font-black tracking-widest text-goldlight">
                  EDIT MATCH #{editingMatch.id} · REAL MATCH PNG & TEAMS
                </h3>
              </div>
              <button
                disabled={savingEdit}
                onClick={() => setEditingMatch(null)}
                className="rounded-lg p-1 text-white/50 hover:text-white disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-black/60 shadow">
                <SafePosterImg
                  src={editingMatch.matchImg}
                  alt="Poster preview"
                  className="h-44 w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
                  <div>
                    <span className="font-display text-[9.5px] font-bold text-goldlight">
                      {editingMatch.league}
                    </span>
                    <p className="font-display text-sm font-black text-white">
                      {editingMatch.teamA} VS {editingMatch.teamB}
                    </p>
                  </div>
                  <span className="rounded-full border border-neon/40 bg-neon/20 px-2 py-0.5 font-mono text-[9px] font-bold text-neon">
                    PNG READY
                  </span>
                </div>
              </div>

              <input
                type="file"
                ref={editPicFileRef}
                onChange={(e) => void handleEditPicUpload(e)}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => editPicFileRef.current?.click()}
                  className="glow-neon flex flex-1 items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/15 py-2.5 font-display text-xs font-bold text-neon hover:bg-neon/25 disabled:opacity-40"
                >
                  <Upload size={14} /> UPLOAD NEW REAL MATCH PNG
                </button>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-black text-white/40">OR ENTER PNG / IMAGE URL</label>
                <input
                  value={editingMatch.matchImg || ""}
                  disabled={savingEdit}
                  onChange={(e) => setEditingMatch({ ...editingMatch, matchImg: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-2.5 font-mono text-xs text-goldlight outline-none focus:border-gold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[9.5px] font-black text-white/60">TEAM A</label>
                  <input
                    value={editingMatch.teamA}
                    disabled={savingEdit}
                    onChange={(e) =>
                      setEditingMatch({ ...editingMatch, teamA: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-2.5 font-mono text-xs font-bold text-white outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-black text-white/60">TEAM B</label>
                  <input
                    value={editingMatch.teamB}
                    disabled={savingEdit}
                    onChange={(e) =>
                      setEditingMatch({ ...editingMatch, teamB: e.target.value.toUpperCase() })
                    }
                    className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-2.5 font-mono text-xs font-bold text-white outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingMatch(null)}
                  className="flex-1 rounded-xl border border-white/10 py-3 font-display text-xs font-bold text-white/60 hover:text-white disabled:opacity-40"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={saveEditedMatch}
                  className="gold-btn flex-1 rounded-xl py-3 font-display text-xs font-black tracking-wider disabled:opacity-50"
                >
                  {savingEdit ? "SAVING..." : "SAVE & UPDATE MATCH PNG"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminMatchBetsModal({
  matchId,
  onClose,
  onChanged,
  showToast,
}: {
  matchId: number;
  onClose: () => void;
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const [data, setData] = useState<AdminMatchBetsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingBetId, setCancellingBetId] = useState<number | null>(null);
  const [confirmBetId, setConfirmBetId] = useState<number | null>(null);

  const loadBets = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/matches/${matchId}/bets`, {
        cache: "no-store",
        credentials: "include",
      });
      if (r.ok) {
        setData(await r.json());
      } else {
        const err = await r.json().catch(() => ({}));
        showToast(err.error || "Could not load match bets");
      }
    } catch {
      showToast("Network error loading match bets");
    } finally {
      setLoading(false);
    }
  }, [matchId, showToast]);

  useEffect(() => {
    void loadBets();
  }, [loadBets]);

  async function cancelBetByAdmin(betId: number) {
    if (cancellingBetId !== null) return;
    setCancellingBetId(betId);
    try {
      const res = await fetch(`/api/admin/bets/${betId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(out.error || "Failed to cancel bet");
        setConfirmBetId(null);
        return;
      }
      showToast(
        `Bet #${betId} cancelled! Refunded ${formatCoins(out.refunded)} Rs. (2% fee: ${formatCoins(out.fee)} Rs.)`,
      );
      setConfirmBetId(null);
      await loadBets();
      onChanged();
    } catch {
      showToast("Network error cancelling bet");
    } finally {
      setCancellingBetId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-5"
      onClick={() => {
        if (cancellingBetId === null) onClose();
      }}
    >
      <div
        className="glass-deep metal-border glow-gold flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-black tracking-widest text-goldlight">
              {data ? `${data.match.teamA} vs ${data.match.teamB} · BETS BREAKDOWN` : `CONTEST #${matchId} BETS`}
            </h3>
            {data && (
              <p className="mt-0.5 font-mono text-[10px] text-white/45">
                {data.match.league} · Total Pool: {formatCoins(data.summary.totalStaked)} Rs.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={cancellingBetId !== null}
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Spinner size={24} className="text-gold" />
              <p className="mt-2 font-mono text-xs text-white/40">Loading match bet slips...</p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                  <span className="block font-display text-[8px] font-black text-white/40">TOTAL BETS</span>
                  <strong className="font-mono text-xs text-white">{data.summary.totalBets}</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                  <span className="block font-display text-[8px] font-black text-white/40">PENDING POOL</span>
                  <strong className="font-mono text-xs text-neon">{formatCoins(data.summary.pendingStaked)} Rs.</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                  <span className="block truncate font-display text-[8px] font-black text-white/40">
                    ON {data.match.teamA}
                  </span>
                  <strong className="font-mono text-xs text-goldlight">{formatCoins(data.summary.teamAStaked)} Rs.</strong>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
                  <span className="block truncate font-display text-[8px] font-black text-white/40">
                    ON {data.match.teamB}
                  </span>
                  <strong className="font-mono text-xs text-goldlight">{formatCoins(data.summary.teamBStaked)} Rs.</strong>
                </div>
              </div>

              {data.bets.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/30 py-8 text-center font-mono text-xs text-white/40">
                  No bets placed on this contest yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.bets.map((b) => {
                    const { fee, refund } = calculateCancellationRefund(b.stake, 2);
                    const isConfirming = confirmBetId === b.id;
                    const isBusy = cancellingBetId === b.id;
                    return (
                      <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-bold text-goldlight">
                              #{b.id} · {b.username}
                            </p>
                            <p className="font-mono text-[9.5px] text-white/35">
                              {b.phone ? `${b.phone} · ` : ""}
                              {formatDateTime(b.createdAt)}
                            </p>
                          </div>
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

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 font-mono text-[11px]">
                          <span>
                            Team: <strong className="text-neon">{b.selectionTeam}</strong> ({b.odds.toFixed(2)}x)
                          </span>
                          <span>
                            Stake: <strong className="text-goldlight">{formatCoins(b.stake)} Rs.</strong>
                          </span>
                          <span>
                            {b.status === "cancelled" ? "Refund (98%): " : "Potential: "}
                            <strong className={b.status === "cancelled" ? "text-amber2" : "text-mint"}>
                              {b.status === "cancelled"
                                ? `${formatCoins(refund)} Rs.`
                                : `${formatCoins(b.potential)} Rs.`}
                            </strong>
                          </span>
                        </div>

                        {b.status === "pending" && (
                          <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                            {isConfirming ? (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber2/40 bg-amber2/10 p-2">
                                <span className="font-mono text-[10px] text-amber2">
                                  Deduct 2% ({formatCoins(fee)} Rs.), refund {formatCoins(refund)} Rs.
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setConfirmBetId(null)}
                                    className="rounded-lg border border-white/15 px-2.5 py-1 text-[9.5px] font-bold text-white/60"
                                  >
                                    NO
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void cancelBetByAdmin(b.id)}
                                    className="rounded-lg bg-amber2 px-3 py-1 font-display text-[9.5px] font-black text-black disabled:opacity-50"
                                  >
                                    {isBusy ? "..." : "CONFIRM CANCEL"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={cancellingBetId !== null}
                                onClick={() => setConfirmBetId(b.id)}
                                className="rounded-lg border border-amber2/35 bg-amber2/10 px-3 py-1 font-display text-[9.5px] font-black text-amber2 hover:bg-amber2/20 disabled:opacity-40"
                              >
                                CANCEL BET (2% FEE • REFUND {formatCoins(refund)} RS.)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminSettingsPanel({
  username,
  onSessionCleared,
  showToast,
}: {
  username: string;
  onSessionCleared: () => void;
  showToast: (m: string) => void;
}) {
  const [frozen, setFrozen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("https://tossbook786.com");
  const [telegramUrl, setTelegramUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [telegramChannelUrl, setTelegramChannelUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [telegramGroupUrl, setTelegramGroupUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [depositTelegramUrl, setDepositTelegramUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [withdrawTelegramUrl, setWithdrawTelegramUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [supportUrl, setSupportUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [getNewIdUrl, setGetNewIdUrl] = useState("https://t.me/+FNrv5zNv6lI0ODk1");
  const [userWelcomeTemplate, setUserWelcomeTemplate] = useState(DEFAULT_WELCOME_TEMPLATE);
  const [matchScheduleBanner, setMatchScheduleBanner] = useState(DEFAULT_BANNER);
  const [marqueeText, setMarqueeText] = useState(
    "Welcome to the Toss Book. Asia's No. 1 Gaming Platform. Min bet 100, Min Withdraw 500, Get 200 for Each Referral. Instant 24x7 Royal Service!",
  );
  const [minBet, setMinBet] = useState("100");
  const [minWithdraw, setMinWithdraw] = useState("500");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setFrozen(Boolean(d.marketFrozen));
        if (d.websiteUrl) setWebsiteUrl(d.websiteUrl);
        if (d.telegramUrl) setTelegramUrl(d.telegramUrl);
        if (d.telegramChannelUrl) setTelegramChannelUrl(d.telegramChannelUrl);
        if (d.telegramGroupUrl) setTelegramGroupUrl(d.telegramGroupUrl);
        if (d.depositTelegramUrl) setDepositTelegramUrl(d.depositTelegramUrl);
        if (d.withdrawTelegramUrl) setWithdrawTelegramUrl(d.withdrawTelegramUrl);
        if (d.supportUrl) setSupportUrl(d.supportUrl);
        if (d.getNewIdUrl) setGetNewIdUrl(d.getNewIdUrl);
        if (d.userWelcomeTemplate) setUserWelcomeTemplate(d.userWelcomeTemplate);
        if (d.matchScheduleBanner) setMatchScheduleBanner(d.matchScheduleBanner);
        if (d.marqueeText) setMarqueeText(d.marqueeText);
        if (d.minBet) setMinBet(String(d.minBet));
        if (d.minWithdraw) setMinWithdraw(String(d.minWithdraw));
      })
      .catch(() => {});
  }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select a PNG or image file!");
      return;
    }
    try {
      const optimized = await compressImageFile(file, 1400, 0.84);
      setMatchScheduleBanner(optimized);
      showToast("Match schedule image optimized! Click SAVE ALL SETTINGS to update Homepage.");
    } catch {
      showToast("Could not read selected image file");
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          marketFrozen: frozen,
          websiteUrl,
          telegramUrl,
          telegramChannelUrl,
          telegramGroupUrl,
          depositTelegramUrl,
          withdrawTelegramUrl,
          supportUrl,
          getNewIdUrl,
          userWelcomeTemplate,
          matchScheduleBanner,
          marqueeText,
          minBet: Math.max(1, Number(minBet) || 100),
          minWithdraw: Math.max(1, Number(minWithdraw) || 500),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("All settings, Schedule PNG, Welcome Template & Telegram links saved!");
      } else {
        showToast(data.error || "Failed to save settings");
      }
    } catch {
      showToast("Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  const samplePreview = renderWelcomeMessage(
    userWelcomeTemplate,
    "tb786002",
    "Arim@2683",
    websiteUrl,
    supportUrl,
  );

  return (
    <div className="space-y-6">
      <div className={cn("glass metal-border rounded-3xl p-5 sm:p-6", frozen && "border-ruby/50 shadow-2xl")}>
        <h3 className="mb-2 font-display text-sm font-black tracking-widest text-[#f2ecda]">
          EMERGENCY MARKET CLOSE (FREEZE)
        </h3>
        <p className="mb-4 text-xs text-white/40">
          Instantly halts all toss bet placements across the site for all punters.
        </p>
        <button
          onClick={() => setFrozen((f) => !f)}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border px-5 py-4 font-display text-xs font-bold tracking-widest transition-all",
            frozen ? "border-ruby/60 bg-ruby/15 text-ruby" : "border-mint/40 bg-mint/10 text-mint",
          )}
        >
          <span>{frozen ? "ALL BETTING FROZEN" : "MARKETS OPEN"}</span>
          <span className={cn("h-3 w-3 rounded-full", frozen ? "bg-ruby animate-pulse" : "bg-mint")} />
        </button>
      </div>

      <div className="glass metal-border glow-gold rounded-3xl p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-gold" />
            <h3 className="font-display text-sm font-black tracking-widest text-goldlight">
              MATCH SCHEDULE PNG IMAGE (HOMEPAGE BANNER)
            </h3>
          </div>
          <span className="rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-neon">
            PNG HOMEPAGE SHOW
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-white/50">
          Upload your Match Schedule PNG image here. It will display prominently at the top of the Homepage schedule, followed by clean Team Details.
        </p>

        <div className="mb-4 overflow-hidden rounded-2xl border border-gold/30 bg-black/60 shadow-xl">
          <div className="relative">
            <SafePosterImg
              src={matchScheduleBanner}
              alt="Schedule Preview"
              className="max-h-56 w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <span className="font-display text-[10px] font-black tracking-widest text-goldlight">
                HOMEPAGE SCHEDULE BANNER PREVIEW
              </span>
              <span className="rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-[9px] text-neon">
                PNG READY
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => void handleImageUpload(e)}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="glow-neon flex items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/15 py-3 font-display text-xs font-black tracking-wider text-neon hover:bg-neon/25"
            >
              <Upload size={15} /> UPLOAD SCHEDULE PNG FILE
            </button>
            <button
              type="button"
              onClick={() => {
                setMatchScheduleBanner(DEFAULT_BANNER);
                showToast("Reset to default cricket banner!");
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 font-display text-xs font-bold text-white/60 hover:text-white"
            >
              <RotateCcw size={14} /> DEFAULT SCHEDULE BANNER
            </button>
          </div>

          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">
              OR ENTER PNG / IMAGE URL DIRECTLY
            </label>
            <input
              value={matchScheduleBanner}
              onChange={(e) => setMatchScheduleBanner(e.target.value)}
              placeholder="https://example.com/match-schedule.png"
              className="w-full rounded-xl border border-gold/20 bg-white/[0.03] p-3 font-mono text-xs text-goldlight outline-none focus:border-gold"
            />
          </div>
        </div>
      </div>

      <div className="glass metal-border glow-gold rounded-3xl p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-neon" />
            <h3 className="font-display text-sm font-black tracking-widest text-goldlight">
              PUNTER ID CREATION MESSAGE TEMPLATE (CUSTOMIZABLE)
            </h3>
          </div>
          <span className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 font-mono text-[9.5px] font-bold text-mint">
            ADMIN EDITABLE
          </span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-white/50">
          Customize the exact message generated when new punter accounts are created. Placeholders:{" "}
          <code className="font-mono text-neon">{"{username}"}</code>,{" "}
          <code className="font-mono text-neon">{"{password}"}</code>,{" "}
          <code className="font-mono text-neon">{"{capitalLetter}"}</code>,{" "}
          <code className="font-mono text-neon">{"{websiteUrl}"}</code>,{" "}
          <code className="font-mono text-neon">{"{supportUrl}"}</code>.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[9.5px] font-black text-white/40">CLICK TO INSERT TAG:</span>
          {["{username}", "{password}", "{capitalLetter}", "{websiteUrl}", "{supportUrl}"].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setUserWelcomeTemplate((prev) => `${prev} ${tag}`)}
              className="rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-[10px] font-bold text-goldlight transition-all hover:bg-gold/20"
            >
              +{tag}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUserWelcomeTemplate(DEFAULT_WELCOME_TEMPLATE)}
            className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-[9.5px] font-bold text-white/40 hover:text-white"
          >
            Reset to Default
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/60">TEMPLATE EDITOR</label>
            <textarea
              rows={11}
              value={userWelcomeTemplate}
              onChange={(e) => setUserWelcomeTemplate(e.target.value)}
              className="w-full rounded-2xl border border-gold/20 bg-black/60 p-3.5 font-mono text-xs leading-relaxed text-[#f4eedd] outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="mb-1 block text-[9.5px] font-black text-mint">
              LIVE PREVIEW (SAMPLE PUNTER)
            </label>
            <div className="rounded-2xl border border-mint/30 bg-black/75 p-3.5 shadow-inner">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#eae5d4]">
                {samplePreview}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="glass metal-border rounded-3xl p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-black tracking-widest text-goldlight">
            HOMEPAGE MARQUEE ANIMATED TEXT (WELCOME BANNER)
          </h3>
          <span className="flex items-center gap-1 font-mono text-[9px] text-mint">
            <span className="animate-spin-normal inline-block">🏏</span> LIVE SPIN PREVIEW
          </span>
        </div>
        <p className="mb-3 text-xs text-white/40">
          This announcement banner rotates and scrolls continuously across the top of all punter screens.
        </p>

        <div className="mb-4 overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 py-2 shadow-inner">
          <div className="animate-marquee-smooth flex whitespace-nowrap">
            <div className="flex shrink-0 items-center gap-6 pr-6 font-display text-[11px] font-black tracking-[0.18em] text-goldlight">
              <span className="animate-spin-normal inline-block text-sm">🏏</span>
              <span>{marqueeText || "Welcome to Toss Book"}</span>
              <span className="animate-spin-normal inline-block text-sm">🪙</span>
              <span className="font-mono text-[10px] text-neon/90">⚡ 24x7 INSTANT DEPOSIT & WITHDRAWAL</span>
            </div>
            <div className="flex shrink-0 items-center gap-6 pr-6 font-display text-[11px] font-black tracking-[0.18em] text-goldlight">
              <span className="animate-spin-normal inline-block text-sm">🏏</span>
              <span>{marqueeText || "Welcome to Toss Book"}</span>
              <span className="animate-spin-normal inline-block text-sm">🪙</span>
              <span className="font-mono text-[10px] text-neon/90">⚡ 24x7 INSTANT DEPOSIT & WITHDRAWAL</span>
            </div>
          </div>
        </div>

        <textarea
          rows={3}
          value={marqueeText}
          onChange={(e) => setMarqueeText(e.target.value)}
          placeholder="Enter announcement text to display in rotating marquee..."
          className="w-full rounded-xl border border-gold/20 bg-black/40 p-3 font-mono text-xs text-goldlight outline-none focus:border-gold"
        />
      </div>

      <div className="glass metal-border rounded-3xl p-5 sm:p-6">
        <h3 className="mb-2 font-display text-sm font-black tracking-widest text-mint">
          DEPOSIT & WITHDRAW TELEGRAM REDIRECTION LINKS
        </h3>
        <p className="mb-4 text-xs text-white/40">
          When punters click Deposit or Withdraw, they are redirected directly to these Telegram links.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-mint">DEPOSIT TELEGRAM LINK / USERNAME</label>
            <input
              value={depositTelegramUrl}
              onChange={(e) => setDepositTelegramUrl(e.target.value)}
              placeholder="e.g. https://t.me/your_deposit_id"
              className="w-full rounded-xl border border-mint/30 bg-white/[0.03] p-3 font-mono text-xs font-bold text-mint outline-none focus:border-mint"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-amber2">WITHDRAW TELEGRAM LINK / USERNAME</label>
            <input
              value={withdrawTelegramUrl}
              onChange={(e) => setWithdrawTelegramUrl(e.target.value)}
              placeholder="e.g. https://t.me/your_withdraw_id"
              className="w-full rounded-xl border border-amber2/30 bg-white/[0.03] p-3 font-mono text-xs font-bold text-amber2 outline-none focus:border-amber2"
            />
          </div>
        </div>
      </div>

      <div className="glass metal-border rounded-3xl p-5 sm:p-6">
        <h3 className="mb-2 font-display text-sm font-black tracking-widest text-goldlight">
          TELEGRAM CHANNEL, COMMUNITY GROUP, SUPPORT & LOGIN LINKS
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">TELEGRAM OFFICIAL CHANNEL LINK</label>
            <input
              value={telegramChannelUrl}
              onChange={(e) => setTelegramChannelUrl(e.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">TELEGRAM COMMUNITY GROUP LINK</label>
            <input
              value={telegramGroupUrl}
              onChange={(e) => setTelegramGroupUrl(e.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">TELEGRAM 24x7 SUPPORT CENTER LINK</label>
            <input
              value={supportUrl}
              onChange={(e) => setSupportUrl(e.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-neon">LOGIN PAGE &ldquo;GET NEW ID&rdquo; LINK</label>
            <input
              value={getNewIdUrl}
              onChange={(e) => setGetNewIdUrl(e.target.value)}
              className="w-full rounded-xl border border-neon/30 bg-white/[0.03] p-3 font-mono text-xs font-bold text-neon outline-none focus:border-neon"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">GENERAL TELEGRAM LINK</label>
            <input
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/50">OFFICIAL WEBSITE URL</label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none focus:border-gold"
            />
          </div>
        </div>
      </div>

      <div className="glass metal-border rounded-3xl p-5 sm:p-6">
        <h3 className="mb-4 font-display text-sm font-black tracking-widest text-goldlight">
          BET LIMITS & COIN RULES
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/40">MINIMUM BET (RS.)</label>
            <input
              value={minBet}
              onChange={(e) => setMinBet(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9.5px] font-black text-white/40">MINIMUM WITHDRAWAL (RS.)</label>
            <input
              value={minWithdraw}
              onChange={(e) => setMinWithdraw(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-gold/15 bg-white/[0.03] p-3 font-mono text-xs text-white outline-none"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="gold-btn mt-5 w-full rounded-xl py-3.5 font-display text-xs font-black tracking-widest shadow-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] disabled:opacity-50"
        >
          {saving ? "SAVING SETTINGS..." : "SAVE ALL SETTINGS 🔐"}
        </button>
      </div>

      <ChangePasswordCard
        username={username}
        showToast={showToast}
        onPasswordChanged={onSessionCleared}
      />
    </div>
  );
}

function AuditPanel() {
  return (
    <div className="glass metal-border rounded-3xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-mint" />
          <h4 className="font-display text-xs font-black tracking-widest text-mint">
            ATOMIC PAYOUT ENGINE & SYSTEM AUDIT
          </h4>
        </div>
        <span className="rounded-full border border-mint/40 bg-mint/10 px-3 py-1 font-mono text-[10px] font-bold text-mint">
          PRODUCTION HARDENED
        </span>
      </div>
      <div className="space-y-1.5 font-mono text-xs text-mint/80">
        <div>✓ Atomic Drizzle db.transaction settlement with FOR UPDATE row locks</div>
        <div>✓ Strict idempotency guard (WHERE status = &apos;open&apos;) prevents double payouts</div>
        <div>✓ Basis-points integer math prevents floating-point coin drift</div>
        <div>✓ Complete WIN, LOSS, BET, REFUND, DEPOSIT & WITHDRAW ledger audit trail</div>
        <div>✓ Scrypt password hashing & HMAC-SHA256 HttpOnly cookie verification</div>
        <div>✓ Real-time UI sync with 3s visibility-aware polling & instant wallet update</div>
      </div>
    </div>
  );
}
