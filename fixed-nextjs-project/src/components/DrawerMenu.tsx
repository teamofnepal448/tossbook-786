"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Headset,
  LayoutGrid,
  LogOut,
  ReceiptText,
  Scale,
  ScrollText,
  Wallet,
  Activity,
  X,
  Download,
} from "lucide-react";
import type { MeDTO } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { cn } from "@/components/ui";
import { formatCoins } from "@/lib/format";

export type DrawerView =
  | "lobby"
  | "bets"
  | "statement"
  | "rules"
  | "schedules"
  | "support"
  | "withdraw"
  | "deposit";

const ITEMS: { key: DrawerView; label: string; icon: typeof LayoutGrid }[] = [
  { key: "lobby", label: "LOBBY", icon: LayoutGrid },
  { key: "bets", label: "PENDING BETS", icon: ReceiptText },
  { key: "statement", label: "STATEMENT", icon: ScrollText },
  { key: "rules", label: "RULES", icon: Scale },
  { key: "schedules", label: "SCHEDULES", icon: CalendarClock },
  { key: "support", label: "CUSTOMER SUPPORT", icon: Headset },
  { key: "withdraw", label: "WITHDRAW", icon: ArrowUpFromLine },
  { key: "deposit", label: "DEPOSIT", icon: ArrowDownToLine },
];

export function DrawerMenu({
  open,
  me,
  view,
  onClose,
  onNavigate,
  onLogout,
}: {
  open: boolean;
  me: MeDTO | null;
  view: DrawerView;
  onClose: () => void;
  onNavigate: (v: DrawerView) => void;
  onLogout: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: "-104%" }}
            animate={{ x: 0 }}
            exit={{ x: "-104%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="glass-deep fixed inset-y-0 left-0 z-[95] flex w-[19.5rem] max-w-[86vw] flex-col border-r border-gold/20"
          >
            {/* head */}
            <div className="metal-border relative overflow-hidden p-5 pb-6">
              <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
              <div className="mb-4 flex items-start justify-between">
                <Logo size={56} />
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 transition-colors hover:border-gold/40 hover:text-gold"
                  aria-label="Close menu"
                >
                  <X size={15} />
                </button>
              </div>
              <p className="font-display text-[15px] font-black tracking-[0.14em] text-goldlight">
                {me?.username ?? ""}
              </p>
              <p className="mt-0.5 text-[10px] font-bold tracking-[0.26em] text-white/30">
                PREMIUM PUNTER
              </p>

              {me && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2">
                    <p className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.18em] text-gold/70">
                      <Wallet size={10} /> BALANCE
                    </p>
                    <p className="tabular mt-0.5 font-mono text-[13px] font-bold text-goldlight">
                      {formatCoins(me.balance)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neon/20 bg-neon/[0.05] px-3 py-2">
                    <p className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.18em] text-neon/70">
                      <Activity size={10} /> EXPOSURE
                    </p>
                    <p className="tabular mt-0.5 font-mono text-[13px] font-bold text-neon">
                      {formatCoins(me.exposure)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* items */}
            <nav className="no-scrollbar flex-1 overflow-y-auto p-3">
              {ITEMS.map(({ key, label, icon: Icon }, i) => {
                const active = view === key;
                return (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.035 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onNavigate(key);
                      onClose();
                    }}
                    className={cn(
                      "group mb-1 flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all duration-200",
                      active
                        ? "border border-gold/35 bg-gold/[0.1] shadow-[0_0_20px_rgba(212,175,55,0.12)]"
                        : "border border-transparent hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon
                      size={17}
                      className={cn(
                        "transition-colors",
                        active ? "text-gold" : "text-white/40 group-hover:text-gold/80",
                      )}
                    />
                    <span
                      className={cn(
                        "font-display text-[11px] font-bold tracking-[0.2em]",
                        active ? "text-goldlight" : "text-white/65 group-hover:text-white/90",
                      )}
                    >
                      {label}
                    </span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.9)]" />
                    )}
                  </motion.button>
                );
              })}

              <a
                href="/api/download-zip"
                download="tossbook786-fixed.zip"
                className="group mt-3 flex w-full items-center gap-3.5 rounded-xl border border-neon/40 bg-neon/[0.08] px-4 py-3 text-left font-display text-[10.5px] font-bold tracking-[0.2em] text-neon transition-all hover:bg-neon/[0.15]"
              >
                <Download size={16} />
                <span>DOWNLOAD PROJECT (.ZIP)</span>
              </a>
            </nav>

            {/* sign out */}
            <div className="border-t border-gold/12 p-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onLogout}
                className="flex w-full items-center gap-3.5 rounded-xl border border-ruby/25 bg-ruby/[0.06] px-4 py-3 transition-all hover:bg-ruby/[0.12]"
              >
                <LogOut size={17} className="text-ruby" />
                <span className="font-display text-[11px] font-bold tracking-[0.2em] text-ruby">
                  SIGN OUT
                </span>
              </motion.button>
              <p className="mt-3 text-center text-[8.5px] font-bold tracking-[0.3em] text-white/20">
                TOSS BOOK 786 - ROYAL EDITION
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
