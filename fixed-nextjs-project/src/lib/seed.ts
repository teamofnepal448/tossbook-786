import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, settings, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { DEFAULT_TELEGRAM, DEFAULT_WEBSITE } from "@/lib/domain";

export const ADMIN_USERNAME = "DEVILTOSSBOOK575538636";
export const ADMIN_PASSWORD = "DEVILTOSSBOKKADMINPANELLOGIN";
export const DEMO_USERNAME = "DEMO1";
export const DEMO_PASSWORD = "demo123";

let seedPromise: Promise<void> | null = null;

async function bootstrapTables(): Promise<void> {
  // Ensure tables exist before attempting seed
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'punter',
      balance INTEGER NOT NULL DEFAULT 0,
      banned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      league TEXT NOT NULL,
      team_a TEXT NOT NULL,
      team_b TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      toss_close_time TIMESTAMPTZ NOT NULL,
      odds_a NUMERIC(8, 2) NOT NULL DEFAULT 1.97,
      odds_b NUMERIC(8, 2) NOT NULL DEFAULT 1.97,
      status TEXT NOT NULL DEFAULT 'open',
      winner TEXT,
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      selection TEXT NOT NULL,
      odds NUMERIC(8, 2) NOT NULL,
      stake INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

async function runSeed(): Promise<void> {
  try {
    await bootstrapTables();

    const defaults: Record<string, string> = {
      marketFrozen: "false",
      websiteUrl: DEFAULT_WEBSITE,
      telegramUrl: DEFAULT_TELEGRAM,
      supportUrl: DEFAULT_TELEGRAM,
    };
    for (const [key, value] of Object.entries(defaults)) {
      await db.insert(settings).values({ key, value }).onConflictDoNothing();
    }

    /* ---- super admin (self-healing) ---- */
    const [byName] = await db
      .select()
      .from(users)
      .where(eq(users.username, ADMIN_USERNAME))
      .limit(1);

    if (byName) {
      if (
        byName.role !== "admin" ||
        byName.banned ||
        !verifyPassword(ADMIN_PASSWORD, byName.passwordHash)
      ) {
        await db
          .update(users)
          .set({
            role: "admin",
            banned: false,
            passwordHash: hashPassword(ADMIN_PASSWORD),
          })
          .where(eq(users.id, byName.id));
      }
    } else {
      const [someAdmin] = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

      if (someAdmin) {
        await db
          .update(users)
          .set({
            username: ADMIN_USERNAME,
            banned: false,
            passwordHash: hashPassword(ADMIN_PASSWORD),
          })
          .where(eq(users.id, someAdmin.id));
      } else {
        await db.insert(users).values({
          username: ADMIN_USERNAME,
          passwordHash: hashPassword(ADMIN_PASSWORD),
          role: "admin",
          balance: 0,
        });
      }
    }

    /* ---- demo punter (self-healing) ---- */
    const [demo] = await db
      .select()
      .from(users)
      .where(eq(users.username, DEMO_USERNAME))
      .limit(1);

    if (demo) {
      if (!verifyPassword(DEMO_PASSWORD, demo.passwordHash)) {
        await db
          .update(users)
          .set({
            role: "punter",
            banned: false,
            passwordHash: hashPassword(DEMO_PASSWORD),
          })
          .where(eq(users.id, demo.id));
      }
    } else {
      await db.insert(users).values({
        username: DEMO_USERNAME,
        passwordHash: hashPassword(DEMO_PASSWORD),
        role: "punter",
        balance: 10000,
        phone: "9000000786",
      });
    }

    /* ---- sample contests (only when table is empty) ---- */
    const anyMatch = await db
      .select({ id: matches.id })
      .from(matches)
      .limit(1);

    if (anyMatch.length === 0) {
      const now = Date.now();
      const at = (min: number) => new Date(now + min * 60_000);
      await db.insert(matches).values([
        {
          league: "IPL 2026",
          teamA: "Mumbai Indians",
          teamB: "Chennai Super Kings",
          startTime: at(-35),
          tossCloseTime: at(192),
          status: "open",
        },
        {
          league: "WCL T20",
          teamA: "India Champions",
          teamB: "Pakistan Champions",
          startTime: at(-65),
          tossCloseTime: at(291),
          status: "open",
        },
        {
          league: "MEN'S T20",
          teamA: "Sydney Thunder",
          teamB: "Brisbane Heat",
          startTime: at(-12),
          tossCloseTime: at(98),
          status: "open",
        },
        {
          league: "IPL 2026",
          teamA: "Royal Challengers Bengaluru",
          teamB: "Kolkata Knight Riders",
          startTime: at(140),
          tossCloseTime: at(300),
          status: "open",
        },
        {
          league: "PSL 2026",
          teamA: "Lahore Qalandars",
          teamB: "Karachi Kings",
          startTime: at(300),
          tossCloseTime: at(450),
          status: "open",
        },
        {
          league: "WOMEN'S T20",
          teamA: "Delhi Capitals W",
          teamB: "Mumbai Indians W",
          startTime: at(480),
          tossCloseTime: at(645),
          status: "open",
        },
        {
          league: "IPL 2026",
          teamA: "Rajasthan Royals",
          teamB: "Punjab Kings",
          startTime: at(-170),
          tossCloseTime: at(-95),
          status: "finished",
          winner: "B",
          settledAt: at(-40),
        },
        {
          league: "BBL 2025-26",
          teamA: "Perth Scorchers",
          teamB: "Melbourne Stars",
          startTime: at(-230),
          tossCloseTime: at(-150),
          status: "finished",
          winner: "A",
          settledAt: at(-90),
        },
      ]);
    }
  } catch (err) {
    console.error("[seed] error during bootstrap/seed:", err);
    throw err;
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error("[seed] failed:", err);
      // Don't crash calling thread if offline; allow retry
    });
  }
  return seedPromise;
}
