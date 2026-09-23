import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import { RULES } from '@/lib/points';
import { getSettings, DEFAULT_SETTINGS } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata = { title: '關於我們' };

const VALUES = [
  {
    icon: '👐',
    title: '開放',
    desc: '不需要會籍費、不需要裝備。公園的單槓就是我們的健身房。',
  },
  {
    icon: '📏',
    title: '誠實',
    desc: '所有里程紀錄都經過人工確認，數字不灌水，獎勵才有意義。',
  },
  {
    icon: '🔁',
    title: '持續',
    desc: '我們不追求一次練到爆，而是每週都出現、每月都累積。',
  },
];

const RULES_TABLE = [
  ['註冊會員', '50 分', '一次性'],
  ['跑步里程確認', `${RULES.POINTS_PER_KM} 分 / KM`, '每次上傳經確認後'],
  ['定期訓練出席', `${RULES.TRAINING_POINTS} 分`, '每週一簽到'],
  [`月度 ${RULES.MONTHLY_KM_GOAL}KM 達標`, '300 分 + 優惠券', '每月結算'],
  ['推薦新會員', '30 分', '對方完成註冊後'],
];

export default async function AboutPage() {
  const s = { ...DEFAULT_SETTINGS, ...(await getSettings()) };

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 pt-32">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: 'url(/images/community.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 to-ink" />
        <div className="container-msw relative pb-14">
          <span className="eyebrow">ABOUT MSW</span>
          <h1 className="h1 mt-5">
            {s.about_title}
            <br />
            <span className="text-gradient">街健館</span>
          </h1>
          <p className="lead mt-6 max-w-2xl whitespace-pre-line">{s.about_intro}</p>
        </div>
      </section>

      {/* 理念 */}
      <section className="section">
        <div className="container-msw grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="h2">我們相信的三件事</h2>
            <div className="mt-8 space-y-4">
              {VALUES.map((v) => (
                <Reveal key={v.title}>
                  <div className="card card-hover flex gap-5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cobaltBright/25 to-energy/20 text-xl">
                      {v.icon}
                    </span>
                    <div>
                      <h3 className="font-bold">{v.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                        {v.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl">
            <div
              className="h-full min-h-[420px] w-full bg-cover bg-center"
              style={{ backgroundImage: 'url(/images/hero-workout.jpg)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/30 to-transparent" />
            <div className="absolute bottom-0 p-8">
              <p className="text-3xl font-black">每週一 20:00</p>
              <p className="mt-2 text-white/70">
                不管晴雨，我們都在。這是 MSW 唯一不變的約定。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 積分規則 */}
      <section className="section section-light" id="rules">
        <div className="container-msw">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow !text-cobalt">POINTS RULES</span>
            <h2 className="h2 mt-5 !text-ink">積分與任務規則</h2>
            <p className="mt-4 leading-relaxed text-ink/60">
              積分怎麼來、怎麼算，全部寫在這裡，沒有隱藏條款。
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="px-6 py-4">項目</th>
                  <th className="px-6 py-4">積分</th>
                  <th className="px-6 py-4">說明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {RULES_TABLE.map(([item, point, note]) => (
                  <tr key={item}>
                    <td className="px-6 py-4 font-semibold text-ink">{item}</td>
                    <td className="px-6 py-4 font-black text-cobalt">{point}</td>
                    <td className="px-6 py-4 text-ink/60">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-ink/10 bg-white p-7">
            <h3 className="font-bold text-ink">月度任務的判定方式</h3>
            <ol className="mt-4 space-y-3 text-sm text-ink/70">
              <li>
                <b>1.</b> 會員上傳跑步截圖並填寫公里數，狀態為「待確認」。
              </li>
              <li>
                <b>2.</b> 管理員在後台逐筆人工確認；確認後該筆里程才計入當月累積，
                並依 1 KM = {RULES.POINTS_PER_KM} 分回饋積分。
              </li>
              <li>
                <b>3.</b> 當月累積滿 {RULES.MONTHLY_KM_GOAL} KM 即為達標，系統標記為完成任務。
              </li>
              <li>
                <b>4.</b> 月底由後台產出達成名單，批次發放專屬優惠券（有效期三個月）。
              </li>
            </ol>
          </div>

          <div className="mt-12 text-center">
            <Link href="/register" className="btn-primary">
              加入並開始累積
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
