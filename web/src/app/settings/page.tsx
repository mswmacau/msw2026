import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SettingsForm } from './SettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '帳號設定' };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/settings');

  return (
    <section className="pt-32">
      <div className="container-msw mx-auto max-w-2xl pb-20">
        <span className="eyebrow">SETTINGS</span>
        <h1 className="h2 mt-5">帳號設定</h1>
        <p className="lead mt-4">
          修改顯示於排行榜的暱稱，或變更登入密碼。
        </p>

        <SettingsForm
          initialName={user.displayName || user.name || ''}
          email={user.email || ''}
          hasPassword={!!user.passwordHash}
        />
      </div>
    </section>
  );
}
