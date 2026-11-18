import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const rawUrl = process.env.DATABASE_URL?.trim() || "";
const isLocal = /@(127\.0\.0\.1|localhost)(:|\/|$)/.test(rawUrl);
const dbUrl =
  !rawUrl || isLocal || /[?&]sslmode=/i.test(rawUrl)
    ? rawUrl
    : rawUrl.includes("?")
      ? `${rawUrl}&sslmode=require`
      : `${rawUrl}?sslmode=require`;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbUrl,
  },
});
