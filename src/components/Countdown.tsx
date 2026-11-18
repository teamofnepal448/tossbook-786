import React, { useEffect, useRef, useState } from "react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function useNow(step = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(t);
  }, [step]);
  return now;
}

export function Countdown({
  target,
  onZero,
  className = "",
  compact = false,
}: {
  target: string;
  onZero?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const now = useNow(1000);
  const targetMs = new Date(target).getTime();
  const ms = Number.isFinite(targetMs) ? targetMs - now : 0;
  const fired = useRef(false);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;

  useEffect(() => {
    fired.current = false;
  }, [target]);

  useEffect(() => {
    if (ms <= 0 && !fired.current) {
      fired.current = true;
      onZeroRef.current?.();
    }
  }, [ms]);

  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (compact) {
    return (
      <span className={`tabular ${className}`}>
        {d > 0 ? `${d}d ` : ""}
        {pad2(h)}:{pad2(m)}:{pad2(sec)}
      </span>
    );
  }

  return (
    <span className={`tabular ${className}`}>
      {d > 0 && (
        <>
          <b className="font-semibold">{pad2(d)}</b>
          <span className="opacity-50">d&nbsp;:&nbsp;</span>
        </>
      )}
      <b className="font-semibold">{pad2(h)}</b>
      <span className="opacity-50">h&nbsp;:&nbsp;</span>
      <b className="font-semibold">{pad2(m)}</b>
      <span className="opacity-50">m&nbsp;:&nbsp;</span>
      <b className="font-semibold">{pad2(sec)}</b>
      <span className="opacity-50">s</span>
    </span>
  );
}
