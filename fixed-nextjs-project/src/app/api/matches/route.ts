import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";
import { getPublicSettings, toMatchDTO } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(matches)
      .orderBy(asc(matches.tossCloseTime));

    const now = Date.now();
    const dtos = rows.map((m) => toMatchDTO(m, now));
    const live = dtos.filter((d) => d.status === "live");
    const scheduled = dtos
      .filter((d) => d.status === "scheduled")
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const finishedToday = dtos.filter(
      (d) =>
        (d.status === "finished" || d.status === "cancelled") &&
        d.settledAt &&
        new Date(d.settledAt).getTime() >= startOfDay.getTime(),
    );

    const settingsPub = await getPublicSettings();

    return NextResponse.json({
      live,
      scheduled,
      finishedToday,
      settings: settingsPub,
      serverNow: new Date(now).toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}
