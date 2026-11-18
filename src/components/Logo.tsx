import React, { useState } from "react";

const SOURCES = [
  "/images/logo.png",
  "https://i.postimg.cc/66k2PVD5/file-0000000021188211aa9c3d15218e53b4.png",
  "https://i.ibb.co/L8mD8t0/toss-book-logo.jpg",
];

export function LogoSVG({
  size = 64,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 124"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="TOSS BOOK 786"
    >
      <defs>
        <linearGradient id="tbGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a6a1f" />
          <stop offset="0.32" stopColor="#d4af37" />
          <stop offset="0.52" stopColor="#fff3c4" />
          <stop offset="0.72" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6a1f" />
        </linearGradient>
        <linearGradient id="tbGoldV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dd8a" />
          <stop offset="0.55" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6a1f" />
        </linearGradient>
        <radialGradient id="tbGlow" cx="0.5" cy="0.42" r="0.7">
          <stop offset="0" stopColor="#d4af37" stopOpacity="0.28" />
          <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="58" r="52" fill="url(#tbGlow)" />
      <path
        d="M36 30 L43 12 L52 25 L60 7 L68 25 L77 12 L84 30 Q60 24 36 30 Z"
        fill="url(#tbGold)"
      />
      <circle cx="43" cy="10" r="2.4" fill="url(#tbGoldV)" />
      <circle cx="60" cy="5" r="2.8" fill="url(#tbGoldV)" />
      <circle cx="77" cy="10" r="2.4" fill="url(#tbGoldV)" />
      <path
        d="M20 96 C33 92 30 72 43 66 C36 78 40 88 30 98 C26 102 18 102 20 96 Z"
        fill="url(#tbGold)"
        opacity="0.9"
      />
      <path
        d="M100 96 C87 92 90 72 77 66 C84 78 80 88 90 98 C94 102 102 102 100 96 Z"
        fill="url(#tbGold)"
        opacity="0.9"
      />
      <path
        d="M60 33 C71 38.5 82.5 40.5 93 40.5 C93 72.5 84.5 96.5 60 111 C35.5 96.5 27 72.5 27 40.5 C37.5 40.5 49 38.5 60 33 Z"
        fill="#10141d"
        stroke="url(#tbGold)"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <text
        x="60"
        y="77"
        textAnchor="middle"
        fontSize="30"
        fontWeight="800"
        fill="url(#tbGoldV)"
        style={{
          fontFamily: "'Cinzel', 'Times New Roman', serif",
          letterSpacing: "1.5px",
        }}
      >
        786
      </text>
      <rect x="38" y="84" width="44" height="1.2" fill="url(#tbGold)" opacity="0.8" />
      <text
        x="60"
        y="95"
        textAnchor="middle"
        fontSize="7.4"
        fontWeight="700"
        fill="#d4af37"
        style={{
          fontFamily: "'Cinzel', serif",
          letterSpacing: "3.4px",
        }}
      >
        TOSS BOOK
      </text>
    </svg>
  );
}

export function Logo({
  size = 64,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [stage, setStage] = useState(0);

  if (stage >= SOURCES.length) {
    return <LogoSVG size={size} className={className} />;
  }

  return (
    <img
      src={SOURCES[stage]}
      alt="TOSS BOOK 786"
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      draggable={false}
      onError={() => setStage((s) => s + 1)}
      className={`select-none rounded-2xl object-contain drop-shadow-[0_4px_20px_rgba(212,175,55,0.35)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
