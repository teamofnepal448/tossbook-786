import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { attachSessionCookie, setSessionCookie, verifyPassword } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    let body: { username?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request" }, { status: 400 });
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    if (user.banned) {
      return NextResponse.json(
        { error: "Account suspended. Please contact customer support." },
        { status: 403 },
      );
    }

    // Await async cookie store update for Next.js internal context
    await setSessionCookie(user.id);

    // Also attach cookie header directly to the response object to guarantee Set-Cookie delivery
    const response = NextResponse.json({
      ok: true,
      role: user.role,
      username: user.username,
      id: user.id,
    });

    attachSessionCookie(response, user.id);

    return response;
  } catch (e) {
    return handleError(e);
  }
}
