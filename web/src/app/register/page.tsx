import { RegisterForm } from './RegisterForm';

export const metadata = { title: '註冊會員' };

export default function RegisterPage() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-24 pt-28">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: 'url(/images/hero-workout.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/95 to-ink" />
      <div className="pointer-events-none absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-energy/20 blur-[110px]" />
      <RegisterForm />
    </section>
  );
}
