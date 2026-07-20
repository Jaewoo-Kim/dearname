import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { isAllowedEmail } from '@/lib/authz';
import { fetchRole } from '@/lib/adminUser';
import { isValidRole } from '@/lib/roles';

// 어드민 계정 등급(admin/editor/viewer) 관리. 어드민만 다른 계정의 등급을 지정할 수 있다.
// 로그인 가능 여부 자체는 여전히 Vercel의 ADMIN_ALLOWED_EMAILS 환경변수가 결정하므로,
// 여기서 계정을 추가/등급 지정해도 그 이메일이 허용목록에 없으면 실제로 로그인할 수 없다.
async function countAdmins(db: ReturnType<typeof createServiceRoleClient>): Promise<number> {
  const { count } = await db.from('admin_users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  return count || 0;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  const myRole = await fetchRole(supabase, user!.email!);
  if (myRole !== 'admin') {
    return NextResponse.json({ error: '어드민만 계정 등급을 지정할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: '올바른 이메일을 입력해주세요.' }, { status: 400 });
  }
  if (!isValidRole(role)) {
    return NextResponse.json({ error: '등급은 admin/editor/viewer 중 하나여야 합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: existing } = await db.from('admin_users').select('id, role').eq('email', email).maybeSingle();

  // 마지막 남은 어드민을 강등시키면 아무도 등급을 관리할 수 없게 되므로 막는다.
  if (existing?.role === 'admin' && role !== 'admin') {
    const admins = await countAdmins(db);
    if (admins <= 1) {
      return NextResponse.json({ error: '마지막 남은 어드민은 강등할 수 없습니다. 먼저 다른 계정을 어드민으로 지정해주세요.' }, { status: 400 });
    }
  }

  const nowIso = new Date().toISOString();
  const { error } = await db.from('admin_users').upsert({
    id: existing?.id,
    email,
    role,
    updated_at: nowIso,
    updated_by: user!.email,
    ...(existing ? {} : { created_by: user!.email }),
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

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
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

  const { data: existing } = await db.from('admin_users').select('id, role').eq('email', email).maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (existing.role === 'admin') {
    const admins = await countAdmins(db);
    if (admins <= 1) {
      return NextResponse.json({ error: '마지막 남은 어드민은 삭제할 수 없습니다.' }, { status: 400 });
    }
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
