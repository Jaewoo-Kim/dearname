import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/adminUser';
import { ROLE_LABEL } from '@/lib/roles';
import { formatDate } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import AddAdminUserForm from '@/components/AddAdminUserForm';
import TeamRoleSelect from '@/components/TeamRoleSelect';
import EmptyState from '@/components/EmptyState';
import type { AdminUserRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const me = await getCurrentAdminUser();
  if (!me || me.role !== 'admin') redirect('/dashboard');

  const supabase = createClient();
  const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true });
  const users = (data as AdminUserRow[] | null) || [];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="팀 관리"
        description="어드민만 다른 계정의 등급(어드민/편집자/뷰어)을 지정할 수 있습니다. 뷰어는 조회만, 편집자는 대부분의 작업이 가능하지만 운영 관리(가격·점검모드) 변경은 어드민 승인이 필요합니다."
      />

      <div className="space-y-4">
        <AddAdminUserForm />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-500">계정 목록</h2>
          {users.length === 0 ? (
            <EmptyState title="등록된 계정이 없습니다" />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap py-2 font-medium">이메일</th>
                    <th className="whitespace-nowrap py-2 font-medium">등급</th>
                    <th className="whitespace-nowrap py-2 font-medium">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap py-2 text-slate-900">
                        {u.email}
                        {u.email.toLowerCase() === me.email.toLowerCase() && (
                          <span className="ml-1.5 text-xs text-slate-400">(나)</span>
                        )}
                      </td>
                      <td className="py-2">
                        <TeamRoleSelect
                          email={u.email}
                          role={u.role}
                          isSelf={u.email.toLowerCase() === me.email.toLowerCase()}
                        />
                      </td>
                      <td className="whitespace-nowrap py-2 text-slate-400">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            등급({Object.values(ROLE_LABEL).join(' / ')})을 지정해도 실제 로그인이 되려면 Vercel의
            ADMIN_ALLOWED_EMAILS 환경변수에도 같은 이메일이 포함되어 있어야 합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
