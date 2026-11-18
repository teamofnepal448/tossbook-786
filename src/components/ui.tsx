import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80";

export function SafePosterImg({
  src,
  alt,
  className,
  fallback = FALLBACK_POSTER,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: string;
  priority?: boolean;
}) {
  const [imgSrc, setImgSrc] = useState(src || fallback);

  useEffect(() => {
    setImgSrc(src || fallback);
  }, [src, fallback]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        if (imgSrc !== fallback) setImgSrc(fallback);
      }}
      className={className}
    />
  );
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const AVATAR_PALETTES: [string, string][] = [
  ["#d4af37", "#7a5c14"],
  ["#0ea5b7", "#0c4a57"],
  ["#e0486a", "#6e1228"],
  ["#8b5cf6", "#3b1d78"],
  ["#2fe6a7", "#0a5c40"],
  ["#f39c12", "#7c4a03"],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function TeamAvatar({
  name,
  size = 44,
}: {
  name: string;
  size?: number;
}) {
  const [a, b] = AVATAR_PALETTES[hashName(name) % AVATAR_PALETTES.length];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white/95"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        background: `radial-gradient(circle at 32% 26%, ${a}, ${b} 78%)`,
        border: "1px solid rgba(212,175,55,0.35)",
        boxShadow: `0 4px 18px ${a}44, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}
    >
      {initials(name)}
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  sub,
  tone = "gold",
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  tone?: "gold" | "neon";
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl border",
          tone === "gold"
            ? "border-gold/30 bg-gold/10 text-gold"
            : "border-neon/30 bg-neon/10 text-neon",
        )}
      >
        <Icon size={17} strokeWidth={2.2} />
      </div>
      <div>
        <h2 className="font-display text-[13px] font-bold tracking-[0.22em] text-[#f2ecd9]">
          {title}
        </h2>
        {sub && (
          <p className="text-[11px] font-medium tracking-wide text-white/40">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="glass metal-border flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-gold/5 text-gold/70">
        <Icon size={20} />
      </div>
      <p className="font-display text-sm font-bold tracking-[0.18em] text-white/70">
        {title}
      </p>
      {hint && <p className="max-w-xs text-xs text-white/35">{hint}</p>}
    </div>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
