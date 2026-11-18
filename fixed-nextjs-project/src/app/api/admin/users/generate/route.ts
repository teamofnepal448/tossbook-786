import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/api";
import {
  generatePassword,
  generateUsernameCandidate,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let username = "";
    for (let i = 0; i < 40; i++) {
      const candidate = generateUsernameCandidate();
      const [exists] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, candidate))
        .limit(1);

      if (!exists) {
        username = candidate;
        break;
      }
    }

    if (!username) {
      username = `tossbook786_${Date.now().toString().slice(-5)}`;
    }

    return NextResponse.json({ username, password: generatePassword() });
  } catch (e) {
    return handleError(e);
  }
}
