import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata = { title: '會員登入' };

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pt-24">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: 'url(/images/training-outdoor.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/95 to-ink" />
      <div className="pointer-events-none absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-cobaltBright/20 blur-[110px]" />

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
