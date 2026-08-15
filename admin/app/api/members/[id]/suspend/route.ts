import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 회원 이용제한(정지)/해제. 탈퇴와 달리 개인정보는 지우지 않고 상태 플래그만 바꿔,
// 해제하면 재가입 없이 그대로 다시 쓸 수 있다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 이용제한을 처리할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === 'unsuspend' ? 'unsuspend' : body.action === 'suspend' ? 'suspend' : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  if (!action) {
    return NextResponse.json({ error: "action은 'suspend' 또는 'unsuspend'여야 합니다." }, { status: 400 });
  }
  if (action === 'suspend' && !reason) {
    return NextResponse.json({ error: '이용제한 사유를 입력해 주세요.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: member, error: fetchError } = await db
    .from('members')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !member) {
    return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (member.withdrawn_at) {
    return NextResponse.json({ error: '이미 탈퇴한 회원입니다.' }, { status: 409 });
  }

  const updates = action === 'suspend'
    ? { suspended_at: new Date().toISOString(), suspended_reason: reason, suspended_by: user!.email }
    : { suspended_at: null, suspended_reason: null, suspended_by: null };

  const { error: updateError } = await db.from('members').update(updates).eq('id', params.id);
  if (updateError) {
    return NextResponse.json({ error: `처리 실패: ${updateError.message}` }, { status: 500 });
  }

  // 알림 메일 — SMTP는 본 서비스(Flask)에만 있어 발송을 위임한다. 실패해도 정지 처리 자체는
  // 이미 완료된 상태이므로(위에서 update 성공) 여기서는 경고만 실어 보낸다.
  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL;
  const adminSecret = process.env.ADMIN_API_SECRET;
  let warning: string | null = null;
  if (member.contact && siteUrl && adminSecret) {
    try {
      const upstream = await fetch(`${siteUrl.replace(/\/$/, '')}/proxy/account/suspend/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
        body: JSON.stringify({ email: member.contact, action, reason }),
      });
      if (!upstream.ok) warning = '처리는 완료됐지만 안내 메일 발송에는 실패했습니다.';
    } catch {
      warning = '처리는 완료됐지만 본 서비스에 연결하지 못해 안내 메일을 보내지 못했습니다.';
    }
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: action === 'suspend' ? 'suspend_member' : 'unsuspend_member',
    target_type: 'member',
    target_id: params.id,
    detail: { reason: reason || null },
  });

  return NextResponse.json({ status: 'ok', warning });
}
