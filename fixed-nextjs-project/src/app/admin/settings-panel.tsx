"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  LifeBuoy,
  OctagonAlert,
  Save,
  Send,
  Snowflake,
  Zap,
} from "lucide-react";
import type { PublicSettingsDTO } from "@/lib/types";
import { Spinner, cn } from "@/components/ui";

export default function SettingsPanel({
  showToast,
}: {
  showToast: (m: string) => void;
}) {
  const [settings, setSettings] = useState<PublicSettingsDTO | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: PublicSettingsDTO | null) => {
        if (s) {
          setSettings(s);
          setWebsiteUrl(s.websiteUrl);
          setTelegramUrl(s.telegramUrl);
          setSupportUrl(s.supportUrl);
        }
      })
      .catch(() => {});
  }, []);

  async function toggleFreeze() {
    if (!settings || freezeBusy) return;
    setFreezeBusy(true);
    const next = !settings.marketFrozen;
    setSettings({ ...settings, marketFrozen: next }); // optimistic
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ marketFrozen: next }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setSettings(data.settings);
        showToast(
          next
            ? "EMERGENCY MARKET CLOSE ACTIVATED - all betting frozen"
            : "Markets reopened - punters can bet again",
        );
      } else {
        setSettings((s) => (s ? { ...s, marketFrozen: !next } : s));
        showToast(data.error || "Failed");
      }
    } catch {
      setSettings((s) => (s ? { ...s, marketFrozen: !next } : s));
      showToast("Network error");
    } finally {
      setFreezeBusy(false);
    }
  }

  async function save() {
    if (saveBusy) return;
    setSaveBusy(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ websiteUrl, telegramUrl, supportUrl }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setSettings(data.settings);
        showToast("Settings saved");
      } else {
        showToast(data.error || "Save failed");
      }
    } catch {
      showToast("Network error");
    } finally {
      setSaveBusy(false);
    }
  }

  const frozen = settings?.marketFrozen ?? false;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* emergency freeze */}
      <div
        className={cn(
          "glass metal-border relative overflow-hidden rounded-3xl p-6 transition-shadow duration-500",
          frozen && "shadow-[0_0_60px_rgba(255,51,85,0.18)]",
        )}
      >
        {frozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.12, 0.28, 0.12] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="pointer-events-none absolute inset-0 bg-ruby/20"
          />
        )}

        <div className="relative">
          <div className="mb-4 flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border",
                frozen
                  ? "border-ruby/50 bg-ruby/15 text-ruby shadow-[0_0_26px_rgba(255,51,85,0.35)]"
                  : "border-gold/30 bg-gold/10 text-gold",
              )}
            >
              {frozen ? <Snowflake size={19} /> : <Zap size={19} />}
            </span>
            <div>
              <h3 className="font-display text-[13px] font-black tracking-[0.22em] text-[#f2ecda]">
                EMERGENCY MARKET CLOSE
              </h3>
              <p className="text-[10px] text-white/35">
                One tap freezes every betting market across the site instantly.
              </p>
            </div>
          </div>

          <button
            onClick={toggleFreeze}
            disabled={!settings || freezeBusy}
            className={cn(
              "relative flex w-full items-center justify-between rounded-2xl border px-5 py-4 transition-all duration-300 disabled:opacity-50",
              frozen
                ? "border-ruby/60 bg-ruby/[0.12]"
                : "border-mint/40 bg-mint/[0.06]",
            )}
          >
            <span className="flex items-center gap-3">
              {freezeBusy ? (
                <Spinner size={16} className={frozen ? "text-ruby" : "text-mint"} />
              ) : (
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    frozen
                      ? "animate-pulse bg-ruby shadow-[0_0_12px_rgba(255,51,85,0.9)]"
                      : "bg-mint shadow-[0_0_12px_rgba(47,230,167,0.9)]",
                  )}
                />
              )}
              <span
                className={cn(
                  "font-display text-[11.5px] font-black tracking-[0.2em]",
                  frozen ? "text-ruby" : "text-mint",
                )}
              >
                {frozen ? "ALL BETTING FROZEN" : "MARKETS OPEN"}
              </span>
            </span>

            {/* switch */}
            <span
              className={cn(
                "relative h-7 w-12 rounded-full border transition-colors duration-300",
                frozen ? "border-ruby/60 bg-ruby/25" : "border-mint/40 bg-black/40",
              )}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={cn(
                  "absolute top-0.5 h-[22px] w-[22px] rounded-full",
                  frozen
                    ? "right-0.5 bg-ruby shadow-[0_0_14px_rgba(255,51,85,0.8)]"
                    : "left-0.5 bg-mint shadow-[0_0_14px_rgba(47,230,167,0.8)]",
                )}
              />
            </span>
          </button>

          {frozen && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 rounded-lg border border-ruby/40 bg-ruby/[0.1] px-3.5 py-2.5 text-[10px] font-bold tracking-[0.16em] text-ruby"
            >
              <OctagonAlert size={13} />
              PUNTERS SEE A FROZEN BANNER - ALL BET SLIPS ARE REJECTED
            </motion.p>
          )}
        </div>
      </div>

      {/* links */}
      <div className="glass metal-border rounded-3xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Globe size={19} />
          </span>
          <div>
            <h3 className="font-display text-[13px] font-black tracking-[0.22em] text-[#f2ecda]">
              PLATFORM LINKS
            </h3>
            <p className="text-[10px] text-white/35">
              Used inside the Telegram welcome message copy.
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          <LinkField
            icon={Globe}
            label="OFFICIAL WEBSITE URL"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="https://tossbook786.com"
          />
          <LinkField
            icon={Send}
            label="TELEGRAM GROUP URL"
            value={telegramUrl}
            onChange={setTelegramUrl}
            placeholder="https://t.me/+FNrv5zNv6lI0ODk1"
          />
          <LinkField
            icon={LifeBuoy}
            label="SUPPORT TELEGRAM URL"
            value={supportUrl}
            onChange={setSupportUrl}
            placeholder="https://t.me/+FNrv5zNv6lI0ODk1"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={saveBusy || !settings}
          className="gold-btn mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[11.5px] font-black tracking-[0.26em]"
        >
          {saveBusy ? <Spinner size={15} /> : <Save size={15} />}
          {saveBusy ? "SAVING..." : "SAVE SETTINGS"}
        </motion.button>
      </div>
    </div>
  );
}

function LinkField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-black tracking-[0.24em] text-white/35">{label}</p>
      <label className="relative block">
        <Icon
          size={14}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold/50"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="w-full rounded-xl border border-gold/15 bg-white/[0.03] py-3 pl-11 pr-4 font-mono text-[12px] font-semibold text-[#f5f0dd] outline-none placeholder:text-white/20 focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.1)]"
        />
      </label>
    </div>
  );
}
