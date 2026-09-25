import Link from 'next/link';
import { Counter } from '@/components/Counter';
import { Reveal } from '@/components/Reveal';
import { prisma } from '@/lib/prisma';
import { RULES, currentMonth } from '@/lib/points';
import { getSettings, DEFAULT_SETTINGS } from '@/lib/site';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const month = currentMonth();
    const [members, kmAgg, doneThisMonth, coupons] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.runRecord.aggregate({
        where: { status: 'APPROVED' },
        _sum: { km: true },
      }),
      prisma.runRecord.groupBy({
        by: ['userId'],
        where: { periodMonth: month, status: 'APPROVED' },
        _sum: { km: true },
      }),
      prisma.coupon.count(),
    ]);
    return {
      members,
      totalKm: Math.round(Number(kmAgg._sum.km ?? 0)),
      completers: doneThisMonth.filter(
        (r) => Number(r._sum.km ?? 0) >= RULES.MONTHLY_KM_GOAL
      ).length,
      coupons,
    };
  } catch (e) {
    console.error('[getStats] 統計查詢失敗：', e);
    return { members: 0, totalKm: 0, completers: 0, coupons: 0 };
  }
}

const REASONS = [
  {
    icon: '🏋️',
    title: '打破場地與時間限制',
    desc: '公園的單槓、海堤的跑道、你家樓下的空地——任何時間、任何地方，都可以開始訓練。',
  },
  {
    icon: '🎯',
    title: '積分累積，換得到東西',
    desc: `每確認 1 公里累積 ${RULES.POINTS_PER_KM} 分，出席定期訓練再拿 ${RULES.TRAINING_POINTS} 分，積分可兌換街健館課程與周邊。`,
  },
  {
    icon: '🤝',
    title: '與澳門的訓練夥伴一起',
    desc: '一個人容易放棄，一群人會互相拉一把。MSW 是你不用解釋就能懂的訓練社群。',
  },
];

const STEPS = [
  {
    n: '01',
    title: '註冊成為會員',
    desc: '用 Email 或 Google 帳號一分鐘完成註冊，立即獲得會員編號與積分帳戶。',
  },
  {
    n: '02',
    title: '參加活動、上傳紀錄',
    desc: '每週一 20:00 到場訓練並簽到；平時跑步後上傳截圖與公里數，等待管理員確認。',
  },
  {
    n: '03',
    title: '累積里程、領取優惠券',
    desc: `單月累積滿 ${RULES.MONTHLY_KM_GOAL} 公里即達成任務，月底由後台統一發放專屬優惠券。`,
  },
];

const PARTNERS = [
  '澳門體育總會',
  'MACAU FIT',
  '街健聯盟',
  'RUN MACAU',
  '黑沙環體育中心',
  '氹仔中央公園',
  '路環跑道',
  'MSW CREW',
];

export default async function HomePage() {
  const [stats, s] = await Promise.all([getStats(), getSettings()]);
  const hero = { ...DEFAULT_SETTINGS, ...s };

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${hero.hero_background || '/images/hero-workout.jpg'})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/70" />
        <div className="absolute inset-0 grid-noise opacity-60" />
        {/* 光暈 */}
        <div className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-cobaltBright/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[360px] w-[360px] rounded-full bg-energy/20 blur-[120px]" />

        <div className="container-msw relative z-10 pb-16 pt-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-energy" />
              {hero.hero_badge}
            </span>

            <h1 className="mt-7 h1">
              {hero.hero_title}
              <br />
              <span className="text-gradient">{hero.hero_title_highlight}</span>
            </h1>

            <p className="lead mt-7 max-w-xl whitespace-pre-line">{hero.hero_subtitle}</p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/register" className="btn-primary">
                {hero.hero_cta_primary}
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/events" className="btn-ghost">
                {hero.hero_cta_secondary}
              </Link>
            </div>

            {/* 下場訓練倒數 */}
            <div className="mt-12 inline-flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 bg-white/[.04] px-6 py-4 backdrop-blur">
              <div>
                <p className="text-[11px] tracking-wider text-white/45">下場定期訓練</p>
                <p className="text-lg font-black">每週一 20:00 – 21:00</p>
              </div>
              <span className="hidden h-10 w-px bg-white/15 sm:block" />
              <div>
                <p className="text-[11px] tracking-wider text-white/45">本月累積跑目標</p>
                <p className="text-lg font-black text-energyBright">
                  {RULES.MONTHLY_KM_GOAL} KM
                </p>
              </div>
              <span className="hidden h-10 w-px bg-white/15 sm:block" />
              <div>
                <p className="text-[11px] tracking-wider text-white/45">積分回饋</p>
                <p className="text-lg font-black text-cobaltBright">
                  1 KM = {RULES.POINTS_PER_KM} 分
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-white/30">
          <svg className="h-6 w-6 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* ============ 累積數據 ============ */}
      <section className="border-y border-white/10 bg-ink2">
        <div className="container-msw grid grid-cols-2 gap-8 py-12 lg:grid-cols-4">
          {[
            { label: '會員人數', value: stats.members, suffix: ' 人' },
            { label: '累積總里程', value: stats.totalKm, suffix: ' KM' },
            { label: '本月達標人數', value: stats.completers, suffix: ' 人' },
            { label: '已發出優惠券', value: stats.coupons, suffix: ' 張' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-white sm:text-4xl">
                <Counter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-2 text-xs tracking-wider text-white/45">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 三大理由 ============ */}
      <section className="section">
        <div className="container-msw">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">WHY MSW</span>
              <h2 className="h2 mt-5">
                超越界限，讓訓練
                <span className="text-energy"> 增加驅動力</span>
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {REASONS.map((r, i) => (
              <Reveal key={r.title} delay={i * 120}>
                <div className="card card-hover h-full">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cobaltBright/25 to-energy/20 text-2xl">
                    {r.icon}
                  </span>
                  <h3 className="h3 mt-6">{r.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{r.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 我們的活動 ============ */}
      <section className="section bg-ink2">
        <div className="container-msw">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="eyebrow">ACTIVITIES</span>
                <h2 className="h2 mt-5">我們的活動</h2>
              </div>
              <Link href="/events" className="text-sm font-semibold text-cobaltBright hover:underline">
                查看全部活動 →
              </Link>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/* 定期訓練 */}
            <Reveal>
              <Link
                href="/events/weekly-training"
                className="group relative block h-full overflow-hidden rounded-3xl border border-white/10"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: 'url(/images/street-workout.jpg)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
                <div className="relative flex h-full min-h-[420px] flex-col justify-end p-8">
                  <span className="chip bg-cobaltBright text-white">常態活動</span>
                  <h3 className="mt-4 text-3xl font-black">定期訓練活動</h3>
                  <p className="mt-2 text-sm font-semibold text-energyBright">
                    逢星期一 20:00 – 21:00
                  </p>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
                    單槓、雙槓、地板動作為主的團體訓練。新手有基礎動作教學，
                    老手有進階課表。現場簽到即可獲得 {RULES.TRAINING_POINTS} 積分。
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
                    了解詳情
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            </Reveal>

            {/* 月度累積跑 */}
            <Reveal delay={120}>
              <Link
                href="/run"
                className="group relative block h-full overflow-hidden rounded-3xl border border-white/10"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: 'url(/images/running-track.jpg)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/30" />
                <div className="relative flex h-full min-h-[420px] flex-col justify-end p-8">
                  <span className="chip bg-energy text-white">月度挑戰</span>
                  <h3 className="mt-4 text-3xl font-black">月度累積跑</h3>
                  <p className="mt-2 text-sm font-semibold text-cobaltBright">
                    單月 {RULES.MONTHLY_KM_GOAL} KM 達標
                  </p>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
                    隨時隨地跑，上傳跑步 App 截圖與公里數，經後台確認後計入累積。
                    當月達標即完成任務，月底統一發放優惠券。
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
                    立即上傳紀錄
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ 如何運作 ============ */}
      <section className="section section-light">
        <div className="container-msw">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow !text-cobalt">HOW IT WORKS</span>
              <h2 className="h2 mt-5 !text-ink">三步驟開始累積</h2>
              <p className="mt-4 leading-relaxed text-ink/60">
                從註冊到拿到第一張優惠券，整個流程不需要任何紙本表單。
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="relative rounded-2xl border border-ink/10 bg-white p-8 shadow-sm transition hover:-translate-y-1.5 hover:shadow-xl">
                  <span className="text-6xl font-black text-cobalt/12">{s.n}</span>
                  <h3 className="h3 mt-2 !text-ink">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 積分與獎勵 ============ */}
      <section className="section">
        <div className="container-msw grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <div>
              <span className="eyebrow">POINTS & REWARDS</span>
              <h2 className="h2 mt-5">
                每滴汗水
                <br />
                都算得清楚
              </h2>
              <p className="lead mt-6">
                積分不是裝飾，它直接對應你在街健館能換到的東西。
                所有紀錄都經過管理員人工確認，確保公平。
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  { t: '跑步里程', v: `1 KM = ${RULES.POINTS_PER_KM} 分` },
                  { t: '定期訓練簽到', v: `每次 ${RULES.TRAINING_POINTS} 分` },
                  { t: `月度 ${RULES.MONTHLY_KM_GOAL}KM 達標`, v: `額外 ${300} 分 + 優惠券` },
                ].map((row) => (
                  <li
                    key={row.t}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-5 py-4"
                  >
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-energy" />
                      {row.t}
                    </span>
                    <span className="font-black text-cobaltBright">{row.v}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register" className="btn-primary mt-9">
                開始累積我的積分
              </Link>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative overflow-hidden rounded-3xl">
              <div
                className="h-[520px] w-full bg-cover bg-center"
                style={{ backgroundImage: 'url(/images/community.jpg)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="rounded-2xl border border-white/15 bg-ink/70 p-6 backdrop-blur-xl">
                  <p className="text-xs tracking-wider text-white/50">本月任務進度範例</p>
                  <p className="mt-2 text-2xl font-black">
                    218.5 <span className="text-base text-white/50">/ {RULES.MONTHLY_KM_GOAL} KM</span>
                  </p>
                  <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cobaltBright to-energy"
                      style={{ width: `${(218.5 / RULES.MONTHLY_KM_GOAL) * 100}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-white/50">
                    還差 81.5 KM 即可完成本月任務，獲得優惠券
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ 合作夥伴 ============ */}
      <section className="border-y border-white/10 bg-ink2 py-14">
        <div className="container-msw">
          <p className="text-center text-xs tracking-[.25em] text-white/40">
            合作場地與夥伴
          </p>
          <div className="mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-marquee gap-12">
              {[...PARTNERS, ...PARTNERS].map((p, i) => (
                <span
                  key={i}
                  className="whitespace-nowrap text-lg font-bold text-white/25 transition hover:text-white/60"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section">
        <div className="container-msw">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cobalt via-cobalt to-ink px-8 py-16 text-center">
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-energy/30 blur-3xl" />
              <div className="relative">
                <h2 className="h2">這個星期一，就來練一次</h2>
                <p className="mx-auto mt-5 max-w-xl leading-relaxed text-white/80">
                  不用準備器材，不用先練好。帶著水壺來就好，剩下的我們一起完成。
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-4">
                  <Link href="/register" className="btn-light">
                    免費加入會員
                  </Link>
                  <Link
                    href="/contact"
                    className="btn border border-white/40 text-white hover:bg-white/10"
                  >
                    聯絡我們
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
