import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    await ensureSeeded();
    return Response.json({ ok: true, status: "healthy" });
  } catch (err) {
    return Response.json(
      { ok: false, status: "degraded", error: (err as Error).message },
      { status: 500 },
    );
  }
}
