import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';

// 어드민이 다른 계정의 비밀번호를 강제로 재설정한다(비밀번호를 잊었거나 유출이
// 의심될 때). 본인 비밀번호 변경은 /account 화면에서 스스로 한다.
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const myRole = await fetchRole(supabase, user!.email!);
  if (myRole !== 'admin') {
    return NextResponse.json({ error: '어드민만 비밀번호를 재설정할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: existing } = await db.from('admin_users').select('auth_user_id').eq('email', email).maybeSingle();
  if (!existing?.auth_user_id) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error } = await db.auth.admin.updateUserById(existing.auth_user_id, { password });
  if (error) {
    return NextResponse.json({ error: `비밀번호 재설정 실패: ${error.message}` }, { status: 500 });
  }

  // 어드민이 새 비밀번호를 지정했으므로 어드민 본인도 알고 있다 — 다음 로그인 시
  // 본인만 아는 비밀번호로 바꾸도록 강제한다.
  await db.from('admin_users').update({ must_change_password: true }).eq('email', email);

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'reset_admin_password',
    target_type: 'admin_user',
    target_id: null,
    detail: { email },
  });

  return NextResponse.json({ status: 'ok' });
}
