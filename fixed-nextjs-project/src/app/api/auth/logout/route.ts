import { NextResponse } from "next/server";
import { attachClearSessionCookie, clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  const res = NextResponse.json({ ok: true });
  attachClearSessionCookie(res);
  return res;
}
