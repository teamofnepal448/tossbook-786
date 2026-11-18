import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, users } from "@/db/schema";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  await ensureSeeded();
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "Forbidden");
  }
  return user;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("search") ?? "").trim();

    const conditions = [eq(users.role, "punter")];
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, "")}%`;
      conditions.push(
        or(ilike(users.username, pattern), ilike(users.phone, pattern))!,
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.id))
      .limit(250);

    const expoRows = await db
      .select({
        userId: bets.userId,
        total: sql<string>`coalesce(sum(${bets.stake}), 0)`,
        cnt: sql<string>`count(*)`,
      })
      .from(bets)
      .where(eq(bets.status, "pending"))
      .groupBy(bets.userId);

    const expoMap = new Map(expoRows.map((r) => [r.userId, r]));

    return NextResponse.json(
      rows.map((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        balance: u.balance,
        banned: u.banned,
        createdAt: new Date(u.createdAt).toISOString(),
        exposure: Number(expoMap.get(u.id)?.total ?? 0),
        pendingBets: Number(expoMap.get(u.id)?.cnt ?? 0),
      })),
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    let body: { username?: string; password?: string; phone?: string };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON in request");
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const phone = (body.phone ?? "").trim() || null;

    if (!/^[\w.\-*]{4,40}$/.test(username)) {
      throw new ApiError(
        400,
        "Username must be 4-40 chars (letters, numbers, _ . - *)",
      );
    }

    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters");
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing) throw new ApiError(409, "USERNAME_TAKEN");

    const [created] = await db
      .insert(users)
      .values({
        username,
        passwordHash: hashPassword(password),
        phone,
        role: "punter",
        balance: 0,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      user: {
        id: created.id,
        username: created.username,
        phone: created.phone,
        balance: created.balance,
        banned: created.banned,
        createdAt: new Date(created.createdAt).toISOString(),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
