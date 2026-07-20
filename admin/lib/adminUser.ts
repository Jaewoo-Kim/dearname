import { createClient } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/roles';

type SupabaseServerClient = ReturnType<typeof createClient>;

export interface CurrentAdminUser {
  email: string;
  role: AdminRole;
}

// admin_users에 아직 행이 없는 계정(부트스트랩 직후 레이스, 또는 과거 데이터)은
// 안전하게 viewer로 취급한다 — 권한은 있는 쪽이 아니라 없는 쪽으로 기본값을 둔다.
export async function fetchRole(supabase: SupabaseServerClient, email: string): Promise<AdminRole> {
  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return role === 'admin' || role === 'editor' ? role : 'viewer';
}

export async function getCurrentAdminUser(): Promise<CurrentAdminUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const role = await fetchRole(supabase, user.email);
  return { email: user.email, role };
}
