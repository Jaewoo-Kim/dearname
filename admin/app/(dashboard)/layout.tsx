import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import Sidebar from '@/components/Sidebar';
import AllowlistWarningBanner from '@/components/AllowlistWarningBanner';
import { getAllowlist } from '@/lib/authz';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // middleware가 1차로 막지만, 서버 컴포넌트 레벨에서도 방어적으로 재확인한다.
  if (!user) redirect('/login');

  const role = await fetchRole(supabase, user.email || '');
  const allowlistConfigured = getAllowlist().length > 0;

  const { count: pendingInquiryCount } = await supabase
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  let pendingApprovalCount = 0;
  if (role === 'admin') {
    const { count } = await supabase
      .from('pending_settings_changes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingApprovalCount = count || 0;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        email={user.email || ''}
        role={role}
        pendingInquiryCount={pendingInquiryCount || 0}
        pendingApprovalCount={pendingApprovalCount}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-20 md:px-8 md:pb-8 md:pt-8">
        {!allowlistConfigured && (
          <div className="mb-4 -mt-2">
            <AllowlistWarningBanner />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
