import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 금기 한자 추가/삭제 (Phase 3). 본 서비스는 GET /api/taboo-hanja로 조회만 하고
// 쓰기는 여기(서버 전용 Route Handler, service_role)에서만 이루어진다.
function isSingleHanja(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const chars = [...value.trim()];
  return chars.length === 1 && /[㐀-鿿]/.test(chars[0]);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 금기 한자를 수정할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hanja = typeof body.hanja === 'string' ? body.hanja.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) || null : null;

  if (!isSingleHanja(hanja)) {
    return NextResponse.json({ error: '한자 1글자를 입력해주세요.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from('taboo_hanja').upsert({ hanja, reason, created_by: user!.email });

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'add_taboo_hanja',
    target_type: 'settings',
    target_id: null,
    detail: { hanja, reason },
  });

  return NextResponse.json({ status: 'ok' });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 금기 한자를 수정할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hanja = typeof body.hanja === 'string' ? body.hanja.trim() : '';

  if (!isSingleHanja(hanja)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from('taboo_hanja').delete().eq('hanja', hanja);

  if (error) {
    return NextResponse.json({ error: `삭제 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'remove_taboo_hanja',
    target_type: 'settings',
    target_id: null,
    detail: { hanja },
  });

  return NextResponse.json({ status: 'ok' });
}
