import { ContactForm } from './ContactForm';

export const metadata = { title: '聯絡我們' };

const INFO = [
  { icon: '📍', label: '訓練地點', value: '澳門黑沙環公園體育設施（每月公告為準）' },
  { icon: '🕗', label: '定期訓練', value: '逢星期一 20:00 – 21:00' },
  { icon: '✉️', label: 'Email', value: 'hello@msw-streetworkout.com' },
  { icon: '📱', label: 'Instagram', value: '@msw.macau' },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-white/10 pt-32">
        <div className="container-msw pb-12">
          <span className="eyebrow">CONTACT</span>
          <h1 className="h1 mt-5">聯絡我們</h1>
          <p className="lead mt-5 max-w-2xl">
            想合作辦活動、租借場地，或只是想知道這個星期一練什麼——都歡迎寫給我們。
          </p>
        </div>
      </section>

      <section className="section pt-14">
        <div className="container-msw grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            {INFO.map((i) => (
              <div key={i.label} className="card flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-lg">
                  {i.icon}
                </span>
                <div>
                  <p className="text-xs tracking-wider text-white/40">{i.label}</p>
                  <p className="mt-1 font-semibold">{i.value}</p>
                </div>
              </div>
            ))}
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
