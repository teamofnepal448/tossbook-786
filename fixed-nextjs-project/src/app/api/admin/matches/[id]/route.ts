import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, transactions, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";
import { toMatchDTO } from "@/lib/domain";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") throw new ApiError(403, "Forbidden");

    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid match id");

    let body: { result?: string };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON in request");
    }

    const result = body.result;
    if (result !== "A" && result !== "B" && result !== "cancel") {
      throw new ApiError(400, "Result must be 'A', 'B', or 'cancel'");
    }

    const outcome = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .for("update");

      if (!match) throw new ApiError(404, "Match not found");
      if (match.status !== "open")
        throw new ApiError(400, "Match is already settled");

      const pendingBets = await tx
        .select()
        .from(bets)
        .where(and(eq(bets.matchId, id), eq(bets.status, "pending")))
        .for("update");

      const now = new Date();
      let credited = 0;
      let refunded = 0;
      let winners = 0;

      const calcPayout = (stakeVal: number, oddsVal: number): number => {
        const s = Math.max(0, Math.round(Number(stakeVal) || 0));
        const basis = Math.max(10000, Math.round((Number(oddsVal) || 1.95) * 10000));
        return Math.round((s * basis) / 10000);
      };

      if (result === "cancel") {
        const [claimed] = await tx
          .update(matches)
          .set({ status: "cancelled", winner: null, settledAt: now })
          .where(and(eq(matches.id, id), eq(matches.status, "open")))
          .returning();

        if (!claimed) throw new ApiError(400, "Match is already settled");

        for (const bet of pendingBets) {
          const [u] = await tx
            .update(users)
            .set({ balance: sql`${users.balance} + ${bet.stake}` })
            .where(eq(users.id, bet.userId))
            .returning({ balance: users.balance });

          await tx.insert(transactions).values({
            userId: bet.userId,
            amount: bet.stake,
            balanceAfter: u ? u.balance : bet.stake,
            type: "refund",
            note: `Refund: ${match.league} - ${match.teamA} vs ${match.teamB} (contest cancelled)`,
          });

          await tx
            .update(bets)
            .set({ status: "refunded", settledAt: now })
            .where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));

          refunded += bet.stake;
        }
      } else {
        const [claimed] = await tx
          .update(matches)
          .set({ status: "finished", winner: result, settledAt: now })
          .where(and(eq(matches.id, id), eq(matches.status, "open")))
          .returning();

        if (!claimed) throw new ApiError(400, "Match is already settled");

        const winnerName = result === "A" ? match.teamA : match.teamB;

        for (const bet of pendingBets) {
          if (bet.selection === result) {
            const credit = calcPayout(bet.stake, Number(bet.odds));
            const [u] = await tx
              .update(users)
              .set({ balance: sql`${users.balance} + ${credit}` })
              .where(eq(users.id, bet.userId))
              .returning({ balance: users.balance });

            await tx.insert(transactions).values({
              userId: bet.userId,
              amount: credit,
              balanceAfter: u ? u.balance : credit,
              type: "win",
              note: `Win: ${match.league} - backed ${winnerName} @ ${bet.odds} (stake ${bet.stake})`,
            });

            await tx
              .update(bets)
              .set({ status: "won", settledAt: now })
              .where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));

            credited += credit;
            winners += 1;
          } else {
            const [u] = await tx
              .select({ balance: users.balance })
              .from(users)
              .where(eq(users.id, bet.userId));

            await tx.insert(transactions).values({
              userId: bet.userId,
              amount: 0,
              balanceAfter: u ? u.balance : 0,
              type: "loss",
              note: `Loss: ${match.league} - ${match.teamA} vs ${match.teamB} (${winnerName} won toss, stake ${bet.stake})`,
            });

            await tx
              .update(bets)
              .set({ status: "lost", settledAt: now })
              .where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));
          }
        }
      }

      const [updated] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, id));

      return { match: updated, credited, refunded, winners, settled: pendingBets.length };
    });

    return NextResponse.json({
      ok: true,
      match: toMatchDTO(outcome.match),
      credited: outcome.credited,
      refunded: outcome.refunded,
      winners: outcome.winners,
      settled: outcome.settled,
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") throw new ApiError(403, "Forbidden");

    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid match id");

    const [cnt] = await db
      .select({ n: sql<string>`count(*)` })
      .from(bets)
      .where(eq(bets.matchId, id));

    if (Number(cnt?.n ?? 0) > 0) {
      throw new ApiError(400, "Cannot delete: active bets exist on this match");
    }

    await db.delete(matches).where(eq(matches.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
