'use client';

import { useState } from 'react';

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="card">
      {sent ? (
        <div className="py-12 text-center">
          <p className="text-5xl">✉️</p>
          <h2 className="h3 mt-5">已送出</h2>
          <p className="mt-3 text-sm text-white/50">
            我們會在兩個工作天內回覆你。下個星期一見！
          </p>
          <button onClick={() => setSent(false)} className="btn-ghost mt-8">
            再寫一封
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-5"
        >
          <h2 className="h3">寫給我們</h2>

          <div>
            <label className="label">姓名</label>
            <input required value={form.name} onChange={set('name')} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              className="input"
            />
          </div>
          <div>
            <label className="label">訊息</label>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={set('message')}
              className="input resize-none"
              placeholder="想問的問題、想合作的活動…"
            />
          </div>

          <button type="submit" className="btn-primary w-full">
            送出訊息
          </button>
          <p className="text-center text-xs text-white/35">
            此表單為展示版本，正式上線會串接 Email 服務。
          </p>
        </form>
      )}
    </div>
  );
}
