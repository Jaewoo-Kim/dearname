import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';

// 최초 로그인 시 admin_users에 자동으로 계정을 등록한다. admin_users가 아직 비어있으면
// (=이 서비스의 첫 로그인) 그 계정을 admin으로 부트스트랩하고, 그 외 신규 계정은 안전하게
// viewer로 시작한다 — 어드민이 이후 /team 화면에서 등급을 올려준다.
async function ensureAdminUserRow(email: string) {
  const db = createServiceRoleClient();
  const normalized = email.toLowerCase();

  const { data: existing } = await db.from('admin_users').select('id').eq('email', normalized).maybeSingle();
  if (existing) return;

  const { count } = await db.from('admin_users').select('id', { count: 'exact', head: true });
  const role = (count || 0) === 0 ? 'admin' : 'viewer';

  await db.from('admin_users').insert({ email: normalized, role, created_by: normalized });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/orders';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await ensureAdminUserRow(user.email);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
