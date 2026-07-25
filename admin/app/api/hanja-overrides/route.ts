import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 한자 DB 정정값 저장/삭제 (Phase 3). 본 서비스는 GET /api/hanja/overrides로 조회만 하고
// 쓰기는 여기(서버 전용 Route Handler, service_role)에서만 이루어진다.
const VALID_OHENG = new Set(['木', '火', '土', '金', '水']);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 한자 DB를 수정할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hanja = typeof body.hanja === 'string' ? body.hanja.trim() : '';
  const kr = typeof body.kr === 'string' ? body.kr.trim() : '';
  const m = typeof body.m === 'string' && body.m.trim() ? body.m.trim() : null;
  const s = body.s === null || body.s === undefined ? null : Number(body.s);
  const o = typeof body.o === 'string' && body.o.trim() ? body.o.trim() : null;

  if (!hanja || !kr) {
    return NextResponse.json({ error: 'hanja/kr가 필요합니다.' }, { status: 400 });
  }
  if (s !== null && (!Number.isInteger(s) || s <= 0)) {
    return NextResponse.json({ error: '획수는 1 이상의 정수여야 합니다.' }, { status: 400 });
  }
  if (o !== null && !VALID_OHENG.has(o)) {
    return NextResponse.json({ error: '자원오행은 木·火·土·金·水 중 하나여야 합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from('hanja_overrides').upsert({
    hanja,
    kr,
    m,
    s,
    o,
    updated_at: new Date().toISOString(),
    updated_by: user!.email,
  });

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'update_hanja',
    target_type: 'settings',
    target_id: null,
    detail: { hanja, kr, m, s, o },
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
    return NextResponse.json({ error: '조회 권한만 있어 한자 DB를 수정할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const hanja = typeof body.hanja === 'string' ? body.hanja.trim() : '';
  const kr = typeof body.kr === 'string' ? body.kr.trim() : '';

  if (!hanja || !kr) {
    return NextResponse.json({ error: 'hanja/kr가 필요합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from('hanja_overrides').delete().eq('hanja', hanja).eq('kr', kr);

  if (error) {
    return NextResponse.json({ error: `삭제 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'revert_hanja',
    target_type: 'settings',
    target_id: null,
    detail: { hanja, kr },
  });

  return NextResponse.json({ status: 'ok' });
}
