import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserRow } from "@/db/schema";

const SECRET =
  process.env.SESSION_SECRET ||
  "tossbook786::royal-gold-ultra-secret-session-key-v1";

export const SESSION_COOKIE = "tb786_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!password || !stored || typeof password !== "string" || typeof stored !== "string") {
    return false;
  }
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  if (!salt || !hash || !/^[a-f0-9]+$/i.test(salt) || !/^[a-f0-9]+$/i.test(hash)) {
    return false;
  }
  try {
    const calc = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(calc, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signSession(userId: number): string {
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(String(userId))
    .digest("hex");
  return `${userId}.${sig}`;
}

export function verifySessionToken(token?: string | null): number | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = Number(token.slice(0, dot));
  if (!Number.isInteger(id) || id <= 0) return null;
  const sig = token.slice(dot + 1);
  if (!/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(String(id))
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? id : null;
}

export async function getSessionUser(): Promise<UserRow | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const id = verifySessionToken(token);
    if (!id) return null;

    const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return u ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number): Promise<void> {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, signSession(userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // In contexts where cookies() is read-only, attachSessionCookie should be used on NextResponse
  }
}

export function attachSessionCookie(response: NextResponse, userId: number): void {
  response.cookies.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // Fallback handled via attachClearSessionCookie
  }
}

export function attachClearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
