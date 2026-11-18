import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/api";
import { getPublicSettings } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") throw new ApiError(403, "Forbidden");
    return NextResponse.json(await getPublicSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") throw new ApiError(403, "Forbidden");

    let body: {
      marketFrozen?: boolean;
      websiteUrl?: string;
      telegramUrl?: string;
      supportUrl?: string;
    };
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, "Invalid JSON in request");
    }

    const upserts: { key: string; value: string }[] = [];
    if (typeof body.marketFrozen === "boolean") {
      upserts.push({ key: "marketFrozen", value: String(body.marketFrozen) });
    }

    for (const [key, val] of [
      ["websiteUrl", body.websiteUrl],
      ["telegramUrl", body.telegramUrl],
      ["supportUrl", body.supportUrl],
    ] as const) {
      if (typeof val === "string" && val.trim()) {
        const clean = val.trim().slice(0, 200);
        if (!/^https?:\/\//i.test(clean)) {
          throw new ApiError(400, `${key} must be a valid http(s) URL`);
        }
        upserts.push({ key, value: clean });
      }
    }

    for (const { key, value } of upserts) {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    }

    return NextResponse.json({ ok: true, settings: await getPublicSettings() });
  } catch (e) {
    return handleError(e);
  }
}
