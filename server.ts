import express from "express";
import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./src/db/index.ts";
import {
  bets as betsTable,
  matches as matchesTable,
  transactions as transactionsTable,
  users as usersTable,
} from "./src/db/schema.ts";
import { resilientDb } from "./src/lib/resilient-db.ts";
import {
  calculateCancellationRefund,
  calculatePayout,
  sanitizeOdds,
  sanitizeStake,
} from "./src/lib/money.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET || "tossbook786_secret_key_998877_secure_hash";
const SESSION_COOKIE = "tb786_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD =
  "1BVtsOH8BuwhXb95UFmKzrJA6RJWOSvpTxylTebeNTWaj5jRCyis18GlhrJpQ3Hki6u3XwGBojFNvs47YXZ70gjsAeMvsFJuDvqx1xVcSwVg82y47jERt47XyEQTN7UeOCCq4FgYmub0YoOvpKcb5S7l_2VGkOlFWB2cVcDcXYTpSYd2kldI8Yle8URE73sLkDUx61sF8M0MMrH9aORxGMS1--Dmom9ioAVSvaLumnK4n4lO2Q6Yb6IDUadWZiUvrWYtm2LukS6_pkUacxKankDZ6zHV_RGwpPMQvfIKXsuHV5fzs8z3hUILKUbTNad6TiSuX8WrSEY0Iogz_u3pga1lT990u8SA=";
export const DEMO_USERNAME = "DEMO1";
export const DEMO_PASSWORD = "demo123";

export const DEFAULT_TELEGRAM = "https://t.me/+FNrv5zNv6lI0ODk1";
export const DEFAULT_WEBSITE = "https://tossbook786.com";
export const DEFAULT_MARQUEE = "Welcome to the Toss Book. Asia's No. 1 Gaming Platform. Min bet 100, Min Withdraw 500, Get 200 for Each Referral. Instant 24x7 Royal Service!";
export const DEFAULT_WELCOME_TEMPLATE = `🏏WELCOME TO TOSSBOOK786🏏

🌐 *OFFICIAL WEBSITE*
{websiteUrl}

*User*👤 :- {username}
*Password*🔐  :- {password}

⚠️ *Password me ({capitalLetter}) Capital Letter me rahega*

✅ *Instant Access Available*

📌 *Please login using your provided details*
Telegram support :- {supportUrl}`;

export const pgPool = resilientDb;

/* ==========================================================================
   PASSWORD & SESSION CRYPTOGRAPHY
   ========================================================================== */

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

export function passwordFingerprint(passwordHash: string): string {
  return crypto.createHmac("sha256", SECRET).update(passwordHash).digest("hex").slice(0, 16);
}

export function signSession(userId: number, passwordHash: string = ""): string {
  const fp = passwordFingerprint(passwordHash);
  const payload = `${userId}.${fp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): { userId: number; fp: string } | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawId, fp, sig] = parts;
  const userId = Number(rawId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!/^[a-f0-9]{16}$/.test(fp) || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const payload = `${userId}.${fp}`;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? { userId, fp } : null;
}

/* ==========================================================================
   SCHEMA & SEED BOOTSTRAP FOR POSTGRESQL (NEON)
   ========================================================================== */

export async function bootstrapDatabase() {
  try {
    await pgPool.query(`
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
        odds_a NUMERIC(8, 2) NOT NULL DEFAULT 1.95,
        odds_b NUMERIC(8, 2) NOT NULL DEFAULT 1.95,
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
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS toss_close_time TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS toss_closes_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_a NUMERIC(8, 2) DEFAULT 1.95;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS odds_b NUMERIC(8, 2) DEFAULT 1.95;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_img TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_img TEXT;
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_img TEXT;
      CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_bets_match_status ON bets(match_id, status);
      CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions(user_id, id DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_status_close ON matches(status, toss_close_time);
    `);

    try {
      await pgPool.query(`
        ALTER TABLE matches ALTER COLUMN starts_at DROP NOT NULL;
        ALTER TABLE matches ALTER COLUMN toss_closes_at DROP NOT NULL;
        ALTER TABLE matches ALTER COLUMN closes_at DROP NOT NULL;
      `);
    } catch {
      /* ignore if column does not exist */
    }

    // Ensure default settings
    const defaultSettings: [string, string][] = [
      ["marketFrozen", "false"],
      ["websiteUrl", DEFAULT_WEBSITE],
      ["telegramUrl", DEFAULT_TELEGRAM],
      ["telegramChannelUrl", DEFAULT_TELEGRAM],
      ["telegramGroupUrl", DEFAULT_TELEGRAM],
      ["depositTelegramUrl", DEFAULT_TELEGRAM],
      ["withdrawTelegramUrl", DEFAULT_TELEGRAM],
      ["supportUrl", DEFAULT_TELEGRAM],
      ["getNewIdUrl", DEFAULT_TELEGRAM],
      ["userWelcomeTemplate", DEFAULT_WELCOME_TEMPLATE],
      ["matchScheduleBanner", "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80"],
      ["marqueeText", DEFAULT_MARQUEE],
      ["minBet", "100"],
      ["minWithdraw", "500"],
      ["referralBonus", "200"],
    ];

    for (const [k, v] of defaultSettings) {
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [k, v],
      );
    }

    // Ensure super admin exists with correct password
    const adminHash = hashPassword(ADMIN_PASSWORD);
    const existingAdmin = await pgPool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (existingAdmin.rows.length === 0) {
      await pgPool.query(
        `INSERT INTO users (username, password_hash, role, balance, banned) VALUES ($1, $2, 'admin', 0, false)`,
        [ADMIN_USERNAME, adminHash],
      );
    } else {
      await pgPool.query(
        `UPDATE users SET username = $1, password_hash = $2, banned = false WHERE id = $3`,
        [ADMIN_USERNAME, adminHash, existingAdmin.rows[0].id],
      );
    }

    // Ensure demo user exists with correct password
    const demoHash = hashPassword(DEMO_PASSWORD);
    const existingDemo = await pgPool.query(`SELECT id FROM users WHERE username = 'DEMO1' LIMIT 1`);
    if (existingDemo.rows.length === 0) {
      await pgPool.query(
        `INSERT INTO users (username, password_hash, role, balance, banned, phone) VALUES ($1, $2, 'punter', 10000, false, '9000000786')`,
        [DEMO_USERNAME, demoHash],
      );
    } else {
      await pgPool.query(
        `UPDATE users SET password_hash = $1, banned = false WHERE id = $2`,
        [demoHash, existingDemo.rows[0].id],
      );
    }

    // Seed matches if empty
    const matchCnt = await pgPool.query(`SELECT count(*) as count FROM matches`);
    if (Number(matchCnt.rows[0].count) === 0) {
      const now = Date.now();
      const at = (min: number) => new Date(now + min * 60_000).toISOString();

      await pgPool.query(`
        INSERT INTO matches (league, team_a, team_b, start_time, toss_close_time, odds_a, odds_b, status) VALUES
        ('15TH T20, WCL 2026', 'INDIA CHAMPIONS', 'BANGLADESH CHAMPIONS', '${at(-30)}', '${at(180)}', 1.95, 1.95, 'open'),
        ('CSA PRO20 CUP', 'TITANS', 'EASTERN STORM', '${at(-15)}', '${at(95)}', 1.95, 1.95, 'open'),
        ('1ST T20, T20 SPRING 2026', 'HOBART HURRICANES WOMEN', 'ACT METEORS WOMEN', '${at(-60)}', '${at(240)}', 1.95, 1.95, 'open'),
        ('2ND T20, T20 SPRING 2026', 'SYDNEY SIXERS WOMEN', 'BRISBANE HEAT WOMEN', '${at(-10)}', '${at(120)}', 1.95, 1.95, 'open'),
        ('11TH T20I, MEN''S T20 WC ASIA QUALIFIER B 2026', 'MALAYSIA', 'SINGAPORE', '${at(-5)}', '${at(110)}', 1.95, 1.95, 'open'),
        ('11TH T20I, MEN''S T20 WC ASIA QUALIFIER B 2026', 'HONG KONG', 'MALDIVES', '${at(120)}', '${at(280)}', 1.95, 1.95, 'open'),
        ('12TH T20I, MEN''S T20 WC ASIA QUALIFIER B 2026', 'CHINA', 'SAUDI ARABIA', '${at(240)}', '${at(420)}', 1.95, 1.95, 'open'),
        ('7TH ONE DAY, AUS ONE DAY CUP 2026-27', 'VICTORIA', 'SOUTH AUSTRALIA', '${at(360)}', '${at(540)}', 1.95, 1.95, 'open');
      `);
    }

    console.log("✅ PostgreSQL schema and seed verified successfully!");
  } catch (err) {
    console.error("Database bootstrap error:", err);
  }
}

// Credential generation helper
const USER_PATTERNS = [
  () => `devil${Math.floor(1000 + Math.random() * 9000)}`,
  () => `tossbook786_${Math.floor(10 + Math.random() * 90)}`,
  () => `tb786${Math.floor(100 + Math.random() * 900)}`,
  () => `royal${Math.floor(1000 + Math.random() * 9000)}`,
  () => `punter${Math.floor(1000 + Math.random() * 9000)}`,
];

function generateUsernameCandidate(): string {
  const fn = USER_PATTERNS[Math.floor(Math.random() * USER_PATTERNS.length)];
  return fn();
}

function generatePassword(): string {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghijkmnpqrstuvwxyz";
  const cap = UPPER[Math.floor(Math.random() * UPPER.length)];
  let low = "";
  for (let i = 0; i < 3; i++) low += LOWER[Math.floor(Math.random() * LOWER.length)];
  const rand4 = String(Math.floor(1000 + Math.random() * 9000));
  return `${cap}${low}@${rand4}`;
}

export function effectiveMatchStatus(
  status: string,
  startTime: string | Date,
  tossCloseTime: string | Date,
  now: number = Date.now(),
): "scheduled" | "live" | "locked" | "finished" | "cancelled" {
  if (status === "finished") return "finished";
  if (status === "cancelled") return "cancelled";
  const close = new Date(tossCloseTime).getTime();
  if (now >= close) return "locked"; // Cutoff reached: suspend / bet closed
  return "live"; // Open & countdown active
}

async function getPublicSettings() {
  try {
    const res = await pgPool.query(`SELECT key, value FROM settings`);
    const map = new Map(res.rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    return {
      marketFrozen: map.get("marketFrozen") === "true",
      websiteUrl: map.get("websiteUrl") || DEFAULT_WEBSITE,
      telegramUrl: map.get("telegramUrl") || DEFAULT_TELEGRAM,
      telegramChannelUrl: map.get("telegramChannelUrl") || map.get("telegramUrl") || DEFAULT_TELEGRAM,
      telegramGroupUrl: map.get("telegramGroupUrl") || map.get("telegramUrl") || DEFAULT_TELEGRAM,
      depositTelegramUrl: map.get("depositTelegramUrl") || map.get("telegramUrl") || DEFAULT_TELEGRAM,
      withdrawTelegramUrl: map.get("withdrawTelegramUrl") || map.get("telegramUrl") || DEFAULT_TELEGRAM,
      supportUrl: map.get("supportUrl") || DEFAULT_TELEGRAM,
      getNewIdUrl: map.get("getNewIdUrl") || map.get("supportUrl") || DEFAULT_TELEGRAM,
      userWelcomeTemplate: map.get("userWelcomeTemplate") || DEFAULT_WELCOME_TEMPLATE,
      matchScheduleBanner: map.get("matchScheduleBanner") || "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
      marqueeText: map.get("marqueeText") || DEFAULT_MARQUEE,
      minBet: Number(map.get("minBet") || 100),
      minWithdraw: Number(map.get("minWithdraw") || 500),
      referralBonus: Number(map.get("referralBonus") || 200),
    };
  } catch {
    return {
      marketFrozen: false,
      websiteUrl: DEFAULT_WEBSITE,
      telegramUrl: DEFAULT_TELEGRAM,
      telegramChannelUrl: DEFAULT_TELEGRAM,
      telegramGroupUrl: DEFAULT_TELEGRAM,
      depositTelegramUrl: DEFAULT_TELEGRAM,
      withdrawTelegramUrl: DEFAULT_TELEGRAM,
      supportUrl: DEFAULT_TELEGRAM,
      getNewIdUrl: DEFAULT_TELEGRAM,
      userWelcomeTemplate: DEFAULT_WELCOME_TEMPLATE,
      matchScheduleBanner: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
      marqueeText: DEFAULT_MARQUEE,
      minBet: 100,
      minWithdraw: 500,
      referralBonus: 200,
    };
  }
}

/* ==========================================================================
   EXPRESS SERVER
   ========================================================================== */

export const app = express();

let dbInitPromise: Promise<void> | null = null;
export function ensureDbReady(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await resilientDb.checkConnection();
        await bootstrapDatabase();
      } catch (err) {
        console.warn("[Init] DB ready warning:", (err as Error).message);
      }
    })();
  }
  return dbInitPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDbReady();
  } catch {
    /* proceed */
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (req.path.startsWith("/api") || req.path === "/health") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// Authentication middleware helper (verifies HMAC + password-hash fingerprint so password updates revoke all old sessions)
async function getAuthUser(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE];
  const parsed = verifySessionToken(token);
  if (!parsed) return null;
  try {
    const res = await pgPool.query(
      `SELECT id, username, role, phone, balance, banned, password_hash FROM users WHERE id = $1`,
      [parsed.userId],
    );
    const u = res.rows[0];
    if (!u || !u.password_hash) return null;
    const expectedFp = passwordFingerprint(u.password_hash);
    const a = Buffer.from(parsed.fp);
    const b = Buffer.from(expectedFp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      phone: u.phone,
      balance: u.balance,
      banned: u.banned,
    };
  } catch {
    return null;
  }
}

// Health endpoints (compatible with Render, Cloud Run & monitoring services)
app.get(["/health", "/api/health"], async (_req: Request, res: Response) => {
  const isPg = resilientDb.isUsingPostgres();
  res.status(200).json({
    ok: true,
    status: "healthy",
    database: isPg ? "connected (PostgreSQL)" : "connected (resilient local store)",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Public settings endpoint
app.get("/api/settings", async (_req: Request, res: Response) => {
  const s = await getPublicSettings();
  res.json(s);
});

// Login endpoint
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const u = (username ?? "").trim();
  const p = password ?? "";

  if (!u || !p) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    // Check user with case-insensitive match or admin aliases
    let q = `SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`;
    let params: string[] = [u];

    if (u.toLowerCase() === ADMIN_USERNAME.toLowerCase() || u.toLowerCase() === "admin") {
      q = `SELECT * FROM users WHERE role = 'admin' LIMIT 1`;
      params = [];
    }

    const result = await pgPool.query(q, params);
    const user = result.rows[0];

    if (!user || !verifyPassword(p, user.password_hash)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (user.banned) {
      res.status(403).json({ error: "Account suspended. Contact support." });
      return;
    }

    const token = signSession(user.id, user.password_hash);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS,
    });

    res.json({
      ok: true,
      role: user.role,
      username: user.username,
      id: user.id,
    });
  } catch (err) {
    res.status(500).json({ error: "Database error during login", detail: (err as Error).message });
  }
});

// Change password endpoint (Authenticated: verifies current password, updates hash in PostgreSQL, clears & invalidates sessions)
app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: "Unauthorized. Please log in again." });
    return;
  }
  if (authUser.banned) {
    res.status(403).json({ error: "Account suspended. Contact support." });
    return;
  }

  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string" ||
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    res.status(400).json({ error: "Current password, new password, and confirmation are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters long" });
    return;
  }
  if (newPassword.length > 512) {
    res.status(400).json({ error: "New password cannot exceed 512 characters" });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: "New password and confirmation password do not match" });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: "New password must be different from your current password" });
    return;
  }

  try {
    if (resilientDb.isUsingPostgres() && db) {
      await db.transaction(async (tx) => {
        const [dbUser] = await tx
          .select({ id: usersTable.id, passwordHash: usersTable.passwordHash, banned: usersTable.banned })
          .from(usersTable)
          .where(eq(usersTable.id, authUser.id))
          .for("update");

        if (!dbUser) {
          throw Object.assign(new Error("User account not found"), { status: 404 });
        }
        if (dbUser.banned) {
          throw Object.assign(new Error("Account suspended. Contact support."), { status: 403 });
        }
        if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
          throw Object.assign(new Error("Current password is incorrect"), { status: 400 });
        }

        const nextHash = hashPassword(newPassword);
        await tx
          .update(usersTable)
          .set({ passwordHash: nextHash })
          .where(eq(usersTable.id, authUser.id));
      });
    } else {
      const client = await pgPool.connect();
      try {
        await client.query("BEGIN");
        const uRes = await client.query(`SELECT id, password_hash, banned FROM users WHERE id = $1 FOR UPDATE`, [
          authUser.id,
        ]);
        const dbUser = uRes.rows[0];
        if (!dbUser) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "User account not found" });
          return;
        }
        if (dbUser.banned) {
          await client.query("ROLLBACK");
          res.status(403).json({ error: "Account suspended. Contact support." });
          return;
        }
        if (!verifyPassword(currentPassword, dbUser.password_hash)) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Current password is incorrect" });
          return;
        }

        const nextHash = hashPassword(newPassword);
        await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [nextHash, authUser.id]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    // Clear the active session cookie; passwordFingerprint change also invalidates all prior cookies
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    res.json({
      ok: true,
      sessionCleared: true,
      message: "Password updated successfully. Please sign in with your new password.",
    });
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    res.status(status).json({ error: err?.message || "Failed to update password" });
  }
});

// Logout endpoint
app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true });
});

// Me endpoint
app.get("/api/me", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Calculate pending exposure
  const expoRes = await pgPool.query(
    `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
    [user.id],
  );
  const exposure = Number(expoRes.rows[0]?.total ?? 0);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    phone: user.phone,
    balance: user.balance,
    banned: user.banned,
    exposure,
  });
});

// Matches list endpoint
app.get("/api/matches", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await pgPool.query(`SELECT * FROM matches ORDER BY toss_close_time ASC`);
    const now = Date.now();

    const dtos = result.rows.map((m: any) => ({
      id: m.id,
      league: m.league,
      teamA: m.team_a,
      teamB: m.team_b,
      matchImg: m.match_img || null,
      teamAImg: m.team_a_img || null,
      teamBImg: m.team_b_img || null,
      startTime: new Date(m.start_time).toISOString(),
      tossCloseTime: new Date(m.toss_close_time).toISOString(),
      oddsA: Number(m.odds_a),
      oddsB: Number(m.odds_b),
      status: effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now),
      winner: m.winner,
      settledAt: m.settled_at ? new Date(m.settled_at).toISOString() : null,
      createdAt: new Date(m.created_at).toISOString(),
    }));

    const live = dtos.filter((d: any) => d.status === "live" || d.status === "locked");
    const scheduled = dtos
      .filter((d: any) => d.status === "scheduled")
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const finishedToday = dtos.filter(
      (d: any) =>
        (d.status === "finished" || d.status === "cancelled") &&
        d.settledAt &&
        new Date(d.settledAt).getTime() >= startOfDay.getTime(),
    );

    res.json({
      live,
      scheduled,
      finishedToday,
      settings: await getPublicSettings(),
      serverNow: new Date(now).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches", detail: (err as Error).message });
  }
});

// Place bet endpoint (Atomic Drizzle db.transaction on PostgreSQL + resilient atomic fallback)
app.post("/api/bets", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (user.role === "admin") {
    res.status(403).json({ error: "Admins cannot place bets" });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: "Your account has been suspended. Contact support." });
    return;
  }

  const settings = await getPublicSettings();
  if (settings.marketFrozen) {
    res.status(423).json({ error: "Markets are temporarily closed by admin. Please wait." });
    return;
  }

  const { matchId, selection, stake: rawStake } = req.body || {};
  const mId = Number(matchId);
  const side = selection === "B" ? "B" : selection === "A" ? "A" : null;
  const stake = sanitizeStake(rawStake);

  if (!Number.isInteger(mId) || mId <= 0) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }
  if (!side) {
    res.status(400).json({ error: "Please select Team A or Team B" });
    return;
  }
  if (stake < settings.minBet) {
    res.status(400).json({ error: `Minimum bet amount is ${settings.minBet} Rs.` });
    return;
  }

  // Use Drizzle atomic transaction when PostgreSQL is connected
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, mId))
          .for("update");

        if (!match) {
          throw Object.assign(new Error("Match not found"), { status: 404 });
        }

        const st = effectiveMatchStatus(match.status, match.startTime, match.tossCloseTime);
        if (st !== "live") {
          throw Object.assign(
            new Error(
              st === "locked"
                ? "Betting closed for this contest"
                : st === "scheduled"
                  ? "Contest has not opened yet"
                  : "Contest is already settled",
            ),
            { status: 400 },
          );
        }

        const [freshUser] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, user.id))
          .for("update");

        if (!freshUser || freshUser.balance < stake) {
          throw Object.assign(new Error("Insufficient wallet balance (Rs.) to place this bet."), {
            status: 400,
          });
        }

        const odds = sanitizeOdds(side === "A" ? match.oddsA : match.oddsB);
        const chosen = side === "A" ? match.teamA : match.teamB;

        const [updatedUser] = await tx
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} - ${stake}` })
          .where(eq(usersTable.id, freshUser.id))
          .returning({ balance: usersTable.balance });

        const newBalance = updatedUser.balance;

        const [bet] = await tx
          .insert(betsTable)
          .values({
            userId: freshUser.id,
            matchId: match.id,
            selection: side,
            odds: odds.toFixed(2),
            stake,
            status: "pending",
          })
          .returning();

        await tx.insert(transactionsTable).values({
          userId: freshUser.id,
          amount: -stake,
          balanceAfter: newBalance,
          type: "bet",
          note: `Bet placed on ${match.league} - ${chosen} @ ${odds.toFixed(2)}x (Contest #${match.id})`,
        });

        const [expoRow] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${betsTable.stake}), 0)` })
          .from(betsTable)
          .where(and(eq(betsTable.userId, freshUser.id), eq(betsTable.status, "pending")));

        return {
          balance: newBalance,
          exposure: Number(expoRow?.total ?? 0),
          bet: {
            id: bet.id,
            matchId: bet.matchId,
            league: match.league,
            teamA: match.teamA,
            teamB: match.teamB,
            selection: bet.selection,
            selectionTeam: chosen,
            odds: Number(bet.odds),
            stake: bet.stake,
            potential: calculatePayout(bet.stake, Number(bet.odds)),
            status: bet.status,
          },
        };
      });

      res.json({ ok: true, ...outcome });
      return;
    } catch (err: any) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Failed to place bet" });
      return;
    }
  }

  // Local resilient atomic transaction fallback
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const matchRes = await client.query(`SELECT * FROM matches WHERE id = $1 FOR UPDATE`, [mId]);
    const match = matchRes.rows[0];
    if (!match) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Match not found" });
      return;
    }

    const st = effectiveMatchStatus(match.status, match.start_time, match.toss_close_time);
    if (st !== "live") {
      await client.query("ROLLBACK");
      res.status(400).json({
        error:
          st === "locked"
            ? "Betting closed for this contest"
            : st === "scheduled"
              ? "Contest has not opened yet"
              : "Contest is already settled",
      });
      return;
    }

    const userRes = await client.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [user.id]);
    const freshUser = userRes.rows[0];

    if (!freshUser || freshUser.balance < stake) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Insufficient wallet balance (Rs.) to place this bet." });
      return;
    }

    const odds = sanitizeOdds(side === "A" ? match.odds_a : match.odds_b);
    const chosen = side === "A" ? match.team_a : match.team_b;
    const newBalance = freshUser.balance - stake;

    await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [newBalance, freshUser.id]);

    const betRes = await client.query(
      `INSERT INTO bets (user_id, match_id, selection, odds, stake, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [freshUser.id, match.id, side, odds, stake],
    );
    const bet = betRes.rows[0];

    await client.query(
      `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'bet', $4)`,
      [
        freshUser.id,
        -stake,
        newBalance,
        `Bet placed on ${match.league} - ${chosen} @ ${odds.toFixed(2)}x (Contest #${match.id})`,
      ],
    );

    const expoRes = await client.query(
      `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
      [freshUser.id],
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      balance: newBalance,
      exposure: Number(expoRes.rows[0]?.total ?? 0),
      bet: {
        id: bet.id,
        matchId: bet.match_id,
        league: match.league,
        teamA: match.team_a,
        teamB: match.team_b,
        selection: bet.selection,
        selectionTeam: chosen,
        odds: Number(bet.odds),
        stake: bet.stake,
        potential: calculatePayout(bet.stake, Number(bet.odds)),
        status: bet.status,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to place bet", detail: (err as Error).message });
  } finally {
    client.release();
  }
});

// Punter bets list
app.get("/api/bets", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const resBets = await pgPool.query(
      `SELECT b.*, m.league, m.team_a, m.team_b, m.status as match_status, m.start_time, m.toss_close_time, m.winner 
       FROM bets b 
       JOIN matches m ON b.match_id = m.id 
       WHERE b.user_id = $1 
       ORDER BY b.id DESC LIMIT 100`,
      [user.id],
    );

    const now = Date.now();
    const dtos = resBets.rows.map((b: any) => {
      const chosen = b.selection === "A" ? b.team_a : b.team_b;
      const closeMs = b.toss_close_time ? new Date(b.toss_close_time).getTime() : 0;
      const canCancel = b.status === "pending" && b.match_status === "open" && now < closeMs;
      return {
        id: b.id,
        matchId: b.match_id,
        league: b.league,
        teamA: b.team_a,
        teamB: b.team_b,
        selection: b.selection,
        selectionTeam: chosen,
        odds: Number(b.odds),
        stake: b.stake,
        potential: calculatePayout(b.stake, Number(b.odds)),
        status: b.status,
        winner: b.winner,
        matchStatus: b.match_status,
        tossCloseTime: b.toss_close_time ? new Date(b.toss_close_time).toISOString() : undefined,
        canCancel,
        createdAt: new Date(b.created_at).toISOString(),
        settledAt: b.settled_at ? new Date(b.settled_at).toISOString() : null,
      };
    });

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ error: "Failed to load bets" });
  }
});

// Atomic bet cancellation with 2% fee deduction (98% wallet refund)
async function handleCancelBet(req: Request, res: Response, forceAdminMode = false) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const isAdmin = user.role === "admin";
  if (forceAdminMode && !isAdmin) {
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }
  if (!isAdmin && user.banned) {
    res.status(403).json({ error: "Account suspended. Contact support." });
    return;
  }

  const betId = Number(req.params.id);
  if (!Number.isInteger(betId) || betId <= 0) {
    res.status(400).json({ error: "Invalid bet ID" });
    return;
  }

  // Primary PostgreSQL path using Drizzle ORM atomic transaction
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [bet] = await tx
          .select()
          .from(betsTable)
          .where(eq(betsTable.id, betId))
          .for("update");

        if (!bet) {
          throw Object.assign(new Error("Bet not found"), { status: 404 });
        }
        if (!isAdmin && bet.userId !== user.id) {
          throw Object.assign(new Error("Forbidden: you can only cancel your own bets"), { status: 403 });
        }
        if (bet.status !== "pending") {
          throw Object.assign(new Error("Only pending bets can be cancelled"), { status: 400 });
        }

        const [match] = await tx
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, bet.matchId))
          .for("update");

        if (!match) {
          throw Object.assign(new Error("Associated match not found"), { status: 404 });
        }

        if (!isAdmin) {
          if (match.status !== "open") {
            throw Object.assign(new Error("Match is already settled; bet cannot be cancelled"), { status: 400 });
          }
          if (Date.now() >= new Date(match.tossCloseTime).getTime()) {
            throw Object.assign(
              new Error("Cancellation window closed: toss betting is suspended for this contest"),
              { status: 400 },
            );
          }
        }

        const [betOwner] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, bet.userId))
          .for("update");

        if (!betOwner) {
          throw Object.assign(new Error("Bet owner account not found"), { status: 404 });
        }

        const now = new Date();
        // Conditional transition guarantees single cancellation (no double refund)
        const [cancelledBet] = await tx
          .update(betsTable)
          .set({ status: "cancelled", settledAt: now })
          .where(and(eq(betsTable.id, betId), eq(betsTable.status, "pending")))
          .returning();

        if (!cancelledBet) {
          throw Object.assign(new Error("Bet has already been settled or cancelled"), { status: 400 });
        }

        const { stake, fee, refund } = calculateCancellationRefund(bet.stake, 2);

        const [updatedUser] = await tx
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${refund}` })
          .where(eq(usersTable.id, betOwner.id))
          .returning({ balance: usersTable.balance });

        const newBalance = updatedUser.balance;
        const chosenTeam = bet.selection === "A" ? match.teamA : match.teamB;

        await tx.insert(transactionsTable).values({
          userId: betOwner.id,
          amount: refund,
          balanceAfter: newBalance,
          type: "bet_cancelled",
          note: `Cancelled Bet #${bet.id}: ${match.league} (${match.teamA} vs ${match.teamB} - ${chosenTeam}) · Stake ${stake} Rs. - 2% fee (${fee} Rs.) = Refunded ${refund} Rs.${isAdmin && betOwner.id !== user.id ? " [By Admin]" : ""}`,
        });

        const [expoRow] = await tx
          .select({ total: sql<string>`COALESCE(SUM(${betsTable.stake}), 0)` })
          .from(betsTable)
          .where(and(eq(betsTable.userId, betOwner.id), eq(betsTable.status, "pending")));

        return {
          ok: true,
          betId: bet.id,
          status: "cancelled" as const,
          stake,
          fee,
          feePercent: 2,
          refunded: refund,
          balance: newBalance,
          exposure: Number(expoRow?.total ?? 0),
        };
      });

      res.json(outcome);
      return;
    } catch (err: any) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Failed to cancel bet" });
      return;
    }
  }

  // Local resilient atomic transaction fallback
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const betRes = await client.query(`SELECT * FROM bets WHERE id = $1 FOR UPDATE`, [betId]);
    const bet = betRes.rows[0];
    if (!bet) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Bet not found" });
      return;
    }
    if (!isAdmin && bet.user_id !== user.id) {
      await client.query("ROLLBACK");
      res.status(403).json({ error: "Forbidden: you can only cancel your own bets" });
      return;
    }
    if (bet.status !== "pending") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Only pending bets can be cancelled" });
      return;
    }

    const matchRes = await client.query(`SELECT * FROM matches WHERE id = $1 FOR UPDATE`, [bet.match_id]);
    const match = matchRes.rows[0];
    if (!match) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Associated match not found" });
      return;
    }

    if (!isAdmin) {
      if (match.status !== "open") {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Match is already settled; bet cannot be cancelled" });
        return;
      }
      if (Date.now() >= new Date(match.toss_close_time).getTime()) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Cancellation window closed: toss betting is suspended for this contest" });
        return;
      }
    }

    const userRes = await client.query(`SELECT * FROM users WHERE id = $1 FOR UPDATE`, [bet.user_id]);
    const betOwner = userRes.rows[0];
    if (!betOwner) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Bet owner account not found" });
      return;
    }

    const nowIso = new Date().toISOString();
    const cancelRes = await client.query(
      `UPDATE bets SET status = 'cancelled', settled_at = $1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [nowIso, betId],
    );
    if (cancelRes.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Bet has already been settled or cancelled" });
      return;
    }

    const { stake, fee, refund } = calculateCancellationRefund(bet.stake, 2);
    const updatedOwnerRes = await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
      [refund, betOwner.id],
    );
    const newBalance = updatedOwnerRes.rows[0]?.balance ?? betOwner.balance + refund;
    const chosenTeam = bet.selection === "A" ? match.team_a : match.team_b;

    await client.query(
      `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'bet_cancelled', $4)`,
      [
        betOwner.id,
        refund,
        newBalance,
        `Cancelled Bet #${bet.id}: ${match.league} (${match.team_a} vs ${match.team_b} - ${chosenTeam}) · Stake ${stake} Rs. - 2% fee (${fee} Rs.) = Refunded ${refund} Rs.${isAdmin && betOwner.id !== user.id ? " [By Admin]" : ""}`,
      ],
    );

    const expoRes = await client.query(
      `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
      [betOwner.id],
    );

    await client.query("COMMIT");
    res.json({
      ok: true,
      betId: bet.id,
      status: "cancelled",
      stake,
      fee,
      feePercent: 2,
      refunded: refund,
      balance: newBalance,
      exposure: Number(expoRes.rows[0]?.total ?? 0),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to cancel bet", detail: (err as Error).message });
  } finally {
    client.release();
  }
}

app.post("/api/bets/:id/cancel", async (req: Request, res: Response) => {
  await handleCancelBet(req, res, false);
});

app.post("/api/admin/bets/:id/cancel", requireAdmin, async (req: Request, res: Response) => {
  await handleCancelBet(req, res, true);
});

// Punter statement list
app.get("/api/transactions", async (req: Request, res: Response) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const resTx = await pgPool.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 120`,
      [user.id],
    );

    res.json(
      resTx.rows.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        balanceAfter: t.balance_after,
        type: t.type,
        note: t.note,
        createdAt: new Date(t.created_at).toISOString(),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

/* ==========================================================================
   ADMIN APIS
   ========================================================================== */

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }
  next();
}

app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const puntersRes = await pgPool.query(
      `SELECT count(*) as total, coalesce(sum(balance), 0) as coins, coalesce(sum(case when banned then 1 else 0 end), 0) as banned FROM users WHERE role = 'punter'`,
    );
    const betsRes = await pgPool.query(
      `SELECT count(*) as pending_cnt, coalesce(sum(stake), 0) as pending_stake FROM bets WHERE status = 'pending'`,
    );

    const matchesRes = await pgPool.query(`SELECT status, start_time, toss_close_time FROM matches WHERE status = 'open'`);
    const now = Date.now();

    const liveCount = matchesRes.rows.filter(
      (m: any) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "live",
    ).length;
    const scheduledCount = matchesRes.rows.filter(
      (m: any) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "scheduled",
    ).length;
    const lockedCount = matchesRes.rows.filter(
      (m: any) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "locked",
    ).length;

    res.json({
      totalPunters: Number(puntersRes.rows[0].total),
      coinsInCirculation: Number(puntersRes.rows[0].coins),
      bannedPunters: Number(puntersRes.rows[0].banned),
      pendingBets: Number(betsRes.rows[0].pending_cnt),
      pendingStakes: Number(betsRes.rows[0].pending_stake),
      liveMatches: liveCount,
      scheduledMatches: scheduledCount,
      lockedMatches: lockedCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// Admin matches list
app.get("/api/admin/matches", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await pgPool.query(`SELECT * FROM matches ORDER BY created_at DESC LIMIT 200`);
    const stakeRows = await pgPool.query(`
      SELECT match_id, coalesce(sum(stake), 0) as total, count(*) as cnt,
      coalesce(sum(case when status = 'pending' then stake else 0 end), 0) as pending
      FROM bets GROUP BY match_id
    `);
    const stakeMap = new Map(stakeRows.rows.map((r: any) => [r.match_id, r]));
    const now = Date.now();

    const dtos = rows.rows.map((m: any) => {
      const s = stakeMap.get(m.id);
      return {
        id: m.id,
        league: m.league,
        teamA: m.team_a,
        teamB: m.team_b,
        matchImg: m.match_img || null,
        teamAImg: m.team_a_img || null,
        teamBImg: m.team_b_img || null,
        startTime: new Date(m.start_time).toISOString(),
        tossCloseTime: new Date(m.toss_close_time).toISOString(),
        oddsA: Number(m.odds_a),
        oddsB: Number(m.odds_b),
        status: effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now),
        winner: m.winner,
        settledAt: m.settled_at ? new Date(m.settled_at).toISOString() : null,
        totalStaked: Number(s?.total ?? 0),
        betCount: Number(s?.cnt ?? 0),
        pendingStaked: Number(s?.pending ?? 0),
      };
    });

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ error: "Failed to load admin matches" });
  }
});

// Admin schedule match with Real Match Pic / PNG Upload
app.post("/api/admin/matches", requireAdmin, async (req: Request, res: Response) => {
  const { league, teamA, teamB, startTime, tossCloseTime, oddsA, oddsB, matchImg, teamAImg, teamBImg } = req.body || {};
  const l = (league ?? "").trim().toUpperCase();
  const tA = (teamA ?? "").trim();
  const tB = (teamB ?? "").trim();

  if (!l || !tA || !tB) {
    res.status(400).json({ error: "League and both team names are required" });
    return;
  }
  if (tA.toLowerCase() === tB.toLowerCase()) {
    res.status(400).json({ error: "Teams must be different" });
    return;
  }

  const start = new Date(startTime ?? "");
  const close = new Date(tossCloseTime ?? "");
  if (isNaN(start.getTime()) || isNaN(close.getTime())) {
    res.status(400).json({ error: "Invalid date format for match time or toss close time" });
    return;
  }

  const oA = Number(oddsA) || 1.95;
  const oB = Number(oddsB) || 1.95;

  try {
    const resMatch = await pgPool.query(
      `INSERT INTO matches (league, team_a, team_b, start_time, toss_close_time, odds_a, odds_b, match_img, team_a_img, team_b_img, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open') RETURNING *`,
      [l, tA, tB, start.toISOString(), close.toISOString(), oA, oB, matchImg || null, teamAImg || null, teamBImg || null],
    );

    res.json({ ok: true, match: resMatch.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to schedule match", detail: (err as Error).message });
  }
});

// Admin update match details (PNG banner, teams, timing, odds)
app.put("/api/admin/matches/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }
  const { league, teamA, teamB, startTime, tossCloseTime, oddsA, oddsB, matchImg } = req.body || {};

  try {
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (league) { sets.push(`league = $${idx++}`); vals.push(league.trim().toUpperCase()); }
    if (teamA) { sets.push(`team_a = $${idx++}`); vals.push(teamA.trim().toUpperCase()); }
    if (teamB) { sets.push(`team_b = $${idx++}`); vals.push(teamB.trim().toUpperCase()); }
    if (startTime) { sets.push(`start_time = $${idx++}`); vals.push(new Date(startTime).toISOString()); }
    if (tossCloseTime) { sets.push(`toss_close_time = $${idx++}`); vals.push(new Date(tossCloseTime).toISOString()); }
    if (oddsA !== undefined) { sets.push(`odds_a = $${idx++}`); vals.push(sanitizeOdds(oddsA)); }
    if (oddsB !== undefined) { sets.push(`odds_b = $${idx++}`); vals.push(sanitizeOdds(oddsB)); }
    if (matchImg !== undefined) { sets.push(`match_img = $${idx++}`); vals.push(matchImg || null); }

    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }

    vals.push(id);
    await pgPool.query(`UPDATE matches SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update match", detail: (err as Error).message });
  }
});

// Admin declare match winner / refund (Atomic Drizzle db.transaction + strict idempotency)
app.patch("/api/admin/matches/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { result } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }
  if (result !== "A" && result !== "B" && result !== "cancel") {
    res.status(400).json({ error: "Result must be 'A', 'B', or 'cancel'" });
    return;
  }

  // Primary PostgreSQL path using Drizzle ORM db.transaction
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, id))
          .for("update");

        if (!match) {
          throw Object.assign(new Error("Match not found"), { status: 404 });
        }
        if (match.status !== "open") {
          throw Object.assign(new Error("Match is already settled"), { status: 400 });
        }

        const now = new Date();
        // Atomic conditional status transition guarantees idempotency (no double-payouts)
        const [lockedMatch] = await tx
          .update(matchesTable)
          .set(
            result === "cancel"
              ? { status: "cancelled", winner: null, settledAt: now }
              : { status: "finished", winner: result, settledAt: now },
          )
          .where(and(eq(matchesTable.id, id), eq(matchesTable.status, "open")))
          .returning();

        if (!lockedMatch) {
          throw Object.assign(new Error("Match is already settled"), { status: 400 });
        }

        const pendingBets = await tx
          .select()
          .from(betsTable)
          .where(and(eq(betsTable.matchId, id), eq(betsTable.status, "pending")))
          .for("update");

        let credited = 0;
        let refunded = 0;
        let winners = 0;

        if (result === "cancel") {
          for (const bet of pendingBets) {
            const stakeAmt = Math.round(Number(bet.stake));
            const [updatedUser] = await tx
              .update(usersTable)
              .set({ balance: sql`${usersTable.balance} + ${stakeAmt}` })
              .where(eq(usersTable.id, bet.userId))
              .returning({ balance: usersTable.balance });

            await tx.insert(transactionsTable).values({
              userId: bet.userId,
              amount: stakeAmt,
              balanceAfter: updatedUser ? updatedUser.balance : stakeAmt,
              type: "refund",
              note: `Refund: ${match.league} - ${match.teamA} vs ${match.teamB} (contest cancelled)`,
            });

            await tx
              .update(betsTable)
              .set({ status: "refunded", settledAt: now })
              .where(and(eq(betsTable.id, bet.id), eq(betsTable.status, "pending")));

            refunded += stakeAmt;
          }
        } else {
          const winnerName = result === "A" ? match.teamA : match.teamB;

          for (const bet of pendingBets) {
            if (bet.selection === result) {
              const credit = calculatePayout(bet.stake, Number(bet.odds));
              const [updatedUser] = await tx
                .update(usersTable)
                .set({ balance: sql`${usersTable.balance} + ${credit}` })
                .where(eq(usersTable.id, bet.userId))
                .returning({ balance: usersTable.balance });

              await tx.insert(transactionsTable).values({
                userId: bet.userId,
                amount: credit,
                balanceAfter: updatedUser ? updatedUser.balance : credit,
                type: "win",
                note: `Win credit: ${match.league} - backed ${winnerName} @ ${Number(bet.odds).toFixed(2)}x (stake ${bet.stake})`,
              });

              await tx
                .update(betsTable)
                .set({ status: "won", settledAt: now })
                .where(and(eq(betsTable.id, bet.id), eq(betsTable.status, "pending")));

              credited += credit;
              winners += 1;
            } else {
              const [uRow] = await tx
                .select({ balance: usersTable.balance })
                .from(usersTable)
                .where(eq(usersTable.id, bet.userId))
                .for("update");

              const backedName = bet.selection === "A" ? match.teamA : match.teamB;
              await tx.insert(transactionsTable).values({
                userId: bet.userId,
                amount: 0,
                balanceAfter: uRow ? uRow.balance : 0,
                type: "loss",
                note: `Loss settled: ${match.league} - backed ${backedName}, winner ${winnerName} (stake ${bet.stake})`,
              });

              await tx
                .update(betsTable)
                .set({ status: "lost", settledAt: now })
                .where(and(eq(betsTable.id, bet.id), eq(betsTable.status, "pending")));
            }
          }
        }

        return { ok: true, credited, refunded, winners, settled: pendingBets.length };
      });

      res.json(outcome);
      return;
    } catch (err: any) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Settlement failed" });
      return;
    }
  }

  // Local resilient atomic transaction fallback
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const mRes = await client.query(`SELECT * FROM matches WHERE id = $1 FOR UPDATE`, [id]);
    const match = mRes.rows[0];

    if (!match) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (match.status !== "open") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Match is already settled" });
      return;
    }

    const now = new Date().toISOString();
    const lockRes =
      result === "cancel"
        ? await client.query(
            `UPDATE matches SET status = 'cancelled', winner = null, settled_at = $1 WHERE id = $2 AND status = 'open' RETURNING *`,
            [now, id],
          )
        : await client.query(
            `UPDATE matches SET status = 'finished', winner = $1, settled_at = $2 WHERE id = $3 AND status = 'open' RETURNING *`,
            [result, now, id],
          );

    if (lockRes.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Match is already settled" });
      return;
    }

    const pendingBets = await client.query(
      `SELECT * FROM bets WHERE match_id = $1 AND status = 'pending' FOR UPDATE`,
      [id],
    );

    let credited = 0;
    let refunded = 0;
    let winners = 0;

    if (result === "cancel") {
      for (const bet of pendingBets.rows) {
        const stakeAmt = Math.round(Number(bet.stake));
        const u = await client.query(
          `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
          [stakeAmt, bet.user_id],
        );
        const balAfter = u.rows[0]?.balance ?? stakeAmt;
        await client.query(
          `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'refund', $4)`,
          [
            bet.user_id,
            stakeAmt,
            balAfter,
            `Refund: ${match.league} - ${match.team_a} vs ${match.team_b} (contest cancelled)`,
          ],
        );
        await client.query(`UPDATE bets SET status = 'refunded', settled_at = $1 WHERE id = $2`, [now, bet.id]);
        refunded += stakeAmt;
      }
    } else {
      const winnerName = result === "A" ? match.team_a : match.team_b;

      for (const bet of pendingBets.rows) {
        if (bet.selection === result) {
          const credit = calculatePayout(bet.stake, Number(bet.odds));
          const u = await client.query(
            `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
            [credit, bet.user_id],
          );
          const balAfter = u.rows[0]?.balance ?? credit;
          await client.query(
            `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'win', $4)`,
            [
              bet.user_id,
              credit,
              balAfter,
              `Win credit: ${match.league} - backed ${winnerName} @ ${Number(bet.odds).toFixed(2)}x (stake ${bet.stake})`,
            ],
          );
          await client.query(`UPDATE bets SET status = 'won', settled_at = $1 WHERE id = $2`, [now, bet.id]);
          credited += credit;
          winners++;
        } else {
          const u = await client.query(`SELECT balance FROM users WHERE id = $1`, [bet.user_id]);
          const balAfter = u.rows[0]?.balance ?? 0;
          const backedName = bet.selection === "A" ? match.team_a : match.team_b;
          await client.query(
            `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'loss', $4)`,
            [
              bet.user_id,
              0,
              balAfter,
              `Loss settled: ${match.league} - backed ${backedName}, winner ${winnerName} (stake ${bet.stake})`,
            ],
          );
          await client.query(`UPDATE bets SET status = 'lost', settled_at = $1 WHERE id = $2`, [now, bet.id]);
        }
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, credited, refunded, winners, settled: pendingBets.rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Settlement failed", detail: (err as Error).message });
  } finally {
    client.release();
  }
});

// Admin delete match
app.delete("/api/admin/matches/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const cnt = await pgPool.query(`SELECT count(*) as count FROM bets WHERE match_id = $1`, [id]);
  if (Number(cnt.rows[0].count) > 0) {
    res.status(400).json({ error: "Cannot delete match with placed bets" });
    return;
  }
  await pgPool.query(`DELETE FROM matches WHERE id = $1`, [id]);
  res.json({ ok: true });
});

// Admin match bets overview
app.get("/api/admin/matches/:id/bets", requireAdmin, async (req: Request, res: Response) => {
  const matchId = Number(req.params.id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }

  try {
    const mRes = await pgPool.query(`SELECT * FROM matches WHERE id = $1 LIMIT 1`, [matchId]);
    const m = mRes.rows[0];
    if (!m) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    const betsRows =
      resilientDb.isUsingPostgres() && db
        ? await db
            .select({
              id: betsTable.id,
              userId: betsTable.userId,
              matchId: betsTable.matchId,
              selection: betsTable.selection,
              odds: betsTable.odds,
              stake: betsTable.stake,
              status: betsTable.status,
              createdAt: betsTable.createdAt,
              settledAt: betsTable.settledAt,
              username: usersTable.username,
              phone: usersTable.phone,
            })
            .from(betsTable)
            .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
            .where(eq(betsTable.matchId, matchId))
            .orderBy(desc(betsTable.id))
        : (
            await pgPool.query(
              `SELECT b.*, u.username, u.phone FROM bets b JOIN users u ON b.user_id = u.id WHERE b.match_id = $1 ORDER BY b.id DESC`,
              [matchId],
            )
          ).rows;

    const bets = betsRows.map((b: any) => {
      const sel = b.selection === "B" ? "B" : "A";
      const oddsVal = Number(b.odds);
      const stakeVal = Number(b.stake);
      return {
        id: b.id,
        userId: b.userId ?? b.user_id,
        username: b.username,
        phone: b.phone ?? null,
        selection: sel as "A" | "B",
        selectionTeam: sel === "A" ? m.team_a : m.team_b,
        odds: oddsVal,
        stake: stakeVal,
        potential: calculatePayout(stakeVal, oddsVal),
        status: b.status,
        createdAt: new Date(b.createdAt ?? b.created_at).toISOString(),
        settledAt: b.settledAt || b.settled_at ? new Date(b.settledAt ?? b.settled_at).toISOString() : null,
      };
    });

    const summary = bets.reduce(
      (acc, b) => {
        acc.totalBets += 1;
        acc.totalStaked += b.stake;
        if (b.status === "pending") acc.pendingStaked += b.stake;
        if (b.status !== "cancelled" && b.status !== "refunded") {
          if (b.selection === "A") acc.teamAStaked += b.stake;
          else acc.teamBStaked += b.stake;
        }
        return acc;
      },
      { totalBets: 0, totalStaked: 0, pendingStaked: 0, teamAStaked: 0, teamBStaked: 0 },
    );

    res.json({
      match: {
        id: m.id,
        league: m.league,
        teamA: m.team_a,
        teamB: m.team_b,
        matchImg: m.match_img || null,
        startTime: new Date(m.start_time).toISOString(),
        tossCloseTime: new Date(m.toss_close_time).toISOString(),
        oddsA: Number(m.odds_a),
        oddsB: Number(m.odds_b),
        status: effectiveMatchStatus(m.status, m.start_time, m.toss_close_time),
        winner: m.winner,
        settledAt: m.settled_at ? new Date(m.settled_at).toISOString() : null,
        createdAt: new Date(m.created_at).toISOString(),
      },
      bets,
      summary,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load match bets", detail: (err as Error).message });
  }
});

// Admin search punters
app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const q = String(req.query.search ?? "").trim().toLowerCase();
  try {
    let sqlStr = `
      SELECT u.id, u.username, u.phone, u.balance, u.banned, u.created_at,
             COALESCE((SELECT SUM(b.stake) FROM bets b WHERE b.user_id = u.id AND b.status = 'pending'), 0) as exposure,
             COALESCE((SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id AND b.status = 'pending'), 0) as pending_bets,
             COALESCE((SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id), 0) as total_bets,
             COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = u.id AND t.type = 'admin_credit'), 0) as total_deposited,
             COALESCE((SELECT SUM(ABS(t.amount)) FROM transactions t WHERE t.user_id = u.id AND t.type = 'admin_debit'), 0) as total_withdrawn
      FROM users u
      WHERE u.role = 'punter'
    `;
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      sqlStr += ` AND (LOWER(u.username) LIKE $1 OR u.phone LIKE $1)`;
    }
    sqlStr += ` ORDER BY u.id DESC LIMIT 250`;

    const resUsers = await pgPool.query(sqlStr, params);

    res.json(
      resUsers.rows.map((u: any) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        balance: u.balance,
        banned: u.banned,
        createdAt: new Date(u.created_at).toISOString(),
        exposure: Number(u.exposure),
        pendingBets: Number(u.pending_bets),
        totalBets: Number(u.total_bets ?? u.pending_bets ?? 0),
        totalDeposited: Number(u.total_deposited),
        totalWithdrawn: Number(u.total_withdrawn),
      })),
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to search users" });
  }
});

// Admin single punter complete breakdown (profile metrics, active/past bets, full transaction history)
app.get("/api/admin/users/:id/details", requireAdmin, async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const userRes = await pgPool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
    const u = userRes.rows[0];
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const betRows =
      resilientDb.isUsingPostgres() && db
        ? await db
            .select({
              id: betsTable.id,
              matchId: betsTable.matchId,
              selection: betsTable.selection,
              odds: betsTable.odds,
              stake: betsTable.stake,
              status: betsTable.status,
              createdAt: betsTable.createdAt,
              settledAt: betsTable.settledAt,
              league: matchesTable.league,
              teamA: matchesTable.teamA,
              teamB: matchesTable.teamB,
              matchStatus: matchesTable.status,
              tossCloseTime: matchesTable.tossCloseTime,
              winner: matchesTable.winner,
            })
            .from(betsTable)
            .innerJoin(matchesTable, eq(betsTable.matchId, matchesTable.id))
            .where(eq(betsTable.userId, userId))
            .orderBy(desc(betsTable.id))
            .limit(200)
        : (
            await pgPool.query(
              `SELECT b.*, m.league, m.team_a, m.team_b, m.status as match_status, m.toss_close_time, m.winner
               FROM bets b
               JOIN matches m ON b.match_id = m.id
               WHERE b.user_id = $1
               ORDER BY b.id DESC LIMIT 200`,
              [userId],
            )
          ).rows;

    const txRows =
      resilientDb.isUsingPostgres() && db
        ? await db
            .select()
            .from(transactionsTable)
            .where(eq(transactionsTable.userId, userId))
            .orderBy(desc(transactionsTable.id))
            .limit(200)
        : (
            await pgPool.query(
              `SELECT * FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 120`,
              [userId],
            )
          ).rows;

    const bets = betRows.map((b: any) => {
      const sel = b.selection === "B" ? "B" : "A";
      const teamA = b.teamA ?? b.team_a;
      const teamB = b.teamB ?? b.team_b;
      const oddsVal = Number(b.odds);
      const stakeVal = Number(b.stake);
      return {
        id: b.id,
        matchId: b.matchId ?? b.match_id,
        league: b.league,
        teamA,
        teamB,
        selection: sel as "A" | "B",
        selectionTeam: sel === "A" ? teamA : teamB,
        odds: oddsVal,
        stake: stakeVal,
        potential: calculatePayout(stakeVal, oddsVal),
        status: b.status,
        winner: b.winner ?? null,
        matchStatus: b.matchStatus ?? b.match_status,
        tossCloseTime: b.tossCloseTime || b.toss_close_time ? new Date(b.tossCloseTime ?? b.toss_close_time).toISOString() : undefined,
        canCancel: b.status === "pending",
        createdAt: new Date(b.createdAt ?? b.created_at).toISOString(),
        settledAt: b.settledAt || b.settled_at ? new Date(b.settledAt ?? b.settled_at).toISOString() : null,
      };
    });

    const transactions = txRows.map((t: any) => ({
      id: t.id,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter ?? t.balance_after),
      type: t.type,
      note: t.note ?? null,
      createdAt: new Date(t.createdAt ?? t.created_at).toISOString(),
    }));

    let exposure = 0;
    let pendingBets = 0;
    let totalStaked = 0;
    let settledBetsCount = 0;
    let cancelledBetsCount = 0;

    for (const b of bets) {
      totalStaked += b.stake;
      if (b.status === "pending") {
        exposure += b.stake;
        pendingBets += 1;
      } else if (b.status === "cancelled") {
        cancelledBetsCount += 1;
      } else {
        settledBetsCount += 1;
      }
    }

    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalWonCredited = 0;

    for (const t of transactions) {
      if (t.type === "admin_credit") totalDeposited += t.amount;
      else if (t.type === "admin_debit") totalWithdrawn += Math.abs(t.amount);
      else if (t.type === "win") totalWonCredited += t.amount;
    }

    res.json({
      user: {
        id: u.id,
        username: u.username,
        phone: u.phone ?? null,
        balance: Number(u.balance),
        banned: Boolean(u.banned),
        createdAt: new Date(u.created_at).toISOString(),
        exposure,
        pendingBets,
        totalBets: bets.length,
        totalDeposited,
        totalWithdrawn,
        totalStaked,
        totalWonCredited,
        totalBetsCount: bets.length,
        settledBetsCount,
        cancelledBetsCount,
      },
      bets,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load user details", detail: (err as Error).message });
  }
});

// Admin create punter ID (Robust & Flexible)
app.post("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const { username, password, phone, initialBalance } = req.body || {};
  const u = (username ?? "").trim();
  const p = password ?? "";
  const ph = (phone ?? "").trim() || null;
  const startBal = Math.max(0, Math.floor(Number(initialBalance) || 0));

  if (u.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }
  if (p.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  try {
    const existing = await pgPool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [u]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "USERNAME_TAKEN" });
      return;
    }

    const pHash = hashPassword(p);
    const created = await pgPool.query(
      `INSERT INTO users (username, password_hash, phone, role, balance, banned) VALUES ($1, $2, $3, 'punter', $4, false) RETURNING *`,
      [u, pHash, ph, startBal],
    );

    if (startBal > 0) {
      await pgPool.query(
        `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'admin_credit', 'Initial coin credit on ID creation')`,
        [created.rows[0].id, startBal, startBal],
      );
    }

    res.json({
      ok: true,
      user: {
        id: created.rows[0].id,
        username: created.rows[0].username,
        phone: created.rows[0].phone,
        balance: created.rows[0].balance,
        banned: created.rows[0].banned,
        createdAt: created.rows[0].created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create punter", detail: (err as Error).message });
  }
});

// Admin wallet add/deduct & ban/unban
app.patch("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { action, mode, amount, note, banned } = req.body || {};

  try {
    if (action === "ban") {
      const isBanned = Boolean(banned);
      await pgPool.query(`UPDATE users SET banned = $1 WHERE id = $2`, [isBanned, id]);
      res.json({ ok: true, banned: isBanned });
      return;
    }

    if (action === "wallet") {
      const isAdd = mode !== "deduct";
      const amt = sanitizeStake(amount);
      if (amt <= 0) {
        res.status(400).json({ error: "Enter a valid positive amount" });
        return;
      }

      if (resilientDb.isUsingPostgres() && db) {
        const outcome = await db.transaction(async (tx) => {
          const [targetUser] = await tx
            .select({ balance: usersTable.balance, role: usersTable.role })
            .from(usersTable)
            .where(eq(usersTable.id, id))
            .for("update");

          if (!targetUser) {
            throw Object.assign(new Error("User not found"), { status: 404 });
          }
          if (!isAdd && targetUser.balance < amt) {
            throw Object.assign(new Error("Amount exceeds punter's balance"), { status: 400 });
          }

          const delta = isAdd ? amt : -amt;
          const [updated] = await tx
            .update(usersTable)
            .set({ balance: sql`${usersTable.balance} + ${delta}` })
            .where(eq(usersTable.id, id))
            .returning({ balance: usersTable.balance });

          const newBalance = updated.balance;
          await tx.insert(transactionsTable).values({
            userId: id,
            amount: delta,
            balanceAfter: newBalance,
            type: isAdd ? "admin_credit" : "admin_debit",
            note: note || (isAdd ? "Admin deposit / coin load" : "Admin withdrawal / payout debit"),
          });

          return { ok: true, balance: newBalance };
        });

        res.json(outcome);
        return;
      }

      const client = await pgPool.connect();
      try {
        await client.query("BEGIN");
        const uRes = await client.query(`SELECT balance, role FROM users WHERE id = $1 FOR UPDATE`, [id]);
        const user = uRes.rows[0];

        if (!user) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "User not found" });
          return;
        }

        if (!isAdd && user.balance < amt) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Amount exceeds punter's balance" });
          return;
        }

        const delta = isAdd ? amt : -amt;
        const newBalance = user.balance + delta;

        await client.query(`UPDATE users SET balance = $1 WHERE id = $2`, [newBalance, id]);
        await client.query(
          `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            delta,
            newBalance,
            isAdd ? "admin_credit" : "admin_debit",
            note || (isAdd ? "Admin deposit / coin load" : "Admin withdrawal / payout debit"),
          ],
        );

        await client.query("COMMIT");
        res.json({ ok: true, balance: newBalance });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    res.status(status).json({ error: err?.message || "Action failed" });
  }
});

// Admin auto-generate username and password
app.get("/api/admin/users/generate", requireAdmin, async (_req: Request, res: Response) => {
  try {
    let username = "";
    for (let i = 0; i < 40; i++) {
      const candidate = generateUsernameCandidate();
      const existing = await pgPool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [candidate]);
      if (existing.rows.length === 0) {
        username = candidate;
        break;
      }
    }
    if (!username) username = `devil${Math.floor(1000 + Math.random() * 9000)}`;
    res.json({ username, password: generatePassword() });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate credentials" });
  }
});

// Admin verify / check username availability
app.get("/api/admin/users/check", requireAdmin, async (req: Request, res: Response) => {
  const u = String(req.query.username || "").trim();
  if (!u) {
    res.status(400).json({ error: "Username required" });
    return;
  }
  try {
    const existing = await pgPool.query(`SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`, [u]);
    const available = existing.rows.length === 0;
    res.json({ username: u, available, exists: !available });
  } catch (err) {
    res.status(500).json({ error: "Failed to check username" });
  }
});

// Admin settings get
app.get("/api/admin/settings", requireAdmin, async (_req: Request, res: Response) => {
  const s = await getPublicSettings();
  res.json(s);
});

// Admin settings update (controls Marquee text, freeze, links, limits, deposit/withdraw tg links)
app.patch("/api/admin/settings", requireAdmin, async (req: Request, res: Response) => {
  const {
    marketFrozen,
    websiteUrl,
    telegramUrl,
    telegramChannelUrl,
    telegramGroupUrl,
    depositTelegramUrl,
    withdrawTelegramUrl,
    supportUrl,
    getNewIdUrl,
    userWelcomeTemplate,
    matchScheduleBanner,
    marqueeText,
    minBet,
    minWithdraw,
    referralBonus,
  } = req.body || {};

  try {
    const upserts: [string, string][] = [];

    if (typeof marketFrozen === "boolean") upserts.push(["marketFrozen", String(marketFrozen)]);
    if (typeof websiteUrl === "string") upserts.push(["websiteUrl", websiteUrl.trim()]);
    if (typeof telegramUrl === "string") upserts.push(["telegramUrl", telegramUrl.trim()]);
    if (typeof telegramChannelUrl === "string") upserts.push(["telegramChannelUrl", telegramChannelUrl.trim()]);
    if (typeof telegramGroupUrl === "string") upserts.push(["telegramGroupUrl", telegramGroupUrl.trim()]);
    if (typeof depositTelegramUrl === "string") upserts.push(["depositTelegramUrl", depositTelegramUrl.trim()]);
    if (typeof withdrawTelegramUrl === "string") upserts.push(["withdrawTelegramUrl", withdrawTelegramUrl.trim()]);
    if (typeof supportUrl === "string") upserts.push(["supportUrl", supportUrl.trim()]);
    if (typeof getNewIdUrl === "string") upserts.push(["getNewIdUrl", getNewIdUrl.trim()]);
    if (typeof userWelcomeTemplate === "string") upserts.push(["userWelcomeTemplate", userWelcomeTemplate]);
    if (typeof matchScheduleBanner === "string") upserts.push(["matchScheduleBanner", matchScheduleBanner.trim()]);
    if (typeof marqueeText === "string") upserts.push(["marqueeText", marqueeText.trim()]);
    if (minBet !== undefined) upserts.push(["minBet", String(Math.max(1, Number(minBet)))]);
    if (minWithdraw !== undefined) upserts.push(["minWithdraw", String(Math.max(1, Number(minWithdraw)))]);
    if (referralBonus !== undefined) upserts.push(["referralBonus", String(Math.max(0, Number(referralBonus)))]);

    for (const [k, v] of upserts) {
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, v],
      );
    }

    res.json({ ok: true, settings: await getPublicSettings() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/* ==========================================================================
   VITE DEV SERVER MOUNT
   ========================================================================== */

async function startServer() {
  await ensureDbReady();

  const distPath = path.resolve("./dist");
  const hasDist = fs.existsSync(path.resolve(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || hasDist;

  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api") || req.path === "/health") {
        return next();
      }
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("Vite middleware failed, falling back to static files:", (err as Error).message);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get("*", (_req: Request, res: Response) => {
          res.sendFile(path.resolve(distPath, "index.html"));
        });
      }
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, HOST, () => {
      const dbMode = resilientDb.isUsingPostgres() ? "Neon PostgreSQL" : "Local Resilient Store (Active)";
      console.log(`\n👑 TOSS BOOK 786 Server running at http://${HOST}:${PORT}`);
      console.log(`   - Connected Database: ${dbMode}`);
      console.log(`   - Super Admin: ${ADMIN_USERNAME}`);
    });
  }
}

if (process.env.TEST_MODE !== "true" && !process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Server start error:", err);
    process.exit(1);
  });
}

export default app;
