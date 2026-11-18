import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { effectiveStatus } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [punters] = await db
      .select({
        n: sql<string>`count(*)`,
        coins: sql<string>`coalesce(sum(${users.balance}), 0)`,
        banned: sql<string>`coalesce(sum(case when ${users.banned} then 1 else 0 end), 0)`,
      })
      .from(users)
      .where(eq(users.role, "punter"));

    const [pending] = await db
      .select({
        n: sql<string>`count(*)`,
        stake: sql<string>`coalesce(sum(${bets.stake}), 0)`,
      })
      .from(bets)
      .where(eq(bets.status, "pending"));

    const openMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "open"));

    const now = Date.now();
    const liveCount = openMatches.filter(
      (m) => effectiveStatus(m, now) === "live",
    ).length;
    const scheduledCount = openMatches.filter(
      (m) => effectiveStatus(m, now) === "scheduled",
    ).length;
    const lockedCount = openMatches.filter(
      (m) => effectiveStatus(m, now) === "locked",
    ).length;

    return NextResponse.json({
      totalPunters: Number(punters?.n ?? 0),
      coinsInCirculation: Number(punters?.coins ?? 0),
      bannedPunters: Number(punters?.banned ?? 0),
      pendingBets: Number(pending?.n ?? 0),
      pendingStakes: Number(pending?.stake ?? 0),
      liveMatches: liveCount,
      scheduledMatches: scheduledCount,
      lockedMatches: lockedCount,
    });
  } catch (e) {
    return handleError(e);
  }
}
