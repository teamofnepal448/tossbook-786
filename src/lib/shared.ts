export const DEFAULT_BANNER =
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80";

export const DEFAULT_WELCOME_TEMPLATE = `🏏WELCOME TO TOSSBOOK786🏏

🌐 *OFFICIAL WEBSITE*
{websiteUrl}

*User*👤 :- {username}
*Password*🔐  :- {password}

⚠️ *Password me ({capitalLetter}) Capital Letter me rahega*

✅ *Instant Access Available*

📌 *Please login using your provided details*
Telegram support :- {supportUrl}`;

export function formatCoins(n: number): string {
  const safe = Number.isFinite(Number(n)) ? Math.round(Number(n)) : 0;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(safe);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
}

export function formatTelegramUrl(raw?: string): string {
  if (!raw) return "https://t.me/+FNrv5zNv6lI0ODk1";
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  const username = trimmed.replace(/^@/, "");
  return `https://t.me/${username}`;
}

export function renderWelcomeMessage(
  template: string,
  username: string,
  password: string,
  websiteUrl: string = "https://tossbook786.com",
  supportUrl: string = "https://t.me/+FNrv5zNv6lI0ODk1",
): string {
  const cap = password.match(/[A-Z]/)?.[0] || (password ? password.charAt(0).toUpperCase() : "A");
  const t = template || DEFAULT_WELCOME_TEMPLATE;
  return t
    .replace(/\{username\}/g, username)
    .replace(/\{password\}/g, password)
    .replace(/\{capitalLetter\}/g, cap)
    .replace(/\{websiteUrl\}/g, websiteUrl)
    .replace(/\{supportUrl\}/g, supportUrl)
    .replace(/\{telegramUrl\}/g, supportUrl);
}

export type UserMe = {
  id: number;
  username: string;
  role: "admin" | "punter";
  phone: string | null;
  balance: number;
  banned: boolean;
  exposure: number;
};

export type PublicSettings = {
  marketFrozen: boolean;
  websiteUrl: string;
  telegramUrl: string;
  telegramChannelUrl: string;
  telegramGroupUrl: string;
  depositTelegramUrl: string;
  withdrawTelegramUrl: string;
  supportUrl: string;
  getNewIdUrl: string;
  userWelcomeTemplate: string;
  matchScheduleBanner: string;
  marqueeText: string;
  minBet: number;
  minWithdraw: number;
  referralBonus: number;
};

export type MatchItem = {
  id: number;
  league: string;
  teamA: string;
  teamB: string;
  matchImg?: string | null;
  teamAImg?: string | null;
  teamBImg?: string | null;
  startTime: string;
  tossCloseTime: string;
  oddsA: number;
  oddsB: number;
  status: "scheduled" | "live" | "locked" | "finished" | "cancelled";
  winner: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type MatchesPayload = {
  live: MatchItem[];
  scheduled: MatchItem[];
  finishedToday: MatchItem[];
  settings: PublicSettings;
  serverNow: string;
};

export type AdminStats = {
  totalPunters: number;
  coinsInCirculation: number;
  bannedPunters: number;
  pendingBets: number;
  pendingStakes: number;
  liveMatches: number;
  scheduledMatches: number;
  lockedMatches: number;
};

export type AdminUser = {
  id: number;
  username: string;
  phone: string | null;
  balance: number;
  banned: boolean;
  createdAt: string;
  exposure: number;
  pendingBets: number;
  totalBets?: number;
  totalDeposited: number;
  totalWithdrawn: number;
};

export type AdminMatch = MatchItem & {
  totalStaked: number;
  betCount: number;
  pendingStaked: number;
};

export type BetDTO = {
  id: number;
  matchId: number;
  league: string;
  teamA: string;
  teamB: string;
  selection: "A" | "B";
  selectionTeam: string;
  odds: number;
  stake: number;
  potential: number;
  status: "pending" | "won" | "lost" | "refunded" | "cancelled";
  winner: string | null;
  matchStatus: string;
  tossCloseTime?: string;
  canCancel?: boolean;
  createdAt: string;
  settledAt: string | null;
};

export type TxDTO = {
  id: number;
  amount: number;
  balanceAfter: number;
  type: "admin_credit" | "admin_debit" | "bet" | "win" | "loss" | "refund" | "bet_cancelled";
  note: string | null;
  createdAt: string;
};

export type AdminUserDetails = {
  user: AdminUser & {
    totalStaked: number;
    totalWonCredited: number;
    totalBetsCount: number;
    settledBetsCount: number;
    cancelledBetsCount: number;
  };
  bets: BetDTO[];
  transactions: TxDTO[];
};

export type AdminMatchBet = {
  id: number;
  userId: number;
  username: string;
  phone: string | null;
  selection: "A" | "B";
  selectionTeam: string;
  odds: number;
  stake: number;
  potential: number;
  status: "pending" | "won" | "lost" | "refunded" | "cancelled";
  createdAt: string;
  settledAt: string | null;
};

export type AdminMatchBetsPayload = {
  match: MatchItem;
  bets: AdminMatchBet[];
  summary: {
    totalBets: number;
    totalStaked: number;
    pendingStaked: number;
    teamAStaked: number;
    teamBStaked: number;
  };
};

