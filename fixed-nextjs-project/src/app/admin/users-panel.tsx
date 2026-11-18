"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  Check,
  Copy,
  Coins,
  Minus,
  NotebookPen,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import type { AdminUserDTO } from "@/lib/types";
import { EmptyState, Spinner, cn } from "@/components/ui";
import { formatCoins, formatDateTime } from "@/lib/format";

type Props = {
  links: { websiteUrl: string; telegramUrl: string };
  onChanged: () => void;
  showToast: (msg: string) => void;
};

function buildTelegramMessage(
  websiteUrl: string,
  telegramUrl: string,
  username: string,
  password: string,
): string {
  return [
    "\u{1F3CF}WELCOME TO TOSSBOOK786\u{1F3CF}",
    "",
    "\u{1F310} *OFFICIAL WEBSITE*",
    websiteUrl,
    "",
    `*User*\u{1F464} :- ${username}`,
    `*Password*\u{1F510}  :- ${password}`,
    "",
    "\u26A0\uFE0F *Password me (A) Capital Letter me rahega*",
    "",
    "\u2705 *Instant Access Available*",
    "",
    "\u{1F4CC} *Please login using your provided details*",
    `Telegram support :- ${telegramUrl}`,
  ].join("\n");
}

async function copyText(t: string, showToast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  showToast("Copied to clipboard");
}

export default function UsersPanel({ links, onChanged, showToast }: Props) {
  const [users, setUsers] = useState<AdminUserDTO[] | null>(null);
  const [search, setSearch] = useState("");
  const [wallet, setWallet] = useState<{ user: AdminUserDTO; mode: "add" | "deduct" } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    const t = setTimeout(() => void load(search), 280);
    return () => clearTimeout(t);
  }, [search, load]);

  function patchUser(id: number, patch: Partial<AdminUserDTO>) {
    setUsers((list) =>
      list ? list.map((u) => (u.id === id ? { ...u, ...patch } : u)) : list,
    );
  }

  async function toggleBan(u: AdminUserDTO) {
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "ban", banned: !u.banned }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      patchUser(u.id, { banned: data.banned });
      showToast(data.banned ? `${u.username} banned` : `${u.username} unbanned`);
      onChanged();
    } else {
      showToast(data.error || "Action failed");
    }
  }

  return (
    <div>
      {/* toolbar */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="group relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/50 transition-colors group-focus-within:text-gold"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or phone..."
            spellCheck={false}
            className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3 pl-11 pr-4 text-[13px] font-semibold tracking-wide text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)]"
          />
        </label>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setCreateOpen(true)}
          className="gold-btn flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-[11px] font-black tracking-[0.2em]"
        >
          <UserPlus size={15} />
          CREATE PUNTER
        </motion.button>
      </div>

      {/* list */}
      {!users ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass metal-border h-20 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="NO PUNTERS FOUND"
          hint="Adjust the search or create a new punter ID."
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className={cn(
                  "glass metal-border rounded-2xl p-4",
                  u.banned && "border-ruby/30",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="min-w-[10rem] flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[13.5px] font-bold text-goldlight">
                        {u.username}
                      </p>
                      {u.banned ? (
                        <span className="rounded-full border border-ruby/45 bg-ruby/10 px-2 py-0.5 text-[8px] font-black tracking-[0.18em] text-ruby">
                          BANNED
                        </span>
                      ) : (
                        <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 text-[8px] font-black tracking-[0.18em] text-mint">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] font-semibold tracking-wide text-white/30">
                      {u.phone ?? "no phone"} - joined {formatDateTime(u.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-5">
                    <Stat label="BALANCE" value={formatCoins(u.balance)} tone="text-goldlight" />
                    <Stat label="EXPOSURE" value={formatCoins(u.exposure)} tone="text-neon" />
                    <Stat label="PENDING" value={String(u.pendingBets)} tone="text-white/60" />
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <ActionBtn
                      label="ADD"
                      tone="mint"
                      onClick={() => setWallet({ user: u, mode: "add" })}
                    >
                      <Plus size={13} />
                    </ActionBtn>
                    <ActionBtn
                      label="DEDUCT"
                      tone="amber"
                      onClick={() => setWallet({ user: u, mode: "deduct" })}
                    >
                      <Minus size={13} />
                    </ActionBtn>
                    <ActionBtn
                      label={u.banned ? "UNBAN" : "BAN"}
                      tone={u.banned ? "mint" : "ruby"}
                      onClick={() => void toggleBan(u)}
                    >
                      {u.banned ? <ShieldCheck size={13} /> : <Ban size={13} />}
                    </ActionBtn>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* wallet modal */}
      <WalletModal
        state={wallet}
        onClose={() => setWallet(null)}
        onDone={(id, balance, mode, amount) => {
          patchUser(id, { balance });
          showToast(
            `${mode === "add" ? "Added" : "Deducted"} ${formatCoins(amount)} coins`,
          );
          onChanged();
          setWallet(null);
        }}
        onError={showToast}
      />

      {/* create modal */}
      <CreateUserModal
        open={createOpen}
        links={links}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void load(search);
          onChanged();
        }}
        showToast={showToast}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-[8px] font-black tracking-[0.2em] text-white/30">{label}</p>
      <p className={cn("tabular mt-0.5 font-mono text-[12.5px] font-bold", tone)}>{value}</p>
    </div>
  );
}

function ActionBtn({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: "mint" | "ruby" | "amber";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tones = {
    mint: "border-mint/35 bg-mint/[0.07] text-mint hover:bg-mint/[0.15]",
    ruby: "border-ruby/35 bg-ruby/[0.07] text-ruby hover:bg-ruby/[0.15]",
    amber: "border-amber2/35 bg-amber2/[0.07] text-amber2 hover:bg-amber2/[0.15]",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[9.5px] font-black tracking-[0.14em] transition-colors",
        tones[tone],
      )}
    >
      {children}
      {label}
    </motion.button>
  );
}

/* ---------------- wallet modal ---------------- */

function WalletModal({
  state,
  onClose,
  onDone,
  onError,
}: {
  state: { user: AdminUserDTO; mode: "add" | "deduct" } | null;
  onClose: () => void;
  onDone: (id: number, balance: number, mode: "add" | "deduct", amount: number) => void;
  onError: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAmount("");
    setNote("");
    setBusy(false);
  }, [state]);

  const amt = Math.floor(Number(amount)) || 0;
  const isAdd = state?.mode === "add";

  async function submit() {
    if (!state || busy) return;
    if (amt <= 0) {
      onError("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${state.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "wallet", mode: state.mode, amount: amt, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        onError(data.error || "Failed");
        setBusy(false);
        return;
      }
      onDone(state.user.id, data.balance, state.mode, amt);
    } catch {
      onError("Network error");
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-6"
        >
          <motion.div
            initial={{ y: 70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-deep metal-border glow-gold w-full max-w-md rounded-t-[2rem] p-6 sm:rounded-[2rem]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border",
                    isAdd
                      ? "border-mint/40 bg-mint/10 text-mint"
                      : "border-amber2/40 bg-amber2/10 text-amber2",
                  )}
                >
                  <Coins size={15} />
                </span>
                <h3 className="font-display text-[12.5px] font-black tracking-[0.22em] text-goldlight">
                  {isAdd ? "ADD COINS" : "DEDUCT COINS"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:border-gold/40 hover:text-gold"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl border border-gold/15 bg-black/30 px-4 py-3">
              <span className="font-mono text-[13px] font-bold text-goldlight">
                {state.user.username}
              </span>
              <span className="tabular font-mono text-[12px] text-white/50">
                Bal: {formatCoins(state.user.balance)}
              </span>
            </div>

            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
              inputMode="numeric"
              placeholder="Amount in coins"
              className="tabular mb-3 w-full rounded-xl border border-gold/20 bg-white/[0.03] px-4 py-3.5 font-mono text-lg font-bold text-goldlight outline-none placeholder:text-white/20 focus:border-gold/55 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.12)]"
            />

            <div className="mb-3 grid grid-cols-4 gap-2">
              {[500, 1000, 5000, 10000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount((a) => String((Math.floor(Number(a)) || 0) + v))}
                  className="rounded-lg border border-gold/25 bg-gold/[0.06] py-2 font-mono text-[11px] font-bold text-goldlight transition-colors hover:bg-gold/[0.15]"
                >
                  +{formatCoins(v)}
                </button>
              ))}
            </div>

            <label className="relative mb-4 block">
              <NotebookPen
                size={15}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/50"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional) - e.g. Telegram deposit #123"
                className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3 pl-11 pr-4 text-[12px] font-semibold text-[#f5f0dd] outline-none placeholder:text-white/25 focus:border-gold/50"
              />
            </label>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={busy || amt <= 0}
              onClick={submit}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[12px] font-black tracking-[0.24em] transition-all",
                isAdd
                  ? "border border-mint/50 bg-mint/[0.12] text-mint hover:bg-mint/[0.2] hover:shadow-[0_0_26px_rgba(47,230,167,0.25)]"
                  : "border border-amber2/50 bg-amber2/[0.12] text-amber2 hover:bg-amber2/[0.2] hover:shadow-[0_0_26px_rgba(243,156,18,0.25)]",
                (busy || amt <= 0) && "opacity-40",
              )}
            >
              {busy ? <Spinner size={15} /> : isAdd ? <Plus size={15} /> : <Minus size={15} />}
              {busy ? "PROCESSING..." : isAdd ? `ADD ${amt > 0 ? formatCoins(amt) : ""} COINS` : `DEDUCT ${amt > 0 ? formatCoins(amt) : ""} COINS`}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- create user modal ---------------- */

function CreateUserModal({
  open,
  links,
  onClose,
  onCreated,
  showToast,
}: {
  open: boolean;
  links: { websiteUrl: string; telegramUrl: string };
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setPhone("");
      setGenerated(false);
      setError("");
      setBusy(false);
      setCreated(null);
    }
  }, [open]);

  async function autoGenerate() {
    if (genBusy) return;
    setGenBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/users/generate", { cache: "no-store", credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setUsername(data.username);
        setPassword(data.password);
        setGenerated(true);
        showToast("Unique credentials generated - DB verified");
      } else {
        setError(data.error || "Could not generate");
      }
    } catch {
      setError("Network error");
    } finally {
      setGenBusy(false);
    }
  }

  async function submit() {
    if (busy) return;
    setError("");
    if (username.trim().length < 4) {
      setError("Username must be at least 4 characters");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password, phone }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          data.error === "USERNAME_TAKEN"
            ? "Username already taken - auto-generate a fresh one"
            : data.error || "Failed to create",
        );
        setBusy(false);
        return;
      }
      setCreated({ username: username.trim(), password });
      onCreated();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  const tgMessage = created
    ? buildTelegramMessage(links.websiteUrl, links.telegramUrl, created.username, created.password)
    : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-6"
        >
          <motion.div
            initial={{ y: 70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-deep metal-border glow-gold max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
                  <UserPlus size={15} />
                </span>
                <h3 className="font-display text-[12.5px] font-black tracking-[0.22em] text-goldlight">
                  {created ? "PUNTER CREATED" : "CREATE PUNTER ID"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:border-gold/40 hover:text-gold"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {!created ? (
              <>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={autoGenerate}
                  disabled={genBusy}
                  className="glow-neon mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neon/50 bg-neon/[0.07] py-3 font-display text-[11px] font-black tracking-[0.22em] text-neon transition-all hover:bg-neon/[0.15]"
                >
                  {genBusy ? <Spinner size={14} /> : <Wand2 size={14} />}
                  AUTO-GENERATE CREDENTIALS
                </motion.button>

                <div className="space-y-3">
                  <FieldBlock label="USERNAME">
                    <div className="relative">
                      <input
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setGenerated(false);
                        }}
                        placeholder="e.g. devil9751"
                        spellCheck={false}
                        className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3 pl-4 pr-11 font-mono text-[13px] font-bold tracking-wide text-goldlight outline-none placeholder:text-white/20 focus:border-gold/50"
                      />
                      {generated && (
                        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[9px] font-black tracking-[0.14em] text-mint">
                          <Sparkles size={11} /> FREE
                        </span>
                      )}
                    </div>
                  </FieldBlock>

                  <FieldBlock label="PASSWORD">
                    <input
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setGenerated(false);
                      }}
                      placeholder="e.g. Abcd@1122"
                      spellCheck={false}
                      className="w-full rounded-xl border border-gold/15 bg-white/[0.03] px-4 py-3 font-mono text-[13px] font-bold tracking-wide text-goldlight outline-none placeholder:text-white/20 focus:border-gold/50"
                    />
                    <p className="mt-1.5 text-[9.5px] font-semibold tracking-wide text-white/30">
                      Keep one Capital letter first - shows clearly in Telegram format.
                    </p>
                  </FieldBlock>

                  <FieldBlock label="PHONE (OPTIONAL)">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))}
                      placeholder="e.g. 919999999999"
                      className="w-full rounded-xl border border-gold/15 bg-white/[0.03] px-4 py-3 font-mono text-[13px] font-bold tracking-wide text-goldlight outline-none placeholder:text-white/20 focus:border-gold/50"
                    />
                  </FieldBlock>
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
                  className="gold-btn mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[12px] font-black tracking-[0.26em]"
                >
                  {busy ? <Spinner size={15} /> : <Check size={15} />}
                  {busy ? "CREATING..." : "CREATE PUNTER"}
                </motion.button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-mint/35 bg-mint/[0.07] px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint/15 text-mint">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <p className="text-[11.5px] font-bold tracking-wide text-mint">
                    ID activated - share credentials on Telegram
                  </p>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2.5">
                  <CredTile label="USERNAME" value={created.username} onCopy={() => copyText(created.username, showToast)} />
                  <CredTile label="PASSWORD" value={created.password} onCopy={() => copyText(created.password, showToast)} />
                </div>

                <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-black tracking-[0.22em] text-white/35">
                  <Send size={11} className="text-neon/70" />
                  TELEGRAM MESSAGE PREVIEW
                </p>
                <pre className="no-scrollbar mb-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-white/70">
                  {tgMessage}
                </pre>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => copyText(tgMessage, showToast)}
                  className="glow-neon mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-neon/55 bg-neon/[0.08] py-3.5 font-display text-[11.5px] font-black tracking-[0.22em] text-neon transition-all hover:bg-neon/[0.16]"
                >
                  <Copy size={15} />
                  COPY TELEGRAM MESSAGE
                </motion.button>

                <div className="grid grid-cols-2 gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setCreated(null);
                      setUsername("");
                      setPassword("");
                      setPhone("");
                      setGenerated(false);
                    }}
                    className="rounded-xl border border-gold/30 bg-gold/[0.06] py-3 font-display text-[10.5px] font-black tracking-[0.2em] text-goldlight transition-colors hover:bg-gold/[0.14]"
                  >
                    CREATE ANOTHER
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    className="gold-btn rounded-xl py-3 font-display text-[10.5px] font-black tracking-[0.2em]"
                  >
                    DONE
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-black tracking-[0.24em] text-white/35">{label}</p>
      {children}
    </div>
  );
}

function CredTile({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-gold/20 bg-gold/[0.05] px-3.5 py-3">
      <p className="text-[8.5px] font-black tracking-[0.22em] text-gold/60">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[13px] font-bold text-goldlight">{value}</span>
        <button
          onClick={onCopy}
          className="text-white/40 transition-colors hover:text-gold"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          <Copy size={13} />
        </button>
      </div>
    </div>
  );
}
