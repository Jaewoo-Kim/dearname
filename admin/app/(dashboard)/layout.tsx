import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // middleware가 1차로 막지만, 서버 컴포넌트 레벨에서도 방어적으로 재확인한다.
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar email={user.email || ''} />
      <main className="min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-20 md:px-8 md:pb-8 md:pt-8">{children}</main>
    </div>
  );
}
