import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.id))
      .limit(120);

    return NextResponse.json(
      rows.map((t) => ({
        id: t.id,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        type: t.type,
        note: t.note,
        createdAt: new Date(t.createdAt).toISOString(),
      })),
    );
  } catch (e) {
    return handleError(e);
  }
}
