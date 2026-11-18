import { db } from "@/db";
import { settings, type MatchRow } from "@/db/schema";

export const DEFAULT_TELEGRAM = "https://t.me/+FNrv5zNv6lI0ODk1";
export const DEFAULT_WEBSITE = "https://tossbook786.com";

export const LEAGUES = [
  "IPL 2026",
  "MEN'S T20",
  "WCL T20",
  "BBL 2025-26",
  "PSL 2026",
  "WOMEN'S T20",
  "THE HUNDRED",
  "CPL 2026",
  "BIG BASH W",
  "ASIA CUP",
];

export type EffectiveStatus =
  | "scheduled"
  | "live"
  | "locked"
  | "finished"
  | "cancelled";

export function effectiveStatus(
  m: Pick<MatchRow, "status" | "startTime" | "tossCloseTime">,
  now: number = Date.now(),
): EffectiveStatus {
  if (m.status === "finished") return "finished";
  if (m.status === "cancelled") return "cancelled";
  const close = new Date(m.tossCloseTime).getTime();
  const start = new Date(m.startTime).getTime();
  if (now >= close) return "locked";
  if (now >= start) return "live";
  return "scheduled";
}

export function toMatchDTO(m: MatchRow, now: number = Date.now()) {
  return {
    id: m.id,
    league: m.league,
    teamA: m.teamA,
    teamB: m.teamB,
    startTime: new Date(m.startTime).toISOString(),
    tossCloseTime: new Date(m.tossCloseTime).toISOString(),
    oddsA: Number(m.oddsA),
    oddsB: Number(m.oddsB),
    status: effectiveStatus(m, now),
    winner: m.winner,
    settledAt: m.settledAt ? new Date(m.settledAt).toISOString() : null,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

export type PublicSettings = {
  marketFrozen: boolean;
  websiteUrl: string;
  telegramUrl: string;
  supportUrl: string;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  try {
    const rows = await db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      marketFrozen: map.get("marketFrozen") === "true",
      websiteUrl: map.get("websiteUrl") || DEFAULT_WEBSITE,
      telegramUrl: map.get("telegramUrl") || DEFAULT_TELEGRAM,
      supportUrl: map.get("supportUrl") || DEFAULT_TELEGRAM,
    };
  } catch {
    return {
      marketFrozen: false,
      websiteUrl: DEFAULT_WEBSITE,
      telegramUrl: DEFAULT_TELEGRAM,
      supportUrl: DEFAULT_TELEGRAM,
    };
  }
}

/* ---------------- credential generators ---------------- */

const USER_PATTERNS = [
  () => `devil${randDigits(4)}`,
  () => `tossbook786_${randDigits(2)}`,
  () => `tb786${randDigits(3)}`,
  () => `royal${randDigits(4)}`,
  () => `gold786_${randDigits(3)}`,
];

function randDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateUsernameCandidate(): string {
  const pick = USER_PATTERNS[Math.floor(Math.random() * USER_PATTERNS.length)];
  return pick();
}

/** Pattern: Capital + 3 lowercase + '@' + 4 digits (e.g. Abcd@1122) */
export function generatePassword(): string {
  const cap = UPPER[Math.floor(Math.random() * UPPER.length)];
  let low = "";
  for (let i = 0; i < 3; i++)
    low += LOWER[Math.floor(Math.random() * LOWER.length)];
  return `${cap}${low}@${randDigits(4)}`;
}

export function buildTelegramMessage(
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
