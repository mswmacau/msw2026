const BASE = 'http://localhost:3000';
let jar = new Map();

function cookieHeader() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    redirect: 'manual',
    headers: {
      ...(opts.headers || {}),
      Cookie: cookieHeader(),
    },
  });
  storeCookies(res);
  return res;
}

function log(step, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${step}${extra ? ' — ' + extra : ''}`);
  if (!ok) process.exitCode = 1;
}

async function login(email, password) {
  jar = new Map();
  const csrfRes = await req('/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    json: 'true',
  });
  const res = await req('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const sess = await req('/api/auth/session');
  const data = await sess.json().catch(() => ({}));
  return { res, session: data };
}

console.log('\n===== MSW 街健館 端到端流程驗證 =====\n');

// 1. 會員登入
const m = await login('ming@msw.mo', 'msw2026');
log('會員登入 (ming@msw.mo)', !!m.session?.user?.email, m.session?.user?.email || m.res.status);
const memberId = m.session?.user?.id;
const pointsBefore = m.session?.user?.points ?? 0;
console.log(`   會員 id=${memberId}  目前積分=${pointsBefore}`);

// 2. 上傳跑步紀錄 10 KM
const create = await req('/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    km: 10,
    screenshotUrl: '/images/running-track.jpg',
    note: 'E2E 測試上傳',
  }),
});
const created = await create.json();
log('上傳跑步紀錄 10KM', create.ok && !!created.id, JSON.stringify(created));

// 3. 未審核前不計入累積
const myRuns = await req('/api/runs');
const runsData = await myRuns.json();
const pendingCount = runsData.records.filter((r) => r.status === 'PENDING').length;
log('紀錄狀態為待確認', pendingCount >= 1, `待確認 ${pendingCount} 筆`);

// 4. 管理員登入
const a = await login('admin@msw.mo', 'msw2026admin');
log('管理員登入', !!a.session?.user?.email, a.session?.user?.email || String(a.res.status));

// 5. 管理員看到待審核清單
const all = await req('/api/runs?all=1&status=PENDING');
const allData = await all.json();
const target = allData.records.find((r) => r.id === created.id);
log('後台取得待審核清單', !!target, `共 ${allData.records.length} 筆待審核`);

// 6. 管理員確認
const approve = await req(`/api/admin/runs/${created.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'approve' }),
});
const approveData = await approve.json();
log('管理員確認紀錄', approve.ok, approveData.message || approveData.error);

// 7. 積分是否增加（1KM = 1分）
const m2 = await login('ming@msw.mo', 'msw2026');
const pointsAfter = m2.session?.user?.points ?? 0;
log(
  '會員積分已回饋 (+10)',
  pointsAfter === pointsBefore + 10,
  `${pointsBefore} → ${pointsAfter}`
);

// 8. 權限檢查：一般會員不能審核
const forbidden = await req(`/api/admin/runs/${created.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'approve' }),
});
log('一般會員無法審核（403）', forbidden.status === 403, `HTTP ${forbidden.status}`);

// 9. 管理員查看當月達成名單 + 發券
await login('admin@msw.mo', 'msw2026admin');
const month = new Date().toISOString().slice(0, 7);
const winners = await req(`/api/admin/coupons?month=${month}`);
const winnersData = await winners.json();
log('取得當月達成名單', winners.ok, `${winnersData.winners?.length ?? 0} 人達標`);

// 9b. 對達標會員 Kelvin 發券（同一個月第一次 → 應成功）
const kelvin = winnersData.winners?.[0];
const issue = await req('/api/admin/coupons', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    month,
    userIds: [kelvin.userId],
    title: `${month} 月度 300KM 達成優惠券`,
    discount: '全館 8 折',
  }),
});
const issueData = await issue.json();
log(
  '對達標會員發放優惠券',
  issue.ok && issueData.issued >= 1,
  `issued=${issueData.issued} code=${issueData.coupons?.[0]?.code || kelvin.alreadyIssued ? '(已發過)' : ''}`
);

// 10. 會員看得到自己的優惠券（切回 ming，他上一輪已領過券）
await login('ming@msw.mo', 'msw2026');
const dash = await req('/dashboard');
const dashHtml = await dash.text();
log('會員中心顯示優惠券', dashHtml.includes('MSW-'), dashHtml.includes('MSW-') ? '找到券號' : '未找到');

// 11. 重複發券不會產生第二張（切回管理員）
await login('admin@msw.mo', 'msw2026admin');
const issue2 = await req('/api/admin/coupons', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ month, userIds: [kelvin.userId] }),
});
const issue2Data = await issue2.json();
log('重複發券被擋下（同月不重複）', issue2Data.issued === 0, `issued=${issue2Data.issued}`);

console.log('\n===== 驗證結束 =====\n');
