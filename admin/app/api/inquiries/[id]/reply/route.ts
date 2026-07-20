import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { isAllowedEmail } from '@/lib/authz';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 고객문의 응대 — 답변을 저장하면 status가 'answered'로 바뀌고, 본 서비스는
// GET /proxy/inquiry/mine으로 고객 본인의 문의를 조회할 때 이 답변을 함께 내려준다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 답변을 등록할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reply = typeof body.reply === 'string' ? body.reply.trim().slice(0, 2000) : '';

  if (!reply) {
    return NextResponse.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: inquiry, error: fetchError } = await db
    .from('inquiries')
    .select('id')
    .eq('id', params.id)
    .single();

  if (fetchError || !inquiry) {
    return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await db
    .from('inquiries')
    .update({ reply, status: 'answered', replied_at: nowIso, replied_by: user!.email })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: `답변 저장 실패: ${updateError.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'reply_inquiry',
    target_type: 'inquiry',
    target_id: params.id,
    detail: { reply },
  });

  return NextResponse.json({ status: 'ok' });
}
