var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { and, desc, eq, sql } from "drizzle-orm";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bets: () => bets,
  matches: () => matches,
  settings: () => settings,
  transactions: () => transactions,
  users: () => users
});
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("punter"),
  balance: integer("balance").notNull().default(0),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  league: text("league").notNull(),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  tossCloseTime: timestamp("toss_close_time", { withTimezone: true }).notNull(),
  oddsA: numeric("odds_a", { precision: 8, scale: 2 }).notNull().default("1.95"),
  oddsB: numeric("odds_b", { precision: 8, scale: 2 }).notNull().default("1.95"),
  status: text("status").notNull().default("open"),
  winner: text("winner"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  teamAImg: text("team_a_img"),
  teamBImg: text("team_b_img"),
  matchImg: text("match_img"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  matchId: integer("match_id").notNull().references(() => matches.id),
  selection: text("selection").notNull(),
  odds: numeric("odds", { precision: 8, scale: 2 }).notNull(),
  stake: integer("stake").notNull(),
  status: text("status").notNull().default("pending"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  type: text("type").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull()
});

// src/db/index.ts
function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return void 0;
  const isLocal2 = /@(127\.0\.0\.1|localhost)(:|\/|$)/.test(raw);
  if (isLocal2 || /[?&]sslmode=/i.test(raw)) {
    return raw;
  }
  return raw.includes("?") ? `${raw}&sslmode=require` : `${raw}?sslmode=require`;
}
var connectionString = getDatabaseUrl();
var isLocal = connectionString ? /@(127\.0\.0\.1|localhost)(:|\/|$)/.test(connectionString) : false;
var globalForDb = globalThis;
function createPgPool() {
  if (!connectionString) return null;
  if (!globalForDb.__neonPgPool) {
    globalForDb.__neonPgPool = new Pool({
      connectionString,
      max: process.env.VERCEL ? 5 : 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4,
      ...isLocal ? {} : { ssl: { rejectUnauthorized: false } }
    });
  }
  return globalForDb.__neonPgPool;
}
var pool = createPgPool();
var db = pool ? drizzle(pool, { schema: schema_exports }) : null;

// src/lib/resilient-db.ts
import fs from "fs";
import path from "path";
function splitSqlList(expr) {
  const out = [];
  let cur = "";
  let inQuote = false;
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "'" && expr[i - 1] !== "\\") {
      inQuote = !inQuote;
      cur += ch;
    } else if (!inQuote) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function resolveValueExpr(valExpr, params) {
  const trimmed = valExpr.trim();
  const paramMatch = trimmed.match(/^\$(\d+)$/);
  if (paramMatch) {
    return params[Number(paramMatch[1]) - 1];
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  if (trimmed.toLowerCase() === "null") return null;
  if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);
  return trimmed;
}
var ResilientDatabase = class {
  constructor() {
    this.pgPool = null;
    this.isPgAvailable = false;
    this.saveTimeout = null;
    this.txMutex = Promise.resolve();
    this.txSnapshot = null;
    this.dataDir = path.resolve("./data");
    this.dataFilePath = path.join(this.dataDir, "tossbook_store.json");
    this.localData = this.loadLocalData();
    try {
      this.pgPool = createPgPool();
      if (this.pgPool) {
        this.pgPool.on("error", (err) => {
          console.warn("[ResilientDB] PostgreSQL idle client error (fallback active):", err.message);
          this.isPgAvailable = false;
        });
      }
    } catch (err) {
      console.warn("[ResilientDB] Failed to init PG pool, using local store:", err.message);
      this.pgPool = null;
    }
  }
  loadLocalData() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.matches)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("[ResilientDB] Could not read local store, starting with defaults:", e.message);
    }
    return {
      users: [],
      matches: [],
      bets: [],
      transactions: [],
      settings: {},
      nextUserId: 1,
      nextMatchId: 1,
      nextBetId: 1,
      nextTxId: 1
    };
  }
  saveLocalDataSync() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.localData, null, 2), "utf-8");
    } catch (e) {
      console.error("[ResilientDB] Failed to write local store:", e.message);
    }
  }
  scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveLocalDataSync();
    }, 100);
  }
  async checkConnection() {
    if (!this.pgPool) {
      this.isPgAvailable = false;
      return false;
    }
    try {
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("PG connection timeout")), 5e3)
      );
      await Promise.race([this.pgPool.query("SELECT 1"), timeoutPromise]);
      this.isPgAvailable = true;
      return true;
    } catch (err) {
      console.warn("[ResilientDB] PostgreSQL check failed, using persistent local store:", err.message);
      this.isPgAvailable = false;
      return false;
    }
  }
  isUsingPostgres() {
    return this.isPgAvailable;
  }
  async end() {
    if (this.pgPool) {
      try {
        await this.pgPool.end();
      } catch {
      }
    }
  }
  async query(sql2, params = []) {
    if (this.isPgAvailable && this.pgPool) {
      try {
        const res = await this.pgPool.query(sql2, params);
        return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
      } catch (err) {
        console.warn("[ResilientDB] PG query error, falling back to local store:", err.message);
        this.isPgAvailable = false;
      }
    }
    return this.executeLocalQuery(sql2, params);
  }
  async connect() {
    if (this.isPgAvailable && this.pgPool) {
      try {
        const client = await this.pgPool.connect();
        return {
          query: async (sql2, params) => {
            const res = await client.query(sql2, params);
            return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
          },
          release: () => client.release()
        };
      } catch (err) {
        console.warn("[ResilientDB] PG client connect error, falling back to local store:", err.message);
        this.isPgAvailable = false;
      }
    }
    let releaseLock;
    const prev = this.txMutex;
    this.txMutex = new Promise((res) => {
      releaseLock = res;
    });
    await prev;
    let released = false;
    return {
      query: async (sql2, params) => this.executeLocalQuery(sql2, params || []),
      release: () => {
        if (!released) {
          released = true;
          this.txSnapshot = null;
          releaseLock();
        }
      }
    };
  }
  executeLocalQuery(sql2, params) {
    const s = sql2.trim();
    const upper = s.toUpperCase();
    if (upper === "BEGIN") {
      this.txSnapshot = JSON.stringify(this.localData);
      return { rows: [], rowCount: 0 };
    }
    if (upper === "COMMIT") {
      this.txSnapshot = null;
      this.saveLocalDataSync();
      return { rows: [], rowCount: 0 };
    }
    if (upper === "ROLLBACK") {
      if (this.txSnapshot) {
        try {
          this.localData = JSON.parse(this.txSnapshot);
        } catch {
        }
        this.txSnapshot = null;
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^SELECT\s+1(\s+as\s+\w+)?/i.test(s)) {
      return { rows: [{ live: 1 }], rowCount: 1 };
    }
    if (upper.startsWith("CREATE TABLE") || upper.startsWith("CREATE INDEX") || upper.startsWith("ALTER TABLE")) {
      return { rows: [], rowCount: 0 };
    }
    if (s.includes("information_schema.tables")) {
      return {
        rows: [
          { table_name: "users" },
          { table_name: "matches" },
          { table_name: "bets" },
          { table_name: "transactions" },
          { table_name: "settings" }
        ],
        rowCount: 5
      };
    }
    if (upper.startsWith("SELECT VALUE FROM SETTINGS WHERE KEY =")) {
      let key = "";
      const match = s.match(/WHERE\s+key\s*=\s*'([^']+)'/i);
      if (match) {
        key = match[1];
      } else if (params[0]) {
        key = String(params[0]);
      }
      const val = this.localData.settings[key];
      return {
        rows: val !== void 0 ? [{ value: val }] : [],
        rowCount: val !== void 0 ? 1 : 0
      };
    }
    if (upper.includes("FROM SETTINGS")) {
      const rows = Object.entries(this.localData.settings).map(([key, value]) => ({ key, value }));
      return { rows, rowCount: rows.length };
    }
    if (upper.startsWith("INSERT INTO SETTINGS")) {
      let key = "";
      let value = "";
      const keyMatch = s.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*\$1\s*\)/i);
      if (keyMatch) {
        key = keyMatch[1];
        value = String(params[0]);
      } else {
        key = String(params[0]);
        value = String(params[1]);
      }
      if (upper.includes("DO NOTHING")) {
        if (!(key in this.localData.settings)) {
          this.localData.settings[key] = value;
          this.scheduleSave();
        }
      } else {
        this.localData.settings[key] = value;
        this.scheduleSave();
      }
      return { rows: [], rowCount: 1 };
    }
    if (/FROM\s+users\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const id = Number(params[0]);
      const u = this.localData.users.find((x) => x.id === id);
      return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
    }
    if (/FROM\s+users\s+WHERE\s+LOWER\(username\)\s*=\s*LOWER\(\$1\)/i.test(s)) {
      const uname = String(params[0] ?? "").toLowerCase();
      const u = this.localData.users.find((x) => x.username.toLowerCase() === uname);
      return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
    }
    if (/FROM\s+users\s+WHERE\s+role\s*=\s*'admin'/i.test(s)) {
      const u = this.localData.users.find((x) => x.role === "admin");
      return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
    }
    if (/FROM\s+users\s+WHERE\s+username\s*=\s*'DEMO1'/i.test(s)) {
      const u = this.localData.users.find((x) => x.username === "DEMO1");
      return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
    }
    if (upper.startsWith("INSERT INTO USERS")) {
      const parenMatch = s.match(/INSERT\s+INTO\s+users\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      let uname = "";
      let pw = "";
      let role = "punter";
      let bal = 0;
      let phone = null;
      let banned = false;
      if (parenMatch) {
        const cols = splitSqlList(parenMatch[1]).map((c) => c.toLowerCase());
        const vals = splitSqlList(parenMatch[2]);
        for (let i = 0; i < cols.length; i++) {
          const col = cols[i];
          const val = resolveValueExpr(vals[i], params);
          if (col === "username") uname = String(val);
          else if (col === "password_hash") pw = String(val);
          else if (col === "role") role = val === "admin" ? "admin" : "punter";
          else if (col === "balance") bal = Number(val || 0);
          else if (col === "phone") phone = val ? String(val) : null;
          else if (col === "banned") banned = Boolean(val);
        }
      }
      const newUser = {
        id: this.localData.nextUserId++,
        username: uname,
        password_hash: pw,
        phone,
        role,
        balance: bal,
        banned,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.localData.users.push(newUser);
      this.scheduleSave();
      return { rows: [{ ...newUser }], rowCount: 1 };
    }
    if (upper.startsWith("UPDATE USERS")) {
      const relBalMatch = s.match(/SET\s+balance\s*=\s*balance\s*([+-])\s*(\d+|\$\d+)\s+WHERE\s+id\s*=\s*\$(\d+)/i);
      if (relBalMatch) {
        const sign = relBalMatch[1] === "+" ? 1 : -1;
        let amount = 0;
        if (relBalMatch[2].startsWith("$")) {
          const idx = Number(relBalMatch[2].slice(1)) - 1;
          amount = Number(params[idx]);
        } else {
          amount = Number(relBalMatch[2]);
        }
        const idIdx = Number(relBalMatch[3]) - 1;
        const uid = Number(params[idIdx]);
        const u = this.localData.users.find((x) => x.id === uid);
        if (u) {
          u.balance += sign * amount;
          this.scheduleSave();
        }
        return {
          rows: u && upper.includes("RETURNING") ? [{ ...u }] : [],
          rowCount: u ? 1 : 0
        };
      }
      const bannedMatch = s.match(/SET\s+banned\s*=\s*(true|false|\$\d+)\s+WHERE\s+id\s*=\s*\$(\d+)/i);
      if (bannedMatch) {
        const isBanned = Boolean(resolveValueExpr(bannedMatch[1], params));
        const idIdx = Number(bannedMatch[2]) - 1;
        const uid = Number(params[idIdx]);
        const u = this.localData.users.find((x) => x.id === uid);
        if (u) {
          u.banned = isBanned;
          this.scheduleSave();
        }
        return { rows: [], rowCount: u ? 1 : 0 };
      }
      if (/SET\s+balance\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/i.test(s)) {
        const u = this.localData.users.find((x) => x.id === Number(params[1]));
        if (u) {
          u.balance = Number(params[0]);
          this.scheduleSave();
        }
        return {
          rows: u && upper.includes("RETURNING") ? [{ ...u }] : [],
          rowCount: u ? 1 : 0
        };
      }
      if (/SET\s+username\s*=\s*\$1,\s*password_hash\s*=\s*\$2,\s*banned\s*=\s*false\s+WHERE\s+id\s*=\s*\$3/i.test(s)) {
        const u = this.localData.users.find((x) => x.id === Number(params[2]));
        if (u) {
          u.username = String(params[0]);
          u.password_hash = String(params[1]);
          u.banned = false;
          this.scheduleSave();
        }
        return { rows: [], rowCount: u ? 1 : 0 };
      }
      if (/SET\s+password_hash\s*=\s*\$1,\s*banned\s*=\s*false\s+WHERE\s+id\s*=\s*\$2/i.test(s)) {
        const u = this.localData.users.find((x) => x.id === Number(params[1]));
        if (u) {
          u.password_hash = String(params[0]);
          u.banned = false;
          this.scheduleSave();
        }
        return { rows: [], rowCount: u ? 1 : 0 };
      }
      if (/SET\s+password_hash\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/i.test(s)) {
        const u = this.localData.users.find((x) => x.id === Number(params[1]));
        if (u) {
          u.password_hash = String(params[0]);
          this.scheduleSave();
        }
        return { rows: [], rowCount: u ? 1 : 0 };
      }
    }
    if (/DELETE\s+FROM\s+users\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const id = Number(params[0]);
      const initial = this.localData.users.length;
      this.localData.users = this.localData.users.filter((x) => x.id !== id);
      this.scheduleSave();
      return { rows: [], rowCount: initial - this.localData.users.length };
    }
    if (upper.includes("FROM USERS U") && upper.includes("U.ROLE = 'PUNTER'")) {
      const search = params[0] ? String(params[0]).replace(/%/g, "").toLowerCase() : "";
      let list = this.localData.users.filter((x) => x.role === "punter");
      if (search) {
        list = list.filter(
          (x) => x.username.toLowerCase().includes(search) || x.phone && x.phone.includes(search)
        );
      }
      const mapped = list.map((u) => {
        const userBets = this.localData.bets.filter((b) => b.user_id === u.id);
        const pendingBets = userBets.filter((b) => b.status === "pending");
        const exposure = pendingBets.reduce((acc, b) => acc + b.stake, 0);
        const userTxs = this.localData.transactions.filter((t) => t.user_id === u.id);
        const totalDeposited = userTxs.filter((t) => t.type === "admin_credit").reduce((acc, t) => acc + t.amount, 0);
        const totalWithdrawn = userTxs.filter((t) => t.type === "admin_debit").reduce((acc, t) => acc + Math.abs(t.amount), 0);
        return {
          id: u.id,
          username: u.username,
          phone: u.phone,
          balance: u.balance,
          banned: u.banned,
          created_at: u.created_at,
          exposure,
          pending_bets: pendingBets.length,
          total_bets: userBets.length,
          total_deposited: totalDeposited,
          total_withdrawn: totalWithdrawn
        };
      });
      mapped.sort((a, b) => b.id - a.id);
      return { rows: mapped, rowCount: mapped.length };
    }
    if (upper.includes("FROM USERS WHERE ROLE = 'PUNTER'")) {
      const punters = this.localData.users.filter((x) => x.role === "punter");
      const totalBalance = punters.reduce((acc, p) => acc + p.balance, 0);
      const bannedCount = punters.filter((p) => p.banned).length;
      return {
        rows: [
          {
            total: punters.length,
            coins: totalBalance,
            banned: bannedCount,
            count: punters.length,
            total_balance: totalBalance,
            banned_count: bannedCount
          }
        ],
        rowCount: 1
      };
    }
    if (/SELECT\s+count\(\*\)\s+as\s+count\s+FROM\s+matches/i.test(s)) {
      return {
        rows: [{ count: this.localData.matches.length }],
        rowCount: 1
      };
    }
    if (/FROM\s+matches\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const id = Number(params[0]);
      const m = this.localData.matches.find((x) => x.id === id);
      return { rows: m ? [{ ...m }] : [], rowCount: m ? 1 : 0 };
    }
    if (/SELECT\s+\*\s+FROM\s+matches\s+ORDER\s+BY\s+toss_close_time\s+ASC/i.test(s)) {
      const list = [...this.localData.matches].sort(
        (a, b) => new Date(a.toss_close_time).getTime() - new Date(b.toss_close_time).getTime()
      );
      return { rows: list, rowCount: list.length };
    }
    if (/FROM\s+matches\s+ORDER\s+BY\s+created_at\s+DESC/i.test(s)) {
      const list = [...this.localData.matches].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return { rows: list, rowCount: list.length };
    }
    if (/FROM\s+matches\s+WHERE\s+status\s*=\s*'open'/i.test(s)) {
      const list = this.localData.matches.filter((m) => m.status === "open");
      return { rows: list, rowCount: list.length };
    }
    if (upper.startsWith("INSERT INTO MATCHES") && upper.includes("RETURNING *")) {
      const newMatch = {
        id: this.localData.nextMatchId++,
        league: String(params[0]),
        team_a: String(params[1]),
        team_b: String(params[2]),
        start_time: String(params[3]),
        toss_close_time: String(params[4]),
        odds_a: Number(params[5] || 1.95),
        odds_b: Number(params[6] || 1.95),
        match_img: params[7] ? String(params[7]) : null,
        team_a_img: params[8] ? String(params[8]) : null,
        team_b_img: params[9] ? String(params[9]) : null,
        status: "open",
        winner: null,
        settled_at: null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.localData.matches.push(newMatch);
      this.scheduleSave();
      return { rows: [{ ...newMatch }], rowCount: 1 };
    }
    if (upper.startsWith("INSERT INTO MATCHES")) {
      const regex = /\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+),\s*([0-9.]+),\s*'([^']+)'\)/g;
      let match;
      let count = 0;
      while ((match = regex.exec(s)) !== null) {
        const m = {
          id: this.localData.nextMatchId++,
          league: match[1],
          team_a: match[2],
          team_b: match[3],
          start_time: match[4],
          toss_close_time: match[5],
          odds_a: Number(match[6]),
          odds_b: Number(match[7]),
          match_img: null,
          team_a_img: null,
          team_b_img: null,
          status: match[8],
          winner: null,
          settled_at: null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.localData.matches.push(m);
        count++;
      }
      this.scheduleSave();
      return { rows: [], rowCount: count };
    }
    if (upper.startsWith("UPDATE MATCHES")) {
      if (/SET\s+status\s*=\s*'finished',\s*winner\s*=\s*\$1,\s*settled_at\s*=\s*\$2\s+WHERE\s+id\s*=\s*\$3/i.test(s)) {
        const requireOpen = /AND\s+status\s*=\s*'open'/i.test(s);
        const m = this.localData.matches.find(
          (x) => x.id === Number(params[2]) && (!requireOpen || x.status === "open")
        );
        if (m) {
          m.status = "finished";
          m.winner = String(params[0]);
          m.settled_at = String(params[1]);
          this.scheduleSave();
        }
        return {
          rows: m && upper.includes("RETURNING") ? [{ ...m }] : [],
          rowCount: m ? 1 : 0
        };
      }
      if (/SET\s+status\s*=\s*'cancelled',\s*winner\s*=\s*null,\s*settled_at\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/i.test(s)) {
        const requireOpen = /AND\s+status\s*=\s*'open'/i.test(s);
        const m = this.localData.matches.find(
          (x) => x.id === Number(params[1]) && (!requireOpen || x.status === "open")
        );
        if (m) {
          m.status = "cancelled";
          m.winner = null;
          m.settled_at = String(params[0]);
          this.scheduleSave();
        }
        return {
          rows: m && upper.includes("RETURNING") ? [{ ...m }] : [],
          rowCount: m ? 1 : 0
        };
      }
      const setWhere = s.match(/UPDATE\s+matches\s+SET\s+(.+?)\s+WHERE\s+id\s*=\s*\$(\d+)/i);
      if (setWhere) {
        const id = Number(params[Number(setWhere[2]) - 1]);
        const m = this.localData.matches.find((x) => x.id === id);
        if (m) {
          const assignments = splitSqlList(setWhere[1]);
          for (const assign of assignments) {
            const eqIdx = assign.indexOf("=");
            if (eqIdx < 0) continue;
            const col = assign.slice(0, eqIdx).trim().toLowerCase();
            const val = resolveValueExpr(assign.slice(eqIdx + 1), params);
            if (col === "league") m.league = String(val);
            else if (col === "team_a") m.team_a = String(val);
            else if (col === "team_b") m.team_b = String(val);
            else if (col === "start_time") m.start_time = String(val);
            else if (col === "toss_close_time") m.toss_close_time = String(val);
            else if (col === "odds_a") m.odds_a = Number(val);
            else if (col === "odds_b") m.odds_b = Number(val);
            else if (col === "match_img") m.match_img = val ? String(val) : null;
            else if (col === "team_a_img") m.team_a_img = val ? String(val) : null;
            else if (col === "team_b_img") m.team_b_img = val ? String(val) : null;
          }
          this.scheduleSave();
        }
        return { rows: [], rowCount: m ? 1 : 0 };
      }
    }
    if (/DELETE\s+FROM\s+matches\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const id = Number(params[0]);
      const initial = this.localData.matches.length;
      this.localData.matches = this.localData.matches.filter((x) => x.id !== id);
      this.scheduleSave();
      return { rows: [], rowCount: initial - this.localData.matches.length };
    }
    if (/SELECT\s+count\(\*\)\s+as\s+count\s+FROM\s+bets\s+WHERE\s+match_id\s*=\s*\$1/i.test(s)) {
      const matchId = Number(params[0]);
      const count = this.localData.bets.filter((b) => b.match_id === matchId).length;
      return { rows: [{ count }], rowCount: 1 };
    }
    if (/FROM\s+bets\s+WHERE\s+user_id\s*=\s*\$1\s+AND\s+status\s*=\s*'pending'/i.test(s)) {
      const uid = Number(params[0]);
      const pending = this.localData.bets.filter((b) => b.user_id === uid && b.status === "pending");
      const total = pending.reduce((acc, b) => acc + b.stake, 0);
      return { rows: [{ total }], rowCount: 1 };
    }
    if (/FROM\s+bets\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const bid = Number(params[0]);
      const b = this.localData.bets.find((x) => x.id === bid);
      return { rows: b ? [{ ...b }] : [], rowCount: b ? 1 : 0 };
    }
    if (/FROM\s+bets\s+WHERE\s+match_id\s*=\s*\$1\s+AND\s+status\s*=\s*'pending'/i.test(s)) {
      const mid = Number(params[0]);
      const pending = this.localData.bets.filter((b) => b.match_id === mid && b.status === "pending");
      return { rows: pending.map((b) => ({ ...b })), rowCount: pending.length };
    }
    if (upper.includes("FROM BETS B") && upper.includes("JOIN USERS U")) {
      const mid = Number(params[0]);
      const matchBets = this.localData.bets.filter((b) => b.match_id === mid).sort((a, b) => b.id - a.id);
      const rows = matchBets.map((b) => {
        const u = this.localData.users.find((x) => x.id === b.user_id);
        return {
          id: b.id,
          user_id: b.user_id,
          match_id: b.match_id,
          selection: b.selection,
          odds: b.odds,
          stake: b.stake,
          status: b.status,
          settled_at: b.settled_at,
          created_at: b.created_at,
          username: u?.username ?? `user_${b.user_id}`,
          phone: u?.phone ?? null
        };
      });
      return { rows, rowCount: rows.length };
    }
    if (upper.includes("FROM BETS B") && upper.includes("JOIN MATCHES M")) {
      const uid = Number(params[0]);
      const limitMatch = s.match(/LIMIT\s+(\d+)/i);
      const limit = limitMatch ? Number(limitMatch[1]) : 100;
      const userBets = this.localData.bets.filter((b) => b.user_id === uid).sort((a, b) => b.id - a.id).slice(0, limit);
      const rows = userBets.map((b) => {
        const m = this.localData.matches.find((x) => x.id === b.match_id);
        return {
          id: b.id,
          user_id: b.user_id,
          match_id: b.match_id,
          selection: b.selection,
          odds: b.odds,
          stake: b.stake,
          status: b.status,
          settled_at: b.settled_at,
          created_at: b.created_at,
          league: m?.league ?? "TOSS 786 CUP",
          team_a: m?.team_a ?? "TEAM A",
          team_b: m?.team_b ?? "TEAM B",
          match_status: m?.status ?? "open",
          start_time: m?.start_time ?? (/* @__PURE__ */ new Date()).toISOString(),
          toss_close_time: m?.toss_close_time ?? (/* @__PURE__ */ new Date()).toISOString(),
          winner: m?.winner ?? null
        };
      });
      return { rows, rowCount: rows.length };
    }
    if (upper.startsWith("INSERT INTO BETS")) {
      const m = s.match(/INSERT\s+INTO\s+bets\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      const record = {};
      if (m) {
        const cols = splitSqlList(m[1]).map((c) => c.toLowerCase());
        const vals = splitSqlList(m[2]);
        for (let i = 0; i < cols.length; i++) {
          record[cols[i]] = resolveValueExpr(vals[i], params);
        }
      }
      const b = {
        id: this.localData.nextBetId++,
        user_id: Number(record.user_id ?? params[0]),
        match_id: Number(record.match_id ?? params[1]),
        selection: String(record.selection ?? params[2]),
        odds: Number(record.odds ?? params[3]),
        stake: Number(record.stake ?? params[4]),
        status: String(record.status ?? params[5] ?? "pending"),
        settled_at: null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.localData.bets.push(b);
      this.scheduleSave();
      return { rows: [{ ...b }], rowCount: 1 };
    }
    if (upper.startsWith("UPDATE BETS")) {
      const litMatch = s.match(
        /SET\s+status\s*=\s*'([^']+)',\s*settled_at\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/i
      );
      if (litMatch) {
        const requirePending = /AND\s+status\s*=\s*'pending'/i.test(s);
        const b = this.localData.bets.find(
          (x) => x.id === Number(params[1]) && (!requirePending || x.status === "pending")
        );
        if (b) {
          b.status = litMatch[1];
          b.settled_at = String(params[0]);
          this.scheduleSave();
        }
        return {
          rows: b && upper.includes("RETURNING") ? [{ ...b }] : [],
          rowCount: b ? 1 : 0
        };
      }
      if (/SET\s+status\s*=\s*\$1,\s*settled_at\s*=\s*\$2\s+WHERE\s+id\s*=\s*\$3/i.test(s)) {
        const requirePending = /AND\s+status\s*=\s*'pending'/i.test(s);
        const b = this.localData.bets.find(
          (x) => x.id === Number(params[2]) && (!requirePending || x.status === "pending")
        );
        if (b) {
          b.status = String(params[0]);
          b.settled_at = String(params[1]);
          this.scheduleSave();
        }
        return {
          rows: b && upper.includes("RETURNING") ? [{ ...b }] : [],
          rowCount: b ? 1 : 0
        };
      }
    }
    if (upper.includes("FROM BETS WHERE STATUS = 'PENDING'")) {
      const pending = this.localData.bets.filter((b) => b.status === "pending");
      const totalStakes = pending.reduce((acc, b) => acc + b.stake, 0);
      return {
        rows: [
          {
            pending_cnt: pending.length,
            pending_stake: totalStakes,
            count: pending.length,
            total_stakes: totalStakes
          }
        ],
        rowCount: 1
      };
    }
    if (upper.includes("FROM BETS GROUP BY MATCH_ID")) {
      const map = {};
      for (const b of this.localData.bets) {
        if (!map[b.match_id]) {
          map[b.match_id] = { cnt: 0, total: 0, pending: 0 };
        }
        map[b.match_id].cnt++;
        map[b.match_id].total += b.stake;
        if (b.status === "pending") {
          map[b.match_id].pending += b.stake;
        }
      }
      const rows = Object.entries(map).map(([mid, val]) => ({
        match_id: Number(mid),
        cnt: val.cnt,
        total: val.total,
        pending: val.pending
      }));
      return { rows, rowCount: rows.length };
    }
    if (upper.startsWith("INSERT INTO TRANSACTIONS")) {
      const m = s.match(/INSERT\s+INTO\s+transactions\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      const record = {};
      if (m) {
        const cols = splitSqlList(m[1]).map((c) => c.toLowerCase());
        const vals = splitSqlList(m[2]);
        for (let i = 0; i < cols.length; i++) {
          record[cols[i]] = resolveValueExpr(vals[i], params);
        }
      }
      const tx = {
        id: this.localData.nextTxId++,
        user_id: Number(record.user_id ?? params[0]),
        amount: Number(record.amount ?? params[1]),
        balance_after: Number(record.balance_after ?? params[2]),
        type: String(record.type ?? params[3] ?? "admin_credit"),
        note: record.note != null ? String(record.note) : null,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.localData.transactions.push(tx);
      this.scheduleSave();
      return { rows: [{ ...tx }], rowCount: 1 };
    }
    if (/FROM\s+transactions\s+WHERE\s+user_id\s*=\s*\$1\s+ORDER\s+BY\s+id\s+DESC/i.test(s)) {
      const uid = Number(params[0]);
      const txs = this.localData.transactions.filter((t) => t.user_id === uid).sort((a, b) => b.id - a.id).slice(0, 120);
      return { rows: txs, rowCount: txs.length };
    }
    if (upper.startsWith("DELETE FROM TRANSACTIONS WHERE USER_ID")) {
      const ids = params.map(Number);
      const before = this.localData.transactions.length;
      this.localData.transactions = this.localData.transactions.filter((t) => !ids.includes(t.user_id));
      this.scheduleSave();
      return { rows: [], rowCount: before - this.localData.transactions.length };
    }
    if (upper.startsWith("DELETE FROM BETS WHERE MATCH_ID")) {
      const mid = Number(params[0]);
      const before = this.localData.bets.length;
      this.localData.bets = this.localData.bets.filter((b) => b.match_id !== mid);
      this.scheduleSave();
      return { rows: [], rowCount: before - this.localData.bets.length };
    }
    if (upper.startsWith("DELETE FROM USERS WHERE ID")) {
      const ids = params.map(Number);
      const before = this.localData.users.length;
      this.localData.users = this.localData.users.filter((u) => !ids.includes(u.id));
      this.scheduleSave();
      return { rows: [], rowCount: before - this.localData.users.length };
    }
    console.warn("[ResilientDB] Unhandled query in local store:", s.slice(0, 120));
    return { rows: [], rowCount: 0 };
  }
};
var resilientDb = new ResilientDatabase();

// src/lib/money.ts
function sanitizeStake(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function sanitizeOdds(raw, fallback = 1.95) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return fallback;
  return Math.round(n * 100) / 100;
}
function calculatePayout(stake, odds) {
  const safeStake = Math.max(0, Math.round(Number(stake) || 0));
  const oddsBasis = Math.max(1e4, Math.round((Number(odds) || 1.95) * 1e4));
  return Math.round(safeStake * oddsBasis / 1e4);
}
function calculateCancellationRefund(stake, feePercent = 2) {
  const safeStake = Math.max(0, Math.round(Number(stake) || 0));
  const clampedPct = Math.max(0, Math.min(100, Number(feePercent) || 0));
  const fee = Math.round(safeStake * clampedPct / 100);
  const refund = Math.max(0, safeStake - fee);
  return { stake: safeStake, fee, refund };
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
var HOST = "0.0.0.0";
var SECRET = process.env.AUTH_SECRET || process.env.SESSION_SECRET || "tossbook786_secret_key_998877_secure_hash";
var SESSION_COOKIE = "tb786_session";
var SESSION_MAX_AGE_MS = 1e3 * 60 * 60 * 24 * 7;
var ADMIN_USERNAME = "admin";
var ADMIN_PASSWORD = "1BVtsOH8BuwhXb95UFmKzrJA6RJWOSvpTxylTebeNTWaj5jRCyis18GlhrJpQ3Hki6u3XwGBojFNvs47YXZ70gjsAeMvsFJuDvqx1xVcSwVg82y47jERt47XyEQTN7UeOCCq4FgYmub0YoOvpKcb5S7l_2VGkOlFWB2cVcDcXYTpSYd2kldI8Yle8URE73sLkDUx61sF8M0MMrH9aORxGMS1--Dmom9ioAVSvaLumnK4n4lO2Q6Yb6IDUadWZiUvrWYtm2LukS6_pkUacxKankDZ6zHV_RGwpPMQvfIKXsuHV5fzs8z3hUILKUbTNad6TiSuX8WrSEY0Iogz_u3pga1lT990u8SA=";
var DEMO_USERNAME = "DEMO1";
var DEMO_PASSWORD = "demo123";
var DEFAULT_TELEGRAM = "https://t.me/+FNrv5zNv6lI0ODk1";
var DEFAULT_WEBSITE = "https://tossbook786.com";
var DEFAULT_MARQUEE = "Welcome to the Toss Book. Asia's No. 1 Gaming Platform. Min bet 100, Min Withdraw 500, Get 200 for Each Referral. Instant 24x7 Royal Service!";
var DEFAULT_WELCOME_TEMPLATE = `\u{1F3CF}WELCOME TO TOSSBOOK786\u{1F3CF}

\u{1F310} *OFFICIAL WEBSITE*
{websiteUrl}

*User*\u{1F464} :- {username}
*Password*\u{1F510}  :- {password}

\u26A0\uFE0F *Password me ({capitalLetter}) Capital Letter me rahega*

\u2705 *Instant Access Available*

\u{1F4CC} *Please login using your provided details*
Telegram support :- {supportUrl}`;
var pgPool = resilientDb;
function hashPassword(password) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
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
function passwordFingerprint(passwordHash) {
  return crypto.createHmac("sha256", SECRET).update(passwordHash).digest("hex").slice(0, 16);
}
function signSession(userId, passwordHash = "") {
  const fp = passwordFingerprint(passwordHash);
  const payload = `${userId}.${fp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
function verifySessionToken(token) {
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
async function bootstrapDatabase() {
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
    }
    const defaultSettings = [
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
      ["referralBonus", "200"]
    ];
    for (const [k, v] of defaultSettings) {
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [k, v]
      );
    }
    const adminHash = hashPassword(ADMIN_PASSWORD);
    const existingAdmin = await pgPool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (existingAdmin.rows.length === 0) {
      await pgPool.query(
        `INSERT INTO users (username, password_hash, role, balance, banned) VALUES ($1, $2, 'admin', 0, false)`,
        [ADMIN_USERNAME, adminHash]
      );
    } else {
      await pgPool.query(
        `UPDATE users SET username = $1, password_hash = $2, banned = false WHERE id = $3`,
        [ADMIN_USERNAME, adminHash, existingAdmin.rows[0].id]
      );
    }
    const demoHash = hashPassword(DEMO_PASSWORD);
    const existingDemo = await pgPool.query(`SELECT id FROM users WHERE username = 'DEMO1' LIMIT 1`);
    if (existingDemo.rows.length === 0) {
      await pgPool.query(
        `INSERT INTO users (username, password_hash, role, balance, banned, phone) VALUES ($1, $2, 'punter', 10000, false, '9000000786')`,
        [DEMO_USERNAME, demoHash]
      );
    } else {
      await pgPool.query(
        `UPDATE users SET password_hash = $1, banned = false WHERE id = $2`,
        [demoHash, existingDemo.rows[0].id]
      );
    }
    const matchCnt = await pgPool.query(`SELECT count(*) as count FROM matches`);
    if (Number(matchCnt.rows[0].count) === 0) {
      const now = Date.now();
      const at = (min) => new Date(now + min * 6e4).toISOString();
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
    console.log("\u2705 PostgreSQL schema and seed verified successfully!");
  } catch (err) {
    console.error("Database bootstrap error:", err);
  }
}
var USER_PATTERNS = [
  () => `devil${Math.floor(1e3 + Math.random() * 9e3)}`,
  () => `tossbook786_${Math.floor(10 + Math.random() * 90)}`,
  () => `tb786${Math.floor(100 + Math.random() * 900)}`,
  () => `royal${Math.floor(1e3 + Math.random() * 9e3)}`,
  () => `punter${Math.floor(1e3 + Math.random() * 9e3)}`
];
function generateUsernameCandidate() {
  const fn = USER_PATTERNS[Math.floor(Math.random() * USER_PATTERNS.length)];
  return fn();
}
function generatePassword() {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghijkmnpqrstuvwxyz";
  const cap = UPPER[Math.floor(Math.random() * UPPER.length)];
  let low = "";
  for (let i = 0; i < 3; i++) low += LOWER[Math.floor(Math.random() * LOWER.length)];
  const rand4 = String(Math.floor(1e3 + Math.random() * 9e3));
  return `${cap}${low}@${rand4}`;
}
function effectiveMatchStatus(status, startTime, tossCloseTime, now = Date.now()) {
  if (status === "finished") return "finished";
  if (status === "cancelled") return "cancelled";
  const close = new Date(tossCloseTime).getTime();
  if (now >= close) return "locked";
  return "live";
}
async function getPublicSettings() {
  try {
    const res = await pgPool.query(`SELECT key, value FROM settings`);
    const map = new Map(res.rows.map((r) => [r.key, r.value]));
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
      referralBonus: Number(map.get("referralBonus") || 200)
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
      referralBonus: 200
    };
  }
}
var app = express();
var dbInitPromise = null;
function ensureDbReady() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await resilientDb.checkConnection();
        await bootstrapDatabase();
      } catch (err) {
        console.warn("[Init] DB ready warning:", err.message);
      }
    })();
  }
  return dbInitPromise;
}
app.use(async (_req, _res, next) => {
  try {
    await ensureDbReady();
  } catch {
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
async function getAuthUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  const parsed = verifySessionToken(token);
  if (!parsed) return null;
  try {
    const res = await pgPool.query(
      `SELECT id, username, role, phone, balance, banned, password_hash FROM users WHERE id = $1`,
      [parsed.userId]
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
      banned: u.banned
    };
  } catch {
    return null;
  }
}
app.get(["/health", "/api/health"], async (_req, res) => {
  const isPg = resilientDb.isUsingPostgres();
  res.status(200).json({
    ok: true,
    status: "healthy",
    database: isPg ? "connected (PostgreSQL)" : "connected (resilient local store)",
    uptime: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/settings", async (_req, res) => {
  const s = await getPublicSettings();
  res.json(s);
});
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const u = (username ?? "").trim();
  const p = password ?? "";
  if (!u || !p) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  try {
    let q = `SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`;
    let params = [u];
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
      maxAge: SESSION_MAX_AGE_MS
    });
    res.json({
      ok: true,
      role: user.role,
      username: user.username,
      id: user.id
    });
  } catch (err) {
    res.status(500).json({ error: "Database error during login", detail: err.message });
  }
});
app.post("/api/auth/change-password", async (req, res) => {
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
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || typeof confirmPassword !== "string" || !currentPassword || !newPassword || !confirmPassword) {
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
        const [dbUser] = await tx.select({ id: users.id, passwordHash: users.passwordHash, banned: users.banned }).from(users).where(eq(users.id, authUser.id)).for("update");
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
        await tx.update(users).set({ passwordHash: nextHash }).where(eq(users.id, authUser.id));
      });
    } else {
      const client = await pgPool.connect();
      try {
        await client.query("BEGIN");
        const uRes = await client.query(`SELECT id, password_hash, banned FROM users WHERE id = $1 FOR UPDATE`, [
          authUser.id
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
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });
    res.json({
      ok: true,
      sessionCleared: true,
      message: "Password updated successfully. Please sign in with your new password."
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    res.status(status).json({ error: err?.message || "Failed to update password" });
  }
});
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
  res.json({ ok: true });
});
app.get("/api/me", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const expoRes = await pgPool.query(
    `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
    [user.id]
  );
  const exposure = Number(expoRes.rows[0]?.total ?? 0);
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    phone: user.phone,
    balance: user.balance,
    banned: user.banned,
    exposure
  });
});
app.get("/api/matches", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await pgPool.query(`SELECT * FROM matches ORDER BY toss_close_time ASC`);
    const now = Date.now();
    const dtos = result.rows.map((m) => ({
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
      createdAt: new Date(m.created_at).toISOString()
    }));
    const live = dtos.filter((d) => d.status === "live" || d.status === "locked");
    const scheduled = dtos.filter((d) => d.status === "scheduled").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const startOfDay = /* @__PURE__ */ new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const finishedToday = dtos.filter(
      (d) => (d.status === "finished" || d.status === "cancelled") && d.settledAt && new Date(d.settledAt).getTime() >= startOfDay.getTime()
    );
    res.json({
      live,
      scheduled,
      finishedToday,
      settings: await getPublicSettings(),
      serverNow: new Date(now).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch matches", detail: err.message });
  }
});
app.post("/api/bets", async (req, res) => {
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
  const settings2 = await getPublicSettings();
  if (settings2.marketFrozen) {
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
  if (stake < settings2.minBet) {
    res.status(400).json({ error: `Minimum bet amount is ${settings2.minBet} Rs.` });
    return;
  }
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, mId)).for("update");
        if (!match) {
          throw Object.assign(new Error("Match not found"), { status: 404 });
        }
        const st = effectiveMatchStatus(match.status, match.startTime, match.tossCloseTime);
        if (st !== "live") {
          throw Object.assign(
            new Error(
              st === "locked" ? "Betting closed for this contest" : st === "scheduled" ? "Contest has not opened yet" : "Contest is already settled"
            ),
            { status: 400 }
          );
        }
        const [freshUser] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        if (!freshUser || freshUser.balance < stake) {
          throw Object.assign(new Error("Insufficient wallet balance (Rs.) to place this bet."), {
            status: 400
          });
        }
        const odds = sanitizeOdds(side === "A" ? match.oddsA : match.oddsB);
        const chosen = side === "A" ? match.teamA : match.teamB;
        const [updatedUser] = await tx.update(users).set({ balance: sql`${users.balance} - ${stake}` }).where(eq(users.id, freshUser.id)).returning({ balance: users.balance });
        const newBalance = updatedUser.balance;
        const [bet] = await tx.insert(bets).values({
          userId: freshUser.id,
          matchId: match.id,
          selection: side,
          odds: odds.toFixed(2),
          stake,
          status: "pending"
        }).returning();
        await tx.insert(transactions).values({
          userId: freshUser.id,
          amount: -stake,
          balanceAfter: newBalance,
          type: "bet",
          note: `Bet placed on ${match.league} - ${chosen} @ ${odds.toFixed(2)}x (Contest #${match.id})`
        });
        const [expoRow] = await tx.select({ total: sql`COALESCE(SUM(${bets.stake}), 0)` }).from(bets).where(and(eq(bets.userId, freshUser.id), eq(bets.status, "pending")));
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
            status: bet.status
          }
        };
      });
      res.json({ ok: true, ...outcome });
      return;
    } catch (err) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Failed to place bet" });
      return;
    }
  }
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
        error: st === "locked" ? "Betting closed for this contest" : st === "scheduled" ? "Contest has not opened yet" : "Contest is already settled"
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
      [freshUser.id, match.id, side, odds, stake]
    );
    const bet = betRes.rows[0];
    await client.query(
      `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'bet', $4)`,
      [
        freshUser.id,
        -stake,
        newBalance,
        `Bet placed on ${match.league} - ${chosen} @ ${odds.toFixed(2)}x (Contest #${match.id})`
      ]
    );
    const expoRes = await client.query(
      `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
      [freshUser.id]
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
        status: bet.status
      }
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to place bet", detail: err.message });
  } finally {
    client.release();
  }
});
app.get("/api/bets", async (req, res) => {
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
      [user.id]
    );
    const now = Date.now();
    const dtos = resBets.rows.map((b) => {
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
        tossCloseTime: b.toss_close_time ? new Date(b.toss_close_time).toISOString() : void 0,
        canCancel,
        createdAt: new Date(b.created_at).toISOString(),
        settledAt: b.settled_at ? new Date(b.settled_at).toISOString() : null
      };
    });
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ error: "Failed to load bets" });
  }
});
async function handleCancelBet(req, res, forceAdminMode = false) {
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
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [bet] = await tx.select().from(bets).where(eq(bets.id, betId)).for("update");
        if (!bet) {
          throw Object.assign(new Error("Bet not found"), { status: 404 });
        }
        if (!isAdmin && bet.userId !== user.id) {
          throw Object.assign(new Error("Forbidden: you can only cancel your own bets"), { status: 403 });
        }
        if (bet.status !== "pending") {
          throw Object.assign(new Error("Only pending bets can be cancelled"), { status: 400 });
        }
        const [match] = await tx.select().from(matches).where(eq(matches.id, bet.matchId)).for("update");
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
              { status: 400 }
            );
          }
        }
        const [betOwner] = await tx.select().from(users).where(eq(users.id, bet.userId)).for("update");
        if (!betOwner) {
          throw Object.assign(new Error("Bet owner account not found"), { status: 404 });
        }
        const now = /* @__PURE__ */ new Date();
        const [cancelledBet] = await tx.update(bets).set({ status: "cancelled", settledAt: now }).where(and(eq(bets.id, betId), eq(bets.status, "pending"))).returning();
        if (!cancelledBet) {
          throw Object.assign(new Error("Bet has already been settled or cancelled"), { status: 400 });
        }
        const { stake, fee, refund } = calculateCancellationRefund(bet.stake, 2);
        const [updatedUser] = await tx.update(users).set({ balance: sql`${users.balance} + ${refund}` }).where(eq(users.id, betOwner.id)).returning({ balance: users.balance });
        const newBalance = updatedUser.balance;
        const chosenTeam = bet.selection === "A" ? match.teamA : match.teamB;
        await tx.insert(transactions).values({
          userId: betOwner.id,
          amount: refund,
          balanceAfter: newBalance,
          type: "bet_cancelled",
          note: `Cancelled Bet #${bet.id}: ${match.league} (${match.teamA} vs ${match.teamB} - ${chosenTeam}) \xB7 Stake ${stake} Rs. - 2% fee (${fee} Rs.) = Refunded ${refund} Rs.${isAdmin && betOwner.id !== user.id ? " [By Admin]" : ""}`
        });
        const [expoRow] = await tx.select({ total: sql`COALESCE(SUM(${bets.stake}), 0)` }).from(bets).where(and(eq(bets.userId, betOwner.id), eq(bets.status, "pending")));
        return {
          ok: true,
          betId: bet.id,
          status: "cancelled",
          stake,
          fee,
          feePercent: 2,
          refunded: refund,
          balance: newBalance,
          exposure: Number(expoRow?.total ?? 0)
        };
      });
      res.json(outcome);
      return;
    } catch (err) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Failed to cancel bet" });
      return;
    }
  }
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
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const cancelRes = await client.query(
      `UPDATE bets SET status = 'cancelled', settled_at = $1 WHERE id = $2 AND status = 'pending' RETURNING *`,
      [nowIso, betId]
    );
    if (cancelRes.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Bet has already been settled or cancelled" });
      return;
    }
    const { stake, fee, refund } = calculateCancellationRefund(bet.stake, 2);
    const updatedOwnerRes = await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
      [refund, betOwner.id]
    );
    const newBalance = updatedOwnerRes.rows[0]?.balance ?? betOwner.balance + refund;
    const chosenTeam = bet.selection === "A" ? match.team_a : match.team_b;
    await client.query(
      `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'bet_cancelled', $4)`,
      [
        betOwner.id,
        refund,
        newBalance,
        `Cancelled Bet #${bet.id}: ${match.league} (${match.team_a} vs ${match.team_b} - ${chosenTeam}) \xB7 Stake ${stake} Rs. - 2% fee (${fee} Rs.) = Refunded ${refund} Rs.${isAdmin && betOwner.id !== user.id ? " [By Admin]" : ""}`
      ]
    );
    const expoRes = await client.query(
      `SELECT COALESCE(SUM(stake), 0) as total FROM bets WHERE user_id = $1 AND status = 'pending'`,
      [betOwner.id]
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
      exposure: Number(expoRes.rows[0]?.total ?? 0)
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Failed to cancel bet", detail: err.message });
  } finally {
    client.release();
  }
}
app.post("/api/bets/:id/cancel", async (req, res) => {
  await handleCancelBet(req, res, false);
});
app.post("/api/admin/bets/:id/cancel", requireAdmin, async (req, res) => {
  await handleCancelBet(req, res, true);
});
app.get("/api/transactions", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const resTx = await pgPool.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 120`,
      [user.id]
    );
    res.json(
      resTx.rows.map((t) => ({
        id: t.id,
        amount: t.amount,
        balanceAfter: t.balance_after,
        type: t.type,
        note: t.note,
        createdAt: new Date(t.created_at).toISOString()
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to load transactions" });
  }
});
async function requireAdmin(req, res, next) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden - Admin access required" });
    return;
  }
  next();
}
app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const puntersRes = await pgPool.query(
      `SELECT count(*) as total, coalesce(sum(balance), 0) as coins, coalesce(sum(case when banned then 1 else 0 end), 0) as banned FROM users WHERE role = 'punter'`
    );
    const betsRes = await pgPool.query(
      `SELECT count(*) as pending_cnt, coalesce(sum(stake), 0) as pending_stake FROM bets WHERE status = 'pending'`
    );
    const matchesRes = await pgPool.query(`SELECT status, start_time, toss_close_time FROM matches WHERE status = 'open'`);
    const now = Date.now();
    const liveCount = matchesRes.rows.filter(
      (m) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "live"
    ).length;
    const scheduledCount = matchesRes.rows.filter(
      (m) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "scheduled"
    ).length;
    const lockedCount = matchesRes.rows.filter(
      (m) => effectiveMatchStatus(m.status, m.start_time, m.toss_close_time, now) === "locked"
    ).length;
    res.json({
      totalPunters: Number(puntersRes.rows[0].total),
      coinsInCirculation: Number(puntersRes.rows[0].coins),
      bannedPunters: Number(puntersRes.rows[0].banned),
      pendingBets: Number(betsRes.rows[0].pending_cnt),
      pendingStakes: Number(betsRes.rows[0].pending_stake),
      liveMatches: liveCount,
      scheduledMatches: scheduledCount,
      lockedMatches: lockedCount
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});
app.get("/api/admin/matches", requireAdmin, async (_req, res) => {
  try {
    const rows = await pgPool.query(`SELECT * FROM matches ORDER BY created_at DESC LIMIT 200`);
    const stakeRows = await pgPool.query(`
      SELECT match_id, coalesce(sum(stake), 0) as total, count(*) as cnt,
      coalesce(sum(case when status = 'pending' then stake else 0 end), 0) as pending
      FROM bets GROUP BY match_id
    `);
    const stakeMap = new Map(stakeRows.rows.map((r) => [r.match_id, r]));
    const now = Date.now();
    const dtos = rows.rows.map((m) => {
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
        pendingStaked: Number(s?.pending ?? 0)
      };
    });
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ error: "Failed to load admin matches" });
  }
});
app.post("/api/admin/matches", requireAdmin, async (req, res) => {
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
      [l, tA, tB, start.toISOString(), close.toISOString(), oA, oB, matchImg || null, teamAImg || null, teamBImg || null]
    );
    res.json({ ok: true, match: resMatch.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to schedule match", detail: err.message });
  }
});
app.put("/api/admin/matches/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid match ID" });
    return;
  }
  const { league, teamA, teamB, startTime, tossCloseTime, oddsA, oddsB, matchImg } = req.body || {};
  try {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (league) {
      sets.push(`league = $${idx++}`);
      vals.push(league.trim().toUpperCase());
    }
    if (teamA) {
      sets.push(`team_a = $${idx++}`);
      vals.push(teamA.trim().toUpperCase());
    }
    if (teamB) {
      sets.push(`team_b = $${idx++}`);
      vals.push(teamB.trim().toUpperCase());
    }
    if (startTime) {
      sets.push(`start_time = $${idx++}`);
      vals.push(new Date(startTime).toISOString());
    }
    if (tossCloseTime) {
      sets.push(`toss_close_time = $${idx++}`);
      vals.push(new Date(tossCloseTime).toISOString());
    }
    if (oddsA !== void 0) {
      sets.push(`odds_a = $${idx++}`);
      vals.push(sanitizeOdds(oddsA));
    }
    if (oddsB !== void 0) {
      sets.push(`odds_b = $${idx++}`);
      vals.push(sanitizeOdds(oddsB));
    }
    if (matchImg !== void 0) {
      sets.push(`match_img = $${idx++}`);
      vals.push(matchImg || null);
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    vals.push(id);
    await pgPool.query(`UPDATE matches SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update match", detail: err.message });
  }
});
app.patch("/api/admin/matches/:id", requireAdmin, async (req, res) => {
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
  if (resilientDb.isUsingPostgres() && db) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, id)).for("update");
        if (!match) {
          throw Object.assign(new Error("Match not found"), { status: 404 });
        }
        if (match.status !== "open") {
          throw Object.assign(new Error("Match is already settled"), { status: 400 });
        }
        const now = /* @__PURE__ */ new Date();
        const [lockedMatch] = await tx.update(matches).set(
          result === "cancel" ? { status: "cancelled", winner: null, settledAt: now } : { status: "finished", winner: result, settledAt: now }
        ).where(and(eq(matches.id, id), eq(matches.status, "open"))).returning();
        if (!lockedMatch) {
          throw Object.assign(new Error("Match is already settled"), { status: 400 });
        }
        const pendingBets = await tx.select().from(bets).where(and(eq(bets.matchId, id), eq(bets.status, "pending"))).for("update");
        let credited = 0;
        let refunded = 0;
        let winners = 0;
        if (result === "cancel") {
          for (const bet of pendingBets) {
            const stakeAmt = Math.round(Number(bet.stake));
            const [updatedUser] = await tx.update(users).set({ balance: sql`${users.balance} + ${stakeAmt}` }).where(eq(users.id, bet.userId)).returning({ balance: users.balance });
            await tx.insert(transactions).values({
              userId: bet.userId,
              amount: stakeAmt,
              balanceAfter: updatedUser ? updatedUser.balance : stakeAmt,
              type: "refund",
              note: `Refund: ${match.league} - ${match.teamA} vs ${match.teamB} (contest cancelled)`
            });
            await tx.update(bets).set({ status: "refunded", settledAt: now }).where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));
            refunded += stakeAmt;
          }
        } else {
          const winnerName = result === "A" ? match.teamA : match.teamB;
          for (const bet of pendingBets) {
            if (bet.selection === result) {
              const credit = calculatePayout(bet.stake, Number(bet.odds));
              const [updatedUser] = await tx.update(users).set({ balance: sql`${users.balance} + ${credit}` }).where(eq(users.id, bet.userId)).returning({ balance: users.balance });
              await tx.insert(transactions).values({
                userId: bet.userId,
                amount: credit,
                balanceAfter: updatedUser ? updatedUser.balance : credit,
                type: "win",
                note: `Win credit: ${match.league} - backed ${winnerName} @ ${Number(bet.odds).toFixed(2)}x (stake ${bet.stake})`
              });
              await tx.update(bets).set({ status: "won", settledAt: now }).where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));
              credited += credit;
              winners += 1;
            } else {
              const [uRow] = await tx.select({ balance: users.balance }).from(users).where(eq(users.id, bet.userId)).for("update");
              const backedName = bet.selection === "A" ? match.teamA : match.teamB;
              await tx.insert(transactions).values({
                userId: bet.userId,
                amount: 0,
                balanceAfter: uRow ? uRow.balance : 0,
                type: "loss",
                note: `Loss settled: ${match.league} - backed ${backedName}, winner ${winnerName} (stake ${bet.stake})`
              });
              await tx.update(bets).set({ status: "lost", settledAt: now }).where(and(eq(bets.id, bet.id), eq(bets.status, "pending")));
            }
          }
        }
        return { ok: true, credited, refunded, winners, settled: pendingBets.length };
      });
      res.json(outcome);
      return;
    } catch (err) {
      const status = Number(err?.status) || 500;
      res.status(status).json({ error: err?.message || "Settlement failed" });
      return;
    }
  }
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const lockRes = result === "cancel" ? await client.query(
      `UPDATE matches SET status = 'cancelled', winner = null, settled_at = $1 WHERE id = $2 AND status = 'open' RETURNING *`,
      [now, id]
    ) : await client.query(
      `UPDATE matches SET status = 'finished', winner = $1, settled_at = $2 WHERE id = $3 AND status = 'open' RETURNING *`,
      [result, now, id]
    );
    if (lockRes.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Match is already settled" });
      return;
    }
    const pendingBets = await client.query(
      `SELECT * FROM bets WHERE match_id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    let credited = 0;
    let refunded = 0;
    let winners = 0;
    if (result === "cancel") {
      for (const bet of pendingBets.rows) {
        const stakeAmt = Math.round(Number(bet.stake));
        const u = await client.query(
          `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
          [stakeAmt, bet.user_id]
        );
        const balAfter = u.rows[0]?.balance ?? stakeAmt;
        await client.query(
          `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'refund', $4)`,
          [
            bet.user_id,
            stakeAmt,
            balAfter,
            `Refund: ${match.league} - ${match.team_a} vs ${match.team_b} (contest cancelled)`
          ]
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
            [credit, bet.user_id]
          );
          const balAfter = u.rows[0]?.balance ?? credit;
          await client.query(
            `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'win', $4)`,
            [
              bet.user_id,
              credit,
              balAfter,
              `Win credit: ${match.league} - backed ${winnerName} @ ${Number(bet.odds).toFixed(2)}x (stake ${bet.stake})`
            ]
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
              `Loss settled: ${match.league} - backed ${backedName}, winner ${winnerName} (stake ${bet.stake})`
            ]
          );
          await client.query(`UPDATE bets SET status = 'lost', settled_at = $1 WHERE id = $2`, [now, bet.id]);
        }
      }
    }
    await client.query("COMMIT");
    res.json({ ok: true, credited, refunded, winners, settled: pendingBets.rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Settlement failed", detail: err.message });
  } finally {
    client.release();
  }
});
app.delete("/api/admin/matches/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const cnt = await pgPool.query(`SELECT count(*) as count FROM bets WHERE match_id = $1`, [id]);
  if (Number(cnt.rows[0].count) > 0) {
    res.status(400).json({ error: "Cannot delete match with placed bets" });
    return;
  }
  await pgPool.query(`DELETE FROM matches WHERE id = $1`, [id]);
  res.json({ ok: true });
});
app.get("/api/admin/matches/:id/bets", requireAdmin, async (req, res) => {
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
    const betsRows = resilientDb.isUsingPostgres() && db ? await db.select({
      id: bets.id,
      userId: bets.userId,
      matchId: bets.matchId,
      selection: bets.selection,
      odds: bets.odds,
      stake: bets.stake,
      status: bets.status,
      createdAt: bets.createdAt,
      settledAt: bets.settledAt,
      username: users.username,
      phone: users.phone
    }).from(bets).innerJoin(users, eq(bets.userId, users.id)).where(eq(bets.matchId, matchId)).orderBy(desc(bets.id)) : (await pgPool.query(
      `SELECT b.*, u.username, u.phone FROM bets b JOIN users u ON b.user_id = u.id WHERE b.match_id = $1 ORDER BY b.id DESC`,
      [matchId]
    )).rows;
    const bets2 = betsRows.map((b) => {
      const sel = b.selection === "B" ? "B" : "A";
      const oddsVal = Number(b.odds);
      const stakeVal = Number(b.stake);
      return {
        id: b.id,
        userId: b.userId ?? b.user_id,
        username: b.username,
        phone: b.phone ?? null,
        selection: sel,
        selectionTeam: sel === "A" ? m.team_a : m.team_b,
        odds: oddsVal,
        stake: stakeVal,
        potential: calculatePayout(stakeVal, oddsVal),
        status: b.status,
        createdAt: new Date(b.createdAt ?? b.created_at).toISOString(),
        settledAt: b.settledAt || b.settled_at ? new Date(b.settledAt ?? b.settled_at).toISOString() : null
      };
    });
    const summary = bets2.reduce(
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
      { totalBets: 0, totalStaked: 0, pendingStaked: 0, teamAStaked: 0, teamBStaked: 0 }
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
        createdAt: new Date(m.created_at).toISOString()
      },
      bets: bets2,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load match bets", detail: err.message });
  }
});
app.get("/api/admin/users", requireAdmin, async (req, res) => {
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
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sqlStr += ` AND (LOWER(u.username) LIKE $1 OR u.phone LIKE $1)`;
    }
    sqlStr += ` ORDER BY u.id DESC LIMIT 250`;
    const resUsers = await pgPool.query(sqlStr, params);
    res.json(
      resUsers.rows.map((u) => ({
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
        totalWithdrawn: Number(u.total_withdrawn)
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to search users" });
  }
});
app.get("/api/admin/users/:id/details", requireAdmin, async (req, res) => {
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
    const betRows = resilientDb.isUsingPostgres() && db ? await db.select({
      id: bets.id,
      matchId: bets.matchId,
      selection: bets.selection,
      odds: bets.odds,
      stake: bets.stake,
      status: bets.status,
      createdAt: bets.createdAt,
      settledAt: bets.settledAt,
      league: matches.league,
      teamA: matches.teamA,
      teamB: matches.teamB,
      matchStatus: matches.status,
      tossCloseTime: matches.tossCloseTime,
      winner: matches.winner
    }).from(bets).innerJoin(matches, eq(bets.matchId, matches.id)).where(eq(bets.userId, userId)).orderBy(desc(bets.id)).limit(200) : (await pgPool.query(
      `SELECT b.*, m.league, m.team_a, m.team_b, m.status as match_status, m.toss_close_time, m.winner
               FROM bets b
               JOIN matches m ON b.match_id = m.id
               WHERE b.user_id = $1
               ORDER BY b.id DESC LIMIT 200`,
      [userId]
    )).rows;
    const txRows = resilientDb.isUsingPostgres() && db ? await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.id)).limit(200) : (await pgPool.query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 120`,
      [userId]
    )).rows;
    const bets2 = betRows.map((b) => {
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
        selection: sel,
        selectionTeam: sel === "A" ? teamA : teamB,
        odds: oddsVal,
        stake: stakeVal,
        potential: calculatePayout(stakeVal, oddsVal),
        status: b.status,
        winner: b.winner ?? null,
        matchStatus: b.matchStatus ?? b.match_status,
        tossCloseTime: b.tossCloseTime || b.toss_close_time ? new Date(b.tossCloseTime ?? b.toss_close_time).toISOString() : void 0,
        canCancel: b.status === "pending",
        createdAt: new Date(b.createdAt ?? b.created_at).toISOString(),
        settledAt: b.settledAt || b.settled_at ? new Date(b.settledAt ?? b.settled_at).toISOString() : null
      };
    });
    const transactions2 = txRows.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter ?? t.balance_after),
      type: t.type,
      note: t.note ?? null,
      createdAt: new Date(t.createdAt ?? t.created_at).toISOString()
    }));
    let exposure = 0;
    let pendingBets = 0;
    let totalStaked = 0;
    let settledBetsCount = 0;
    let cancelledBetsCount = 0;
    for (const b of bets2) {
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
    for (const t of transactions2) {
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
        totalBets: bets2.length,
        totalDeposited,
        totalWithdrawn,
        totalStaked,
        totalWonCredited,
        totalBetsCount: bets2.length,
        settledBetsCount,
        cancelledBetsCount
      },
      bets: bets2,
      transactions: transactions2
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load user details", detail: err.message });
  }
});
app.post("/api/admin/users", requireAdmin, async (req, res) => {
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
      [u, pHash, ph, startBal]
    );
    if (startBal > 0) {
      await pgPool.query(
        `INSERT INTO transactions (user_id, amount, balance_after, type, note) VALUES ($1, $2, $3, 'admin_credit', 'Initial coin credit on ID creation')`,
        [created.rows[0].id, startBal, startBal]
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
        createdAt: created.rows[0].created_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create punter", detail: err.message });
  }
});
app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
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
          const [targetUser] = await tx.select({ balance: users.balance, role: users.role }).from(users).where(eq(users.id, id)).for("update");
          if (!targetUser) {
            throw Object.assign(new Error("User not found"), { status: 404 });
          }
          if (!isAdd && targetUser.balance < amt) {
            throw Object.assign(new Error("Amount exceeds punter's balance"), { status: 400 });
          }
          const delta = isAdd ? amt : -amt;
          const [updated] = await tx.update(users).set({ balance: sql`${users.balance} + ${delta}` }).where(eq(users.id, id)).returning({ balance: users.balance });
          const newBalance = updated.balance;
          await tx.insert(transactions).values({
            userId: id,
            amount: delta,
            balanceAfter: newBalance,
            type: isAdd ? "admin_credit" : "admin_debit",
            note: note || (isAdd ? "Admin deposit / coin load" : "Admin withdrawal / payout debit")
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
            note || (isAdd ? "Admin deposit / coin load" : "Admin withdrawal / payout debit")
          ]
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
  } catch (err) {
    const status = Number(err?.status) || 500;
    res.status(status).json({ error: err?.message || "Action failed" });
  }
});
app.get("/api/admin/users/generate", requireAdmin, async (_req, res) => {
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
    if (!username) username = `devil${Math.floor(1e3 + Math.random() * 9e3)}`;
    res.json({ username, password: generatePassword() });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate credentials" });
  }
});
app.get("/api/admin/users/check", requireAdmin, async (req, res) => {
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
app.get("/api/admin/settings", requireAdmin, async (_req, res) => {
  const s = await getPublicSettings();
  res.json(s);
});
app.patch("/api/admin/settings", requireAdmin, async (req, res) => {
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
    referralBonus
  } = req.body || {};
  try {
    const upserts = [];
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
    if (minBet !== void 0) upserts.push(["minBet", String(Math.max(1, Number(minBet)))]);
    if (minWithdraw !== void 0) upserts.push(["minWithdraw", String(Math.max(1, Number(minWithdraw)))]);
    if (referralBonus !== void 0) upserts.push(["referralBonus", String(Math.max(0, Number(referralBonus)))]);
    for (const [k, v] of upserts) {
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [k, v]
      );
    }
    res.json({ ok: true, settings: await getPublicSettings() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});
async function startServer() {
  await ensureDbReady();
  const distPath = path2.resolve("./dist");
  const hasDist = fs2.existsSync(path2.resolve(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || hasDist;
  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/health") {
        return next();
      }
      res.sendFile(path2.resolve(distPath, "index.html"));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("Vite middleware failed, falling back to static files:", err.message);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get("*", (_req, res) => {
          res.sendFile(path2.resolve(distPath, "index.html"));
        });
      }
    }
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, HOST, () => {
      const dbMode = resilientDb.isUsingPostgres() ? "Neon PostgreSQL" : "Local Resilient Store (Active)";
      console.log(`
\u{1F451} TOSS BOOK 786 Server running at http://${HOST}:${PORT}`);
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
var server_default = app;
export {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  DEFAULT_MARQUEE,
  DEFAULT_TELEGRAM,
  DEFAULT_WEBSITE,
  DEFAULT_WELCOME_TEMPLATE,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  app,
  bootstrapDatabase,
  server_default as default,
  effectiveMatchStatus,
  ensureDbReady,
  hashPassword,
  passwordFingerprint,
  pgPool,
  signSession,
  verifyPassword,
  verifySessionToken
};
