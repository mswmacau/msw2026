import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActivities, getActivityBySlug } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const all = await getActivities();
  const a = all.find((x) => x.slug === params.slug) || (await getActivityBySlug(params.slug));
  return { title: a?.title || '活動' };
}

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const all = await getActivities();
  const activity =
    all.find((x) => x.slug === params.slug) || (await getActivityBySlug(params.slug));
  if (!activity) notFound();

  const others = all.filter((a) => a.slug !== activity.slug).slice(0, 2);

  return (
    <>
      <section className="relative flex min-h-[62vh] items-end overflow-hidden pt-32">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${activity.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/80 to-ink/40" />
        <div className="container-msw relative pb-14">
          <span className="chip bg-cobaltBright text-white">{activity.tag}</span>
          <h1 className="h1 mt-5">{activity.title}</h1>
          <p className="lead mt-4 max-w-2xl text-lg font-semibold !text-energyBright">
            {activity.subtitle}
          </p>
        </div>
      </section>

      <section className="section pt-14">
        <div className="container-msw grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          {/* 主內容 */}
          <div>
            <h2 className="h3">活動介紹</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-white/70">
              {activity.description}
            </p>

            {activity.highlights.length > 0 && (
              <>
                <h2 className="h3 mt-12">活動重點</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {activity.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4"
                    >
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cobaltBright text-[10px] font-black">
                        ✓
                      </span>
                      <span className="text-sm text-white/70">{h}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-12 flex flex-wrap gap-4">
              {activity.slug === 'monthly-run' ? (
                <Link href="/run" className="btn-primary">
                  上傳跑步紀錄
                </Link>
              ) : (
                <Link href="/register" className="btn-primary">
                  報名參加
                </Link>
              )}
              <Link href="/events" className="btn-ghost">
                其他活動
              </Link>
            </div>
          </div>

          {/* 側欄資訊 */}
          <aside className="space-y-6">
            <div className="card">
              <h3 className="font-bold">活動資訊</h3>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ['時間', activity.schedule],
                  ['地點', activity.location],
                  ['積分', activity.points],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs tracking-wider text-white/40">{k}</dt>
                    <dd className="mt-1 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-energy/30 bg-energy/10 p-6">
              <h3 className="font-bold text-energyBright">參加前提醒</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li>· 運動前請充分熱身，身體不適請勿勉強</li>
                <li>· 自備水壺與毛巾</li>
                <li>· 請準時到場，逾時 15 分鐘不計簽到</li>
              </ul>
            </div>

            {others.length > 0 && (
              <div className="card">
                <h3 className="font-bold">其他活動</h3>
                <ul className="mt-4 space-y-3">
                  {others.map((o) => (
                    <li key={o.slug}>
                      <Link
                        href={`/events/${o.slug}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm font-semibold transition hover:border-cobaltBright"
                      >
                        {o.title}
                        <span className="text-white/40">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
