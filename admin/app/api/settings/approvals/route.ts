import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { isValidSettingKey, isValidSettingValue } from '@/lib/settingsValidation';

// 편집자가 /api/settings로 올린 운영 관리(가격/점검모드) 변경 요청을 어드민이 승인·반려한다.
// 승인 시에만 실제 settings 테이블에 반영되고, 그전까지는 사이트 동작에 아무 영향이 없다.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const role = await fetchRole(supabase, user!.email!);
  if (role !== 'admin') {
    return NextResponse.json({ error: '어드민만 변경 요청을 승인·반려할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : null;
  const action = body.action;
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'id와 action(approve|reject)이 필요합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: pending, error: fetchError } = await db
    .from('pending_settings_changes')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .single();

  if (fetchError || !pending) {
    return NextResponse.json({ error: '대기 중인 요청을 찾을 수 없습니다(이미 처리되었을 수 있습니다).' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  if (action === 'reject') {
    await db
      .from('pending_settings_changes')
      .update({ status: 'rejected', reviewed_by: user!.email, reviewed_at: nowIso, reject_reason: reason })
      .eq('id', id);

    await db.from('audit_logs').insert({
      actor: user!.email,
      action: 'reject_settings_change',
      target_type: 'settings',
      target_id: null,
      detail: { key: pending.key, requested_by: pending.requested_by, reason },
    });

    return NextResponse.json({ status: 'ok' });
  }

  // 승인: 요청 시점 이후 값이 이상해졌을 가능성에 대비해 반영 직전에 다시 한 번 형식을 검증한다.
  if (!isValidSettingKey(pending.key) || !isValidSettingValue(pending.key, pending.requested_value)) {
    return NextResponse.json({ error: '요청된 값의 형식이 올바르지 않아 승인할 수 없습니다.' }, { status: 400 });
  }

  const { error: upsertError } = await db.from('settings').upsert({
    key: pending.key,
    value: pending.requested_value,
    updated_at: nowIso,
    updated_by: user!.email,
  });

  if (upsertError) {
    return NextResponse.json({ error: `반영 실패: ${upsertError.message}` }, { status: 500 });
  }

  await db
    .from('pending_settings_changes')
    .update({ status: 'approved', reviewed_by: user!.email, reviewed_at: nowIso })
    .eq('id', id);

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'approve_settings_change',
    target_type: 'settings',
    target_id: null,
    detail: { key: pending.key, value: pending.requested_value, requested_by: pending.requested_by },
  });

  return NextResponse.json({ status: 'ok' });
}
