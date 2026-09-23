import Link from 'next/link';
import { RULES } from '@/lib/points';

export const metadata = { title: '常見問題' };

const FAQS = [
  {
    q: '参加定期訓練需要費用嗎？',
    a: '完全免費。MSW 是社群性質的訓練聚會，只需要自備水壺與毛巾。部分進階課程（如街健基礎班）會酌收場地費，可用積分折抵。',
  },
  {
    q: '完全沒運動底子，可以參加嗎？',
    a: '可以。每週一的訓練都會分組，新手從基礎動作模式開始，教練會提供退階版本。很多人第一次連單槓都吊不住，三個月後能做引體上升。',
  },
  {
    q: '跑步截圖要怎麼拍才會被確認？',
    a: '請上傳跑步 App（Strava、Nike Run Club、Garmin、Keep 等）的紀錄頁面，畫面需清楚顯示距離與日期。模糊、經過修改或無法辨識距離的截圖會被駁回。',
  },
  {
    q: `一個月上傳的里程可以分很多次嗎？`,
    a: '可以。系統會自動累加你當月所有「已確認」的里程，不限上傳次數。單次上限 200 公里，超過請分次上傳。',
  },
  {
    q: `達成 ${RULES.MONTHLY_KM_GOAL} 公里後多久會拿到優惠券？`,
    a: '每月最後一天由後台結算並產出達成名單，管理員批次發放後，優惠券會出現在你的會員中心。有效期為發放日起三個月。',
  },
  {
    q: '積分可以換什麼？',
    a: '目前可用於折抵街健基礎班學費、兌換 MSW 周邊（T-shirt、防滑粉、拉力帶）。兌換功能將於會員中心陸續開放。',
  },
  {
    q: '下雨天還練嗎？',
    a: '小雨照練（我們有有蓋場地備案），颱風或暴雨警告則取消，會提前在會員專區公告。',
  },
  {
    q: '可以用 Google 帳號登入嗎？',
    a: '可以，註冊時選擇 Google 登入即可。若你用 Email 註冊過，系統會自動連結同一個帳號。',
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="border-b border-white/10 pt-32">
        <div className="container-msw pb-12">
          <span className="eyebrow">FAQ</span>
          <h1 className="h1 mt-5">常見問題</h1>
          <p className="lead mt-5 max-w-2xl">
            關於訓練、里程確認、積分與優惠券，你想知道的應該都在這裡。
          </p>
        </div>
      </section>

      <section className="section pt-14">
        <div className="container-msw mx-auto max-w-3xl">
          <div className="divide-y divide-white/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer items-center justify-between gap-6 text-lg font-bold marker:content-none">
                  {f.q}
                  <span className="shrink-0 text-2xl text-cobaltBright transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-white/60">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-white/10 bg-ink2 p-8 text-center">
            <h2 className="h3">還有其他問題？</h2>
            <p className="mt-3 text-sm text-white/50">寫給我們，或直接來現場問。</p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              <Link href="/contact" className="btn-primary">
                聯絡我們
              </Link>
              <Link href="/register" className="btn-ghost">
                加入會員
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
