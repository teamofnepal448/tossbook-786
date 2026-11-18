import { strict as assert } from "assert";
import fs from "fs";
import path from "path";
import app, {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  pgPool,
  hashPassword,
  verifyPassword,
  bootstrapDatabase,
} from "../server.ts";
import { calculatePayout } from "../src/lib/money.ts";

console.log("==========================================");
console.log("   TOSS BOOK 786 - E2E INTEGRATION SUITE  ");
console.log("==========================================\n");

let passed = 0;
let total = 0;

async function testAsync(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function run() {
  // Ensure schema and seeds are up to date
  await bootstrapDatabase();

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
    srv.on("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to bind ephemeral E2E HTTP server");
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  async function apiLogin(username: string, password: string): Promise<string> {
    const r = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(r.status, 200, `Login for ${username} must succeed`);
    const cookieHeader = r.headers.get("set-cookie");
    assert.ok(cookieHeader, "Login must issue session cookie");
    return cookieHeader.split(";")[0];
  }

  try {
    await testAsync("1. Database Connection & Table Introspection", async () => {
      const res = await pgPool.query("SELECT 1 as live");
      assert.equal(res.rows[0].live, 1);
      const tables = await pgPool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const names = tables.rows.map((r: any) => r.table_name);
      assert.ok(names.includes("users"), "users table must exist");
      assert.ok(names.includes("matches"), "matches table must exist");
      assert.ok(names.includes("bets"), "bets table must exist");
      assert.ok(names.includes("transactions"), "transactions table must exist");
      assert.ok(names.includes("settings"), "settings table must exist");
    });

    await testAsync("2. Admin & Demo Accounts Present in Database", async () => {
      const admin = await pgPool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
      assert.ok(admin.rows.length > 0, "Admin account must exist");
      assert.equal(admin.rows[0].username, "admin", "Admin username must be 'admin'");
      assert.equal(verifyPassword(ADMIN_PASSWORD, admin.rows[0].password_hash), true);

      const demo = await pgPool.query("SELECT * FROM users WHERE username = 'DEMO1' LIMIT 1");
      assert.ok(demo.rows.length > 0, "Demo account must exist");
      assert.equal(verifyPassword("demo123", demo.rows[0].password_hash), true);
    });

    await testAsync("3. Dynamic User Lifecycle (Create Punter, Deposit, Withdraw, Ban, Unban)", async () => {
      const testUser = `test_punter_${Date.now()}`;
      const rawPw = "RoyalPass@786";
      const pwHash = hashPassword(rawPw);

      const testPhone = "98" + Math.floor(10000000 + Math.random() * 90000000);

      const insertRes = await pgPool.query(
        `INSERT INTO users (username, password_hash, role, balance, banned, phone) VALUES ($1, $2, 'punter', 500, false, $3) RETURNING *`,
        [testUser, pwHash, testPhone],
      );
      const u = insertRes.rows[0];
      assert.equal(u.username, testUser);
      assert.equal(u.balance, 500);

      assert.equal(verifyPassword(rawPw, u.password_hash), true);
      assert.equal(verifyPassword("wrongpass", u.password_hash), false);

      await pgPool.query(`UPDATE users SET balance = balance + 1000 WHERE id = $1`, [u.id]);
      const afterDep = await pgPool.query(`SELECT balance FROM users WHERE id = $1`, [u.id]);
      assert.equal(afterDep.rows[0].balance, 1500);

      await pgPool.query(`UPDATE users SET balance = balance - 300 WHERE id = $1`, [u.id]);
      const afterWith = await pgPool.query(`SELECT balance FROM users WHERE id = $1`, [u.id]);
      assert.equal(afterWith.rows[0].balance, 1200);

      await pgPool.query(`UPDATE users SET banned = true WHERE id = $1`, [u.id]);
      const bannedRes = await pgPool.query(`SELECT banned FROM users WHERE id = $1`, [u.id]);
      assert.equal(bannedRes.rows[0].banned, true);

      await pgPool.query(`UPDATE users SET banned = false WHERE id = $1`, [u.id]);
      const unbannedRes = await pgPool.query(`SELECT banned FROM users WHERE id = $1`, [u.id]);
      assert.equal(unbannedRes.rows[0].banned, false);

      await pgPool.query(`DELETE FROM users WHERE id = $1`, [u.id]);
    });

    await testAsync("4. Settings & Telegram Configuration Management", async () => {
      const prevRes = await pgPool.query(`SELECT value FROM settings WHERE key = 'telegramUrl'`);
      const prevTelegram = prevRes.rows[0]?.value ?? "https://t.me/+FNrv5zNv6lI0ODk1";
      const testTelegram = "https://t.me/TestOfficial786";
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ('telegramUrl', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [testTelegram],
      );
      const res = await pgPool.query(`SELECT value FROM settings WHERE key = 'telegramUrl'`);
      assert.equal(res.rows[0].value, testTelegram);

      // Restore previous Telegram link
      await pgPool.query(
        `INSERT INTO settings (key, value) VALUES ('telegramUrl', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [prevTelegram],
      );
    });

    await testAsync("5. Punter Welcome Template & Deposit/Withdraw Redirection URLs Configured", async () => {
      const templateRes = await pgPool.query(`SELECT value FROM settings WHERE key = 'userWelcomeTemplate'`);
      assert.ok(templateRes.rows.length > 0, "userWelcomeTemplate must exist in settings");
      assert.ok(templateRes.rows[0].value.includes("{username}"), "Template must support {username}");

      const depRes = await pgPool.query(`SELECT value FROM settings WHERE key = 'depositTelegramUrl'`);
      assert.ok(depRes.rows.length > 0, "depositTelegramUrl must exist in settings");

      const withRes = await pgPool.query(`SELECT value FROM settings WHERE key = 'withdrawTelegramUrl'`);
      assert.ok(withRes.rows.length > 0, "withdrawTelegramUrl must exist in settings");
    });

    await testAsync("6. Full Atomic Toss Bet -> Admin Declare Winner -> Wallet Payout & Idempotency", async () => {
      const adminCookie = await apiLogin(ADMIN_USERNAME, ADMIN_PASSWORD);
      const suffix = Date.now();
      const winUser = `e2e_win_${suffix}`;
      const loseUser = `e2e_lose_${suffix}`;
      const pw = "RoyalPass@786";

      // Create two test punters via Admin API
      const createWin = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ username: winUser, password: pw, initialBalance: 1000 }),
      });
      assert.equal(createWin.status, 200);
      const { user: winProfile } = await createWin.json();

      const createLose = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ username: loseUser, password: pw, initialBalance: 1000 }),
      });
      assert.equal(createLose.status, 200);
      const { user: loseProfile } = await createLose.json();

      // Create a live match via Admin API (started 5m ago, closes in 20m)
      const now = Date.now();
      const createMatch = await fetch(`${baseUrl}/api/admin/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({
          league: "E2E TOSS CUP",
          teamA: "INDIA",
          teamB: "NEPAL",
          startTime: new Date(now - 5 * 60_000).toISOString(),
          tossCloseTime: new Date(now + 20 * 60_000).toISOString(),
          oddsA: 1.95,
          oddsB: 1.95,
        }),
      });
      assert.equal(createMatch.status, 200);
      const { match } = await createMatch.json();

      // Both punters log in and place toss bets
      const winCookie = await apiLogin(winUser, pw);
      const loseCookie = await apiLogin(loseUser, pw);

      const betA = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: winCookie },
        body: JSON.stringify({ matchId: match.id, selection: "A", stake: 500 }),
      });
      assert.equal(betA.status, 200);
      const betAData = await betA.json();
      assert.equal(betAData.balance, 500, "Winner balance after 500 bet must be 500");
      assert.equal(betAData.exposure, 500, "Winner exposure after 500 bet must be 500");

      const betB = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: loseCookie },
        body: JSON.stringify({ matchId: match.id, selection: "B", stake: 400 }),
      });
      assert.equal(betB.status, 200);
      const betBData = await betB.json();
      assert.equal(betBData.balance, 600, "Loser balance after 400 bet must be 600");
      assert.equal(betBData.exposure, 400, "Loser exposure after 400 bet must be 400");

      // Admin declares Team A (INDIA) as toss winner
      const settleRes = await fetch(`${baseUrl}/api/admin/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ result: "A" }),
      });
      assert.equal(settleRes.status, 200);
      const settled = await settleRes.json();
      const expectedCredit = calculatePayout(500, 1.95); // 975
      assert.equal(settled.credited, expectedCredit, `Credited payout must be ${expectedCredit}`);
      assert.equal(settled.winners, 1);
      assert.equal(settled.settled, 2);

      // Verify Winner's live wallet balance & exposure immediately via /api/me
      const winMeRes = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: winCookie } });
      const winMe = await winMeRes.json();
      assert.equal(winMe.balance, 500 + expectedCredit, "Winner balance must immediately reflect payout credit");
      assert.equal(winMe.exposure, 0, "Winner exposure must reset to 0 after settlement");

      // Verify Winner's bet status and WIN ledger row
      const winBets = await (await fetch(`${baseUrl}/api/bets`, { headers: { Cookie: winCookie } })).json();
      assert.equal(winBets[0].status, "won");

      const winTx = await (await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: winCookie } })).json();
      const winLedger = winTx.find((t: any) => t.type === "win");
      assert.ok(winLedger, "Winner transaction history must contain a 'win' ledger entry");
      assert.equal(winLedger.amount, expectedCredit);
      assert.equal(winLedger.balanceAfter, 500 + expectedCredit);

      // Verify Loser's wallet, bet status = lost, and LOSS ledger entry
      const loseMe = await (await fetch(`${baseUrl}/api/me`, { headers: { Cookie: loseCookie } })).json();
      assert.equal(loseMe.balance, 600, "Loser balance must remain 600");
      assert.equal(loseMe.exposure, 0, "Loser exposure must reset to 0");

      const loseBets = await (await fetch(`${baseUrl}/api/bets`, { headers: { Cookie: loseCookie } })).json();
      assert.equal(loseBets[0].status, "lost");

      const loseTx = await (await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: loseCookie } })).json();
      const lossLedger = loseTx.find((t: any) => t.type === "loss");
      assert.ok(lossLedger, "Loser transaction history must contain a 'loss' ledger entry");
      assert.equal(lossLedger.amount, 0);

      // Verify strict double-payout idempotency check
      const duplicateSettle = await fetch(`${baseUrl}/api/admin/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ result: "A" }),
      });
      assert.equal(duplicateSettle.status, 400, "Duplicate declare must be rejected with HTTP 400");

      const winMeAfterDup = await (await fetch(`${baseUrl}/api/me`, { headers: { Cookie: winCookie } })).json();
      assert.equal(winMeAfterDup.balance, 500 + expectedCredit, "Winner balance must NOT be double-credited");

      // Cleanup E2E rows
      await pgPool.query(`DELETE FROM transactions WHERE user_id IN ($1, $2)`, [winProfile.id, loseProfile.id]);
      await pgPool.query(`DELETE FROM bets WHERE match_id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM matches WHERE id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [winProfile.id, loseProfile.id]);
    });

    await testAsync("7. Match Cancellation & Full Refund Ledger Verification", async () => {
      const adminCookie = await apiLogin(ADMIN_USERNAME, ADMIN_PASSWORD);
      const punterName = `e2e_ref_${Date.now()}`;
      const pw = "RoyalPass@786";

      const { user: created } = await (
        await fetch(`${baseUrl}/api/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: adminCookie },
          body: JSON.stringify({ username: punterName, password: pw, initialBalance: 800 }),
        })
      ).json();

      const now = Date.now();
      const { match } = await (
        await fetch(`${baseUrl}/api/admin/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: adminCookie },
          body: JSON.stringify({
            league: "E2E REFUND CUP",
            teamA: "CSK",
            teamB: "MI",
            startTime: new Date(now - 5 * 60_000).toISOString(),
            tossCloseTime: new Date(now + 15 * 60_000).toISOString(),
            oddsA: 1.95,
            oddsB: 1.95,
          }),
        })
      ).json();

      const pCookie = await apiLogin(punterName, pw);
      const betRes = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: pCookie },
        body: JSON.stringify({ matchId: match.id, selection: "B", stake: 300 }),
      });
      assert.equal(betRes.status, 200);

      const cancelRes = await fetch(`${baseUrl}/api/admin/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ result: "cancel" }),
      });
      assert.equal(cancelRes.status, 200);
      const cancelData = await cancelRes.json();
      assert.equal(cancelData.refunded, 300);

      const pMe = await (await fetch(`${baseUrl}/api/me`, { headers: { Cookie: pCookie } })).json();
      assert.equal(pMe.balance, 800, "Refunded stake must restore full 800 balance");
      assert.equal(pMe.exposure, 0);

      const pBets = await (await fetch(`${baseUrl}/api/bets`, { headers: { Cookie: pCookie } })).json();
      assert.equal(pBets[0].status, "refunded");

      const pTx = await (await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: pCookie } })).json();
      assert.ok(pTx.some((t: any) => t.type === "refund" && t.amount === 300 && t.balanceAfter === 800));

      // Cleanup
      await pgPool.query(`DELETE FROM transactions WHERE user_id = $1`, [created.id]);
      await pgPool.query(`DELETE FROM bets WHERE match_id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM matches WHERE id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM users WHERE id = $1`, [created.id]);
    });

    await testAsync("8. Self-Service Change Password & Global Session Invalidation", async () => {
      // Unauthenticated check
      const unauth = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "OldPass@123",
          newPassword: "NewPass@786",
          confirmPassword: "NewPass@786",
        }),
      });
      assert.equal(unauth.status, 401, "Unauthenticated change-password must return 401");

      const adminCookie = await apiLogin(ADMIN_USERNAME, ADMIN_PASSWORD);
      const cpUser = `cp_user_${Date.now()}`;
      const oldPw = "OldPass@123";
      const newPw = "NewPass@786";

      const createRes = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ username: cpUser, password: oldPw, initialBalance: 100 }),
      });
      assert.equal(createRes.status, 200);
      const { user: created } = await createRes.json();

      const oldCookie = await apiLogin(cpUser, oldPw);

      // Mismatched confirmation
      const mismatchRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({
          currentPassword: oldPw,
          newPassword: newPw,
          confirmPassword: "Different@999",
        }),
      });
      assert.equal(mismatchRes.status, 400);

      // Too short new password (< 6 chars)
      const shortRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({
          currentPassword: oldPw,
          newPassword: "12345",
          confirmPassword: "12345",
        }),
      });
      assert.equal(shortRes.status, 400);

      // Same password as current
      const sameRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({
          currentPassword: oldPw,
          newPassword: oldPw,
          confirmPassword: oldPw,
        }),
      });
      assert.equal(sameRes.status, 400);

      // Wrong current password
      const wrongCurRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({
          currentPassword: "WrongCurrent@000",
          newPassword: newPw,
          confirmPassword: newPw,
        }),
      });
      assert.equal(wrongCurRes.status, 400);

      // Valid password update
      const okRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({
          currentPassword: oldPw,
          newPassword: newPw,
          confirmPassword: newPw,
        }),
      });
      assert.equal(okRes.status, 200);
      const okData = await okRes.json();
      assert.equal(okData.ok, true);
      assert.equal(okData.sessionCleared, true);

      // Prior session cookie must now be rejected (cryptographically invalidated)
      const oldMeRes = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: oldCookie } });
      assert.equal(oldMeRes.status, 401, "Old session token must be invalidated after password change");

      // Old password must fail to log in
      const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cpUser, password: oldPw }),
      });
      assert.equal(oldLoginRes.status, 401, "Old password must be rejected");

      // New password must succeed and issue a valid session
      const newCookie = await apiLogin(cpUser, newPw);
      const newMeRes = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: newCookie } });
      assert.equal(newMeRes.status, 200);
      const newMe = await newMeRes.json();
      assert.equal(newMe.username, cpUser);

      // Cleanup
      await pgPool.query(`DELETE FROM users WHERE id = $1`, [created.id]);
    });

    await testAsync("9. Bet Cancellation (2% Fee Deduction, 98% Refund) & Admin User/Match Breakdown APIs", async () => {
      const adminCookie = await apiLogin(ADMIN_USERNAME, ADMIN_PASSWORD);
      const punterName = `e2e_cancel_${Date.now()}`;
      const pw = "RoyalPass@786";

      const { user: created } = await (
        await fetch(`${baseUrl}/api/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: adminCookie },
          body: JSON.stringify({ username: punterName, password: pw, phone: "9876543210", initialBalance: 1000 }),
        })
      ).json();

      const now = Date.now();
      const { match } = await (
        await fetch(`${baseUrl}/api/admin/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: adminCookie },
          body: JSON.stringify({
            league: "E2E CANCEL CUP",
            teamA: "INDIA",
            teamB: "AUSTRALIA",
            startTime: new Date(now - 5 * 60_000).toISOString(),
            tossCloseTime: new Date(now + 20 * 60_000).toISOString(),
            oddsA: 1.95,
            oddsB: 1.95,
          }),
        })
      ).json();

      const pCookie = await apiLogin(punterName, pw);

      // Punter places a 500 Rs. bet -> wallet becomes 500, exposure becomes 500
      const betRes = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: pCookie },
        body: JSON.stringify({ matchId: match.id, selection: "A", stake: 500 }),
      });
      assert.equal(betRes.status, 200);
      const betData = await betRes.json();
      assert.equal(betData.balance, 500);
      assert.equal(betData.exposure, 500);

      // Punter cancels the 500 Rs. bet -> 2% fee (10), 98% refund (490), balance = 990
      const cancelRes = await fetch(`${baseUrl}/api/bets/${betData.bet.id}/cancel`, {
        method: "POST",
        headers: { Cookie: pCookie },
      });
      assert.equal(cancelRes.status, 200);
      const cancelOut = await cancelRes.json();
      assert.equal(cancelOut.ok, true);
      assert.equal(cancelOut.status, "cancelled");
      assert.equal(cancelOut.stake, 500);
      assert.equal(cancelOut.fee, 10);
      assert.equal(cancelOut.refunded, 490);
      assert.equal(cancelOut.balance, 990);
      assert.equal(cancelOut.exposure, 0);

      // Duplicate cancellation must fail with 400 (no double refund!)
      const dupCancel = await fetch(`${baseUrl}/api/bets/${betData.bet.id}/cancel`, {
        method: "POST",
        headers: { Cookie: pCookie },
      });
      assert.equal(dupCancel.status, 400, "Duplicate cancellation must be rejected");

      // Verify transaction ledger entry
      const txList = await (await fetch(`${baseUrl}/api/transactions`, { headers: { Cookie: pCookie } })).json();
      const cancelTx = txList.find((t: any) => t.type === "bet_cancelled");
      assert.ok(cancelTx, "Transaction history must include a bet_cancelled entry");
      assert.equal(cancelTx.amount, 490);
      assert.equal(cancelTx.balanceAfter, 990);

      // Verify Admin User Breakdown API (/api/admin/users/:id/details)
      const detailRes = await fetch(`${baseUrl}/api/admin/users/${created.id}/details`, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(detailRes.status, 200);
      const detail = await detailRes.json();
      assert.equal(detail.user.username, punterName);
      assert.equal(detail.user.balance, 990);
      assert.equal(detail.user.exposure, 0);
      assert.equal(detail.user.cancelledBetsCount, 1);
      assert.equal(detail.bets.length, 1);
      assert.equal(detail.bets[0].status, "cancelled");
      assert.equal(detail.bets[0].teamA, "INDIA");
      assert.equal(detail.bets[0].teamB, "AUSTRALIA");
      assert.equal(detail.bets[0].selectionTeam, "INDIA");
      assert.equal(detail.bets[0].stake, 500);
      assert.ok(detail.transactions.length >= 3, "Transactions must include initial deposit, bet debit, and cancel refund");

      // Verify Admin Match Bets Breakdown API (/api/admin/matches/:id/bets)
      const matchBetsRes = await fetch(`${baseUrl}/api/admin/matches/${match.id}/bets`, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(matchBetsRes.status, 200);
      const matchBets = await matchBetsRes.json();
      assert.equal(matchBets.summary.totalBets, 1);
      assert.equal(matchBets.bets[0].username, punterName);
      assert.equal(matchBets.bets[0].status, "cancelled");

      // Place another bet of 200, then test Admin-initiated cancel (/api/admin/bets/:id/cancel)
      const betRes2 = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: pCookie },
        body: JSON.stringify({ matchId: match.id, selection: "B", stake: 200 }),
      });
      assert.equal(betRes2.status, 200);
      const betData2 = await betRes2.json();
      assert.equal(betData2.balance, 790);

      // Non-admin attempt on admin endpoint must be 403
      const nonAdminCancel = await fetch(`${baseUrl}/api/admin/bets/${betData2.bet.id}/cancel`, {
        method: "POST",
        headers: { Cookie: pCookie },
      });
      assert.equal(nonAdminCancel.status, 403);

      // Admin cancels 200 Rs. bet -> 2% fee (4), 98% refund (196), balance = 790 + 196 = 986
      const adminCancel = await fetch(`${baseUrl}/api/admin/bets/${betData2.bet.id}/cancel`, {
        method: "POST",
        headers: { Cookie: adminCookie },
      });
      assert.equal(adminCancel.status, 200);
      const adminCancelOut = await adminCancel.json();
      assert.equal(adminCancelOut.fee, 4);
      assert.equal(adminCancelOut.refunded, 196);
      assert.equal(adminCancelOut.balance, 986);

      // Verify punter cannot cancel a bet once toss close cutoff has passed
      const betRes3 = await fetch(`${baseUrl}/api/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: pCookie },
        body: JSON.stringify({ matchId: match.id, selection: "A", stake: 100 }),
      });
      assert.equal(betRes3.status, 200);
      const betData3 = await betRes3.json();

      // Move tossCloseTime into the past to lock the match
      await fetch(`${baseUrl}/api/admin/matches/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ tossCloseTime: new Date(Date.now() - 60_000).toISOString() }),
      });

      const latePunterCancel = await fetch(`${baseUrl}/api/bets/${betData3.bet.id}/cancel`, {
        method: "POST",
        headers: { Cookie: pCookie },
      });
      assert.equal(latePunterCancel.status, 400, "Punter must not cancel after toss close cutoff");

      // Cleanup
      await pgPool.query(`DELETE FROM transactions WHERE user_id = $1`, [created.id]);
      await pgPool.query(`DELETE FROM bets WHERE match_id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM matches WHERE id = $1`, [match.id]);
      await pgPool.query(`DELETE FROM users WHERE id = $1`, [created.id]);
    });
  } finally {
    server.close();
    console.log(`\n==========================================`);
    console.log(`  E2E RESULTS: ${passed} / ${total} PASSED`);
    console.log(`==========================================\n`);
    await pgPool.end();
  }
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
