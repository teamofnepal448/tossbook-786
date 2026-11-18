import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Spinner, cn } from "@/src/components/ui";

export function ChangePasswordCard({
  username,
  showToast,
  onPasswordChanged,
}: {
  username: string;
  showToast: (m: string) => void;
  onPasswordChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const minLenOk = newPassword.length >= 6;
  const matchesConfirm = confirmPassword.length > 0 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || "Failed to update password. Please verify your current password.";
        setError(msg);
        showToast(msg);
        setBusy(false);
        return;
      }

      // Clear all sensitive inputs immediately on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setBusy(false);

      showToast(data.message || "Password updated successfully! Please log in with your new password.");
      onPasswordChanged();
    } catch {
      const msg = "Network error while updating password. Please try again.";
      setError(msg);
      showToast(msg);
      setBusy(false);
    }
  }

  return (
    <div className="glass metal-border glow-gold rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 text-neon">
            <KeyRound size={17} />
          </div>
          <div>
            <h3 className="font-display text-sm font-black tracking-widest text-goldlight">
              CHANGE PASSWORD
            </h3>
            <p className="font-mono text-[10px] text-white/45">Account ID: {username}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 font-mono text-[9.5px] font-bold text-mint">
          <ShieldCheck size={11} /> SCRYPT SECURED
        </span>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-white/55">
        Update your login password anytime. Changing your password immediately signs out and invalidates all active sessions for security.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="mb-1 block font-display text-[9.5px] font-black tracking-[0.2em] text-white/55">
            CURRENT PASSWORD
          </label>
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/60" />
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              disabled={busy}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-gold/20 bg-black/40 py-3 pl-10 pr-11 text-xs font-semibold text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-gold/60 disabled:opacity-50 sm:text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowCurrent((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-gold disabled:opacity-40"
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
            >
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-display text-[9.5px] font-black tracking-[0.2em] text-white/55">
              NEW PASSWORD
            </label>
            <span
              className={cn(
                "font-mono text-[9.5px] font-bold",
                newPassword.length === 0 ? "text-white/35" : minLenOk ? "text-mint" : "text-amber2",
              )}
            >
              {newPassword.length === 0 ? "Min 6 characters" : minLenOk ? "Length OK" : `${6 - newPassword.length} more chars`}
            </span>
          </div>
          <div className="relative">
            <KeyRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neon/60" />
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              disabled={busy}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (6+ chars)"
              autoComplete="new-password"
              className="w-full rounded-xl border border-gold/20 bg-black/40 py-3 pl-10 pr-11 text-xs font-semibold text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 focus:border-neon/60 disabled:opacity-50 sm:text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-neon disabled:opacity-40"
              aria-label={showNew ? "Hide new password" : "Show new password"}
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-display text-[9.5px] font-black tracking-[0.2em] text-white/55">
              CONFIRM NEW PASSWORD
            </label>
            {matchesConfirm ? (
              <span className="font-mono text-[9.5px] font-bold text-mint">Passwords match</span>
            ) : mismatch ? (
              <span className="font-mono text-[9.5px] font-bold text-ruby">Passwords do not match</span>
            ) : null}
          </div>
          <div className="relative">
            <KeyRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neon/60" />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              disabled={busy}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              className={cn(
                "w-full rounded-xl border bg-black/40 py-3 pl-10 pr-11 text-xs font-semibold text-[#f5f0dd] outline-none transition-all placeholder:text-white/25 disabled:opacity-50 sm:text-sm",
                mismatch ? "border-ruby/60 focus:border-ruby" : matchesConfirm ? "border-mint/50 focus:border-mint" : "border-gold/20 focus:border-neon/60",
              )}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-neon disabled:opacity-40"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-ruby/40 bg-ruby/10 px-3.5 py-2.5 text-center text-xs font-semibold text-ruby">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
          className="gold-btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-xs font-black tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <Spinner size={15} className="text-black" /> : <KeyRound size={15} />}
          {busy ? "UPDATING PASSWORD..." : "UPDATE PASSWORD"}
        </button>
      </form>
    </div>
  );
}
