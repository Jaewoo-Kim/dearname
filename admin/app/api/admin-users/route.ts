import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { isValidRole } from '@/lib/roles';

// 어드민 계정 관리. 로그인 자체가 이메일+비밀번호(Supabase Auth)이고, 계정 자체를
// 자가 가입 없이 여기서만 만들 수 있다 — 어드민만 새 계정(비밀번호 포함)을 만들거나
// 등급을 지정하거나 삭제할 수 있다.
const MIN_PASSWORD_LENGTH = 8;

async function countAdmins(db: ReturnType<typeof createServiceRoleClient>): Promise<number> {
  const { count } = await db.from('admin_users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  return count || 0;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const myRole = await fetchRole(supabase, user!.email!);
  if (myRole !== 'admin') {
    return NextResponse.json({ error: '어드민만 계정 등급을 지정할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role;
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '올바른 이메일을 입력해주세요.' }, { status: 400 });
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: '등급은 admin/editor/viewer 중 하나여야 합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: existing } = await db.from('admin_users').select('id, role, auth_user_id').eq('email', email).maybeSingle();

  // 마지막 남은 어드민을 강등시키면 아무도 등급을 관리할 수 없게 되므로 막는다.
  if (existing?.role === 'admin' && role !== 'admin') {
    const admins = await countAdmins(db);
    if (admins <= 1) {
      return NextResponse.json({ error: '마지막 남은 어드민은 강등할 수 없습니다. 먼저 다른 계정을 어드민으로 지정해주세요.' }, { status: 400 });
    }
  }

  let authUserId = existing?.auth_user_id ?? null;

  // 신규 계정은 실제 로그인이 가능한 Supabase Auth 사용자를 함께 만들어야 한다.
  if (!existing) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` }, { status: 400 });
    }
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      return NextResponse.json({ error: `계정 생성 실패: ${createError?.message || '알 수 없는 오류'}` }, { status: 500 });
    }
    authUserId = created.user.id;
  }

  const nowIso = new Date().toISOString();
  const { error } = await db.from('admin_users').upsert({
    id: existing?.id,
    email,
    role,
    auth_user_id: authUserId,
    updated_at: nowIso,
    updated_by: user!.email,
    // 신규 계정은 어드민이 지정한 비밀번호를 어드민 본인도 알고 있으므로, 최초 로그인 시
    // 본인만 아는 비밀번호로 바꾸도록 강제한다. 기존 계정의 등급만 바꾸는 경우는 그대로 둔다.
    ...(existing ? {} : { created_by: user!.email, must_change_password: true }),
  });

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: existing ? 'update_admin_role' : 'add_admin_user',
    target_type: 'admin_user',
    target_id: null,
    detail: { email, role, previousRole: existing?.role ?? null },
  });

  return NextResponse.json({ status: 'ok' });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const myRole = await fetchRole(supabase, user!.email!);
  if (myRole !== 'admin') {
    return NextResponse.json({ error: '어드민만 계정을 삭제할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) {
    return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 });
  }
  if (email === user!.email!.toLowerCase()) {
    return NextResponse.json({ error: '본인 계정은 여기서 삭제할 수 없습니다. 다른 어드민에게 요청해주세요.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: existing } = await db.from('admin_users').select('id, role, auth_user_id').eq('email', email).maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (existing.role === 'admin') {
    const admins = await countAdmins(db);
    if (admins <= 1) {
      return NextResponse.json({ error: '마지막 남은 어드민은 삭제할 수 없습니다.' }, { status: 400 });
    }
  }

  // admin_users 행만 지우면 실제 로그인 계정(비밀번호)은 그대로 남아 다시 로그인할 수
  // 있으므로, 로그인 자체를 막으려면 Supabase Auth 사용자도 함께 삭제해야 한다.
  if (existing.auth_user_id) {
    await db.auth.admin.deleteUser(existing.auth_user_id);
  }

  const { error } = await db.from('admin_users').delete().eq('email', email);
  if (error) {
    return NextResponse.json({ error: `삭제 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'remove_admin_user',
    target_type: 'admin_user',
    target_id: null,
    detail: { email, previousRole: existing.role },
  });

  return NextResponse.json({ status: 'ok' });
}
