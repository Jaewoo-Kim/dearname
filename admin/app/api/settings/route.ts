import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { isValidSettingKey, isValidSettingValue } from '@/lib/settingsValidation';

// 운영자 설정 저장 (Phase 3 — 가격/점검모드). 본 서비스는 GET /api/settings로 조회만 하고
// 쓰기는 여기(서버 전용 Route Handler, service_role)에서만 이루어진다.
//
// 역할별 동작:
// - admin: 기존과 동일하게 즉시 settings에 반영
// - editor: 바로 반영하지 않고 pending_settings_changes에 승인 대기 요청을 쌓는다
//           (가격 변경·서비스 중지는 파급력이 커서 어드민 승인 절차가 필요하다)
// - viewer: 403
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const role = await fetchRole(supabase, user!.email!);
  if (role === 'viewer') {
    return NextResponse.json({ error: '조회 권한만 있어 설정을 변경할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const key = body.key;
  const value = body.value;

  if (!isValidSettingKey(key)) {
    return NextResponse.json({ error: '알 수 없는 설정 키입니다.' }, { status: 400 });
  }
  if (!isValidSettingValue(key, value)) {
    const message = key === 'pricing' ? '가격 설정 형식이 올바르지 않습니다.' : '점검모드 설정 형식이 올바르지 않습니다.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = createServiceRoleClient();

  if (role === 'editor') {
    const { data: current } = await db.from('settings').select('value').eq('key', key).maybeSingle();

    const { error: insertError } = await db.from('pending_settings_changes').insert({
      key,
      requested_value: value,
      previous_value: current?.value ?? null,
      requested_by: user!.email,
      status: 'pending',
    });

    if (insertError) {
      return NextResponse.json({ error: `요청 등록 실패: ${insertError.message}` }, { status: 500 });
    }

    await db.from('audit_logs').insert({
      actor: user!.email,
      action: 'request_settings_change',
      target_type: 'settings',
      target_id: null,
      detail: { key, value },
    });

    return NextResponse.json({ status: 'pending' });
  }

  const { error } = await db.from('settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: user!.email,
  });

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'update_settings',
    target_type: 'settings',
    target_id: null,
    detail: { key, value },
  });

  return NextResponse.json({ status: 'ok' });
}
