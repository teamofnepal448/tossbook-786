import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";
import { toMatchDTO } from "@/lib/domain";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  await ensureSeeded();
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new ApiError(403, "Forbidden");
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(200);

    const stakeRows = await db
      .select({
        matchId: bets.matchId,
        total: sql<string>`coalesce(sum(${bets.stake}), 0)`,
        cnt: sql<string>`count(*)`,
        pending: sql<string>`coalesce(sum(case when ${bets.status} = 'pending' then ${bets.stake} else 0 end), 0)`,
      })
      .from(bets)
      .groupBy(bets.matchId);

    const map = new Map(stakeRows.map((r) => [r.matchId, r]));
    const now = Date.now();

    return NextResponse.json(
      rows.map((m) => ({
        ...toMatchDTO(m, now),
        totalStaked: Number(map.get(m.id)?.total ?? 0),
        betCount: Number(map.get(m.id)?.cnt ?? 0),
        pendingStaked: Number(map.get(m.id)?.pending ?? 0),
      })),
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    let body: {
      league?: string;
      teamA?: string;
      teamB?: string;
      startTime?: string;
      tossCloseTime?: string;
      oddsA?: number;
      oddsB?: number;
    };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON in request");
    }

    const league = (body.league ?? "").trim().toUpperCase();
    const teamA = (body.teamA ?? "").trim();
    const teamB = (body.teamB ?? "").trim();

    if (!league || league.length > 40) throw new ApiError(400, "League is required");
    if (!teamA || !teamB) throw new ApiError(400, "Both teams are required");
    if (teamA.toLowerCase() === teamB.toLowerCase())
      throw new ApiError(400, "Teams must be different");

    const start = new Date(body.startTime ?? "");
    const close = new Date(body.tossCloseTime ?? "");
    if (isNaN(start.getTime())) throw new ApiError(400, "Invalid start time");
    if (isNaN(close.getTime())) throw new ApiError(400, "Invalid close time");
    if (close.getTime() <= start.getTime())
      throw new ApiError(400, "Toss close time must be after start time");

    const oddsA = Number(body.oddsA) || 1.97;
    const oddsB = Number(body.oddsB) || 1.97;
    if (oddsA < 1.01 || oddsA > 50 || oddsB < 1.01 || oddsB > 50)
      throw new ApiError(400, "Odds must be between 1.01 and 50");

    const [created] = await db
      .insert(matches)
      .values({
        league,
        teamA,
        teamB,
        startTime: start,
        tossCloseTime: close,
        oddsA: String(oddsA),
        oddsB: String(oddsB),
        status: "open",
      })
      .returning();

    return NextResponse.json({ ok: true, match: toMatchDTO(created) });
  } catch (e) {
    return handleError(e);
  }
}
