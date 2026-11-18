# TOSS BOOK 786 — Bug Audit & Setup Guide

Asia's No. 1 Premium Toss Platform (Next.js 15+ / React 19 / PostgreSQL / Drizzle ORM).

---

## 🛠 Summary of Audited & Fixed Bugs

| Component / File | Original Defect / Bug | Root Cause | Implemented Solution |
|---|---|---|---|
| `src/lib/seed.ts` | **Fatal syntax error on bootstrap** | Unclosed string quotes on `ADMIN_USERNAME` and `ADMIN_PASSWORD` caused build / syntax crash when imported by any route. | Fixed string literals and closing semicolons. |
| `src/lib/seed.ts` | **Race condition on concurrent requests** | `attempted` boolean set to `true` before async seed completed, causing concurrent requests to query empty DB. | Wrapped initialization in a shared `seedPromise` so concurrent requests safely await table bootstrap. |
| `src/lib/seed.ts` | **Missing DB tables on cold start** | Tables not created if `drizzle-kit push` was not executed beforehand. | Added automatic `CREATE TABLE IF NOT EXISTS` bootstrap query for users, matches, bets, transactions, settings. |
| `src/lib/auth.ts` | **TypeError in `verifyPassword`** | Calling `.split(":")` on null/undefined or malformed stored hash crashed authentication. | Added defensive null, string, and salt/hash hex validation. |
| `src/lib/auth.ts` & `login/route.ts` | **Session Cookie loss / Login Redirect Loop** | In Next.js App Router, cookie set on async store was not directly applied to `NextResponse.json` headers in all runtime configurations. | Added `attachSessionCookie` and `attachClearSessionCookie` to guarantee `Set-Cookie` header delivery on HTTP response. |
| `src/app/login/login-client.tsx` | **Credentials not passed in fetch** | Fetch calls omitted `credentials: "include"`, causing session cookie to be dropped in cross-context requests. | Added `credentials: "include"` and full page redirect to sync session state. |
| `src/db/index.ts` | **App crash if DATABASE_URL unset** | Immediate unhandled `throw new Error("DATABASE_URL is required")` upon file import. | Provided sensible fallback and TLS configuration options for remote poolers (e.g. Supabase, Neon, Cloud SQL). |
| `src/app/api/bets/route.ts` | **Bet placement validation** | Stake boundaries and match lifecycle states weren't fully guarded against concurrent race conditions. | Enforced SQL transactions with row-level locks (`for update`) and atomic wallet deductions. |
| `drizzle.config.json` | **Hardcoded production secrets** | Database credentials with plaintext password committed to config file. | Converted to `drizzle.config.ts` using `process.env.DATABASE_URL` and safe `.env.example`. |

---

## 🚀 Setup & Running Instructions

### 1. Requirements
- Node.js 18+ or 20+ (Node 22 supported)
- PostgreSQL database (Supabase, Neon, AWS RDS, Cloud SQL, or local PostgreSQL)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update your `.env` with your PostgreSQL database URL:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/tossbook786"
SESSION_SECRET="your-super-secret-random-32-byte-hex-string"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Push Database Schema (Optional if running auto-seed)
```bash
npm run db:push
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Default Credentials

- **Super Admin**:
  - Username: `DEVILTOSSBOOK575538636`
  - Password: `DEVILTOSSBOKKADMINPANELLOGIN`
  - Portal: `/admin`

- **Demo Punter**:
  - Username: `DEMO1`
  - Password: `demo123`
  - Initial Balance: `10,000` coins
  - Portal: `/dashboard`
