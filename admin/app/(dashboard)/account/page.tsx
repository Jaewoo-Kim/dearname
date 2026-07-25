import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import ChangePasswordForm from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <PageHeader title="내 계정" description={user?.email || ''} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">비밀번호 변경</h2>
        <div className="mt-3">
          <Suspense fallback={null}>
            <ChangePasswordForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
