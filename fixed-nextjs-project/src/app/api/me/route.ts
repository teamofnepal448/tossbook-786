import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${bets.stake}), 0)` })
      .from(bets)
      .where(and(eq(bets.userId, user.id), eq(bets.status, "pending")));

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: user.role,
      phone: user.phone,
      balance: user.balance,
      banned: user.banned,
      exposure: Number(row?.total ?? 0),
    });
  } catch (e) {
    return handleError(e);
  }
}
