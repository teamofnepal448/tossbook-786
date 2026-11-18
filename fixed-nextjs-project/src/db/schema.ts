import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("punter"), // 'admin' | 'punter'
  balance: integer("balance").notNull().default(0),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  league: text("league").notNull(),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  tossCloseTime: timestamp("toss_close_time", { withTimezone: true }).notNull(),
  oddsA: numeric("odds_a", { precision: 8, scale: 2 }).notNull().default("1.97"),
  oddsB: numeric("odds_b", { precision: 8, scale: 2 }).notNull().default("1.97"),
  status: text("status").notNull().default("open"), // 'open' | 'finished' | 'cancelled'
  winner: text("winner"), // 'A' | 'B' | null
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bets = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id),
  selection: text("selection").notNull(), // 'A' | 'B'
  odds: numeric("odds", { precision: 8, scale: 2 }).notNull(),
  stake: integer("stake").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'won' | 'lost' | 'refunded'
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(), // signed coins
  balanceAfter: integer("balance_after").notNull(),
  type: text("type").notNull(), // 'admin_credit' | 'admin_debit' | 'bet' | 'win' | 'refund'
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type UserRow = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type MatchRow = InferSelectModel<typeof matches>;
export type NewMatch = InferInsertModel<typeof matches>;
export type BetRow = InferSelectModel<typeof bets>;
export type TxRow = InferSelectModel<typeof transactions>;
export type SettingRow = InferSelectModel<typeof settings>;
