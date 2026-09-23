import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import { getActivities } from '@/lib/events';
import { RULES, nextMonday20 } from '@/lib/points';

export const dynamic = 'force-dynamic';
export const metadata = { title: '活動' };

export default async function EventsPage() {
  const activities = await getActivities();
  const next = nextMonday20();

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 pt-32">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: 'url(/images/training-outdoor.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 to-ink" />
        <div className="container-msw relative pb-14">
          <span className="eyebrow">ACTIVITIES</span>
          <h1 className="h1 mt-5">各類活動</h1>
          <p className="lead mt-5 max-w-2xl">
            從每週固定訓練到全月不間斷的里程挑戰，找一個適合自己的節奏開始。
          </p>

          <div className="mt-9 inline-flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-white/10 bg-white/[.04] px-7 py-5 backdrop-blur">
            <div>
              <p className="text-[11px] tracking-wider text-white/45">下場定期訓練</p>
              <p className="text-lg font-black">
                {next.toLocaleDateString('zh-TW', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}{' '}
                <span className="text-energyBright">20:00</span>
              </p>
            </div>
            <span className="hidden h-10 w-px bg-white/15 sm:block" />
            <div>
              <p className="text-[11px] tracking-wider text-white/45">月度目標</p>
              <p className="text-lg font-black">{RULES.MONTHLY_KM_GOAL} KM</p>
            </div>
            <Link href="/run" className="btn-primary ml-auto !py-2.5 !text-sm">
              上傳跑步紀錄
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-msw grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((a, i) => (
            <Reveal key={a.slug} delay={i * 100}>
              <Link
                href={`/events/${a.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink2 transition hover:-translate-y-1.5 hover:border-cobaltBright/60 hover:shadow-[0_24px_60px_-24px_rgba(0,87,255,.6)]"
              >
                <div className="relative h-56 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url(${a.image})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink2 to-transparent" />
                  <span className="absolute left-5 top-5 chip bg-cobaltBright text-white">
                    {a.tag}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <h2 className="text-2xl font-black">{a.title}</h2>
                  <p className="mt-1.5 text-sm font-semibold text-energyBright">
                    {a.subtitle}
                  </p>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-white/55">
                    {a.description.slice(0, 110)}…
                  </p>

                  <dl className="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-sm">
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-white/40">時間</dt>
                      <dd className="font-semibold">{a.schedule}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-white/40">積分</dt>
                      <dd className="font-semibold text-cobaltBright">{a.points}</dd>
                    </div>
                  </dl>

                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold">
                    了解詳情
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
