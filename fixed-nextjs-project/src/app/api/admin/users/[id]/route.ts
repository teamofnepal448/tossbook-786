import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") throw new ApiError(403, "Forbidden");

    const { id: raw } = await ctx.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid user id");

    let body: {
      action?: string;
      mode?: string;
      amount?: number;
      note?: string;
      banned?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON in request");
    }

    if (body.action === "ban") {
      const banned = Boolean(body.banned);
      const [u] = await db
        .update(users)
        .set({ banned })
        .where(eq(users.id, id))
        .returning();

      if (!u) throw new ApiError(404, "User not found");
      return NextResponse.json({ ok: true, banned: u.banned });
    }

    if (body.action === "wallet") {
      const mode = body.mode === "deduct" ? "deduct" : "add";
      const amount = Math.floor(Number(body.amount));
      const note = (body.note ?? "").trim().slice(0, 200);

      if (!Number.isInteger(amount) || amount <= 0) {
        throw new ApiError(400, "Enter a valid positive amount");
      }
      if (amount > 100_000_000) throw new ApiError(400, "Amount exceeds limit");

      const result = await db.transaction(async (tx) => {
        const [u] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .for("update");

        if (!u) throw new ApiError(404, "User not found");
        if (u.role !== "punter") throw new ApiError(400, "Wallet adjustments only apply to punters");

        if (mode === "deduct" && u.balance < amount) {
          throw new ApiError(400, "Amount exceeds available user balance");
        }

        const delta = mode === "add" ? amount : -amount;
        const newBalance = u.balance + delta;

        await tx.update(users).set({ balance: newBalance }).where(eq(users.id, id));

        await tx.insert(transactions).values({
          userId: id,
          amount: delta,
          balanceAfter: newBalance,
          type: mode === "add" ? "admin_credit" : "admin_debit",
          note: note || (mode === "add" ? "Coins added by admin" : "Coins deducted by admin"),
        });

        return newBalance;
      });

      return NextResponse.json({ ok: true, balance: result });
    }

    throw new ApiError(400, "Unknown action requested");
  } catch (e) {
    return handleError(e);
  }
}
