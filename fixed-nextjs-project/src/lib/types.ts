export type MatchStatus =
  | "scheduled"
  | "live"
  | "locked"
  | "finished"
  | "cancelled";

export type MatchDTO = {
  id: number;
  league: string;
  teamA: string;
  teamB: string;
  startTime: string;
  tossCloseTime: string;
  oddsA: number;
  oddsB: number;
  status: MatchStatus;
  winner: string | null;
  settledAt: string | null;
  createdAt: string;
};

export type AdminMatchDTO = MatchDTO & {
  totalStaked: number;
  betCount: number;
  pendingStaked: number;
};

export type MeDTO = {
  id: number;
  username: string;
  role: "admin" | "punter";
  phone: string | null;
  balance: number;
  banned: boolean;
  exposure: number;
};

export type PublicSettingsDTO = {
  marketFrozen: boolean;
  websiteUrl: string;
  telegramUrl: string;
  supportUrl: string;
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
  status: "pending" | "won" | "lost" | "refunded";
  winner: string | null;
  matchStatus: MatchStatus;
  createdAt: string;
  settledAt: string | null;
};

export type TxDTO = {
  id: number;
  amount: number;
  balanceAfter: number;
  type: "admin_credit" | "admin_debit" | "bet" | "win" | "refund";
  note: string | null;
  createdAt: string;
};

export type AdminUserDTO = {
  id: number;
  username: string;
  phone: string | null;
  balance: number;
  banned: boolean;
  createdAt: string;
  exposure: number;
  pendingBets: number;
};

export type MatchesPayload = {
  live: MatchDTO[];
  scheduled: MatchDTO[];
  finishedToday: MatchDTO[];
  settings: PublicSettingsDTO;
  serverNow: string;
};

export type AdminStatsDTO = {
  totalPunters: number;
  coinsInCirculation: number;
  bannedPunters: number;
  pendingBets: number;
  pendingStakes: number;
  liveMatches: number;
  scheduledMatches: number;
  lockedMatches: number;
};
