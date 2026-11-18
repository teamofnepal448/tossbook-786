import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function buildConnectionString(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;

  const isLocal = /@(127\.0\.0\.1|localhost)(:|\/|$)/.test(raw);
  if (isLocal || /[?&]sslmode=/i.test(raw)) {
    return raw;
  }

  return raw.includes("?") ? `${raw}&sslmode=require` : `${raw}?sslmode=require`;
}

const connectionString = buildConnectionString();
const isLocal = connectionString
  ? /@(127\.0\.0\.1|localhost)(:|\/|$)/.test(connectionString)
  : false;

const globalForDb = globalThis as typeof globalThis & {
  __tossbookPool?: Pool;
};

export const pool =
  globalForDb.__tossbookPool ??
  new Pool({
    connectionString,
    max: process.env.VERCEL ? 5 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });

globalForDb.__tossbookPool = pool;

export const db = drizzle(pool, { schema });
