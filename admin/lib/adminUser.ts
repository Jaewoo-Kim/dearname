import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
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

// 로그인 직후(대시보드 레이아웃)에서만 사용 — admin_users에 행이 아직 없으면 자동으로
// 만든다. admin_users 테이블이 완전히 비어있으면(=이 서비스의 첫 로그인) 그 계정이
// admin으로 부트스트랩되고, 그 외 신규 계정은 안전하게 viewer로 시작한다(어드민이 이후
// /team 화면에서 등급을 올려준다). 계정 자체는 어드민이 service_role API로 미리 만들기
// 때문에 보통은 이미 admin_users 행이 있고, 이 부트스트랩은 배포 초기 1회만 의미가 있다.
export async function ensureAndFetchRole(email: string): Promise<AdminRole> {
  const db = createServiceRoleClient();
  const normalized = email.toLowerCase();

  const { data: existing } = await db.from('admin_users').select('role').eq('email', normalized).maybeSingle();
  if (existing) {
    const role = (existing as { role?: string }).role;
    return role === 'admin' || role === 'editor' ? role : 'viewer';
  }

  const { count } = await db.from('admin_users').select('id', { count: 'exact', head: true });
  const role: AdminRole = (count || 0) === 0 ? 'admin' : 'viewer';
  await db.from('admin_users').insert({ email: normalized, role, created_by: normalized });
  return role;
}

export async function getCurrentAdminUser(): Promise<CurrentAdminUser | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const role = await fetchRole(supabase, user.email);
  return { email: user.email, role };
}
