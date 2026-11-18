import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, transactions, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";
import { effectiveStatus, getPublicSettings } from "@/lib/domain";
import type { BetRow, MatchRow } from "@/db/schema";

export const dynamic = "force-dynamic";

function betDTO(bet: BetRow, match: MatchRow) {
  const chosen = bet.selection === "A" ? match.teamA : match.teamB;
  return {
    id: bet.id,
    matchId: bet.matchId,
    league: match.league,
    teamA: match.teamA,
    teamB: match.teamB,
    selection: bet.selection,
    selectionTeam: chosen,
    odds: Number(bet.odds),
    stake: bet.stake,
    potential: Math.round(bet.stake * Number(bet.odds)),
    status: bet.status,
    winner: match.winner,
    matchStatus: effectiveStatus(match),
    createdAt: new Date(bet.createdAt).toISOString(),
    settledAt: bet.settledAt ? new Date(bet.settledAt).toISOString() : null,
  };
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({ bet: bets, match: matches })
      .from(bets)
      .innerJoin(matches, eq(bets.matchId, matches.id))
      .where(eq(bets.userId, user.id))
      .orderBy(desc(bets.id))
      .limit(100);

    return NextResponse.json(rows.map((r) => betDTO(r.bet, r.match)));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role === "admin") {
      throw new ApiError(403, "Admins cannot place bets");
    }
    if (session.banned) {
      throw new ApiError(
        403,
        "Your account has been suspended. Contact support.",
      );
    }

    const pub = await getPublicSettings();
    if (pub.marketFrozen) {
      throw new ApiError(
        423,
        "Markets are temporarily closed by admin. Please wait.",
      );
    }

    let body: { matchId?: number; selection?: string; stake?: number };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid request JSON");
    }

    const matchId = Number(body.matchId);
    const selection =
      body.selection === "B" ? "B" : body.selection === "A" ? "A" : null;
    const stake = Math.floor(Number(body.stake));

    if (!Number.isInteger(matchId) || matchId <= 0)
      throw new ApiError(400, "Invalid match ID");
    if (!selection) throw new ApiError(400, "Please select Team A or Team B");
    if (!Number.isInteger(stake) || stake < 1)
      throw new ApiError(400, "Enter a valid stake (minimum 1 coin)");
    if (stake > 50_000_000) throw new ApiError(400, "Stake exceeds maximum limit");

    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .for("update");

      if (!match) throw new ApiError(404, "Match not found");

      const st = effectiveStatus(match);
      if (st !== "live") {
        throw new ApiError(
          400,
          st === "locked"
            ? "Betting closed for this contest"
            : st === "scheduled"
              ? "Contest has not opened yet"
              : "Contest is already settled",
        );
      }

      const [u] = await tx
        .select()
        .from(users)
        .where(eq(users.id, session.id))
        .for("update");

      if (!u) throw new ApiError(401, "User not found");
      if (u.banned) throw new ApiError(403, "Your account has been suspended.");
      if (u.balance < stake) throw new ApiError(400, "Insufficient balance");

      const odds = selection === "A" ? Number(match.oddsA) : Number(match.oddsB);
      const chosen = selection === "A" ? match.teamA : match.teamB;
      const newBalance = u.balance - stake;

      await tx
        .update(users)
        .set({ balance: newBalance })
        .where(eq(users.id, u.id));

      const [bet] = await tx
        .insert(bets)
        .values({
          userId: u.id,
          matchId: match.id,
          selection,
          odds: String(odds),
          stake,
          status: "pending",
        })
        .returning();

      await tx.insert(transactions).values({
        userId: u.id,
        amount: -stake,
        balanceAfter: newBalance,
        type: "bet",
        note: `Bet: ${match.league} - ${match.teamA} vs ${match.teamB} - backed ${chosen} @ ${odds.toFixed(2)}x`,
      });

      return { bet, match, newBalance };
    });

    return NextResponse.json({
      ok: true,
      balance: result.newBalance,
      bet: betDTO(result.bet, result.match),
    });
  } catch (e) {
    return handleError(e);
  }
}
