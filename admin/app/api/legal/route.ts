import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import type { LegalDocType } from '@/lib/types';

const DOC_TYPES: LegalDocType[] = ['terms', 'privacy'];

// 이용약관·개인정보처리방침 본문 저장.
// 법적 효력이 있는 문서라 편집자(editor)가 아닌 어드민(admin)만 수정할 수 있게 한다.
// 기존 행을 고치지 않고 항상 새 행을 추가해 개정 이력을 남긴다.
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if ((await fetchRole(supabase, user!.email!)) !== 'admin') {
    return NextResponse.json(
      { error: '약관·개인정보처리방침은 어드민만 수정할 수 있습니다.' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const docType = body.docType as LegalDocType;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const effectiveDate = typeof body.effectiveDate === 'string' && body.effectiveDate
    ? body.effectiveDate
    : null;

  if (!DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: '알 수 없는 문서 종류입니다.' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: '본문이 비어 있습니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: saved, error } = await db
    .from('legal_documents')
    .insert({
      doc_type: docType,
      content,
      effective_date: effectiveDate,
      updated_by: user!.email,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'update_legal_document',
    target_type: 'legal_document',
    target_id: saved?.id ?? null,
    detail: { docType, effectiveDate, contentLength: content.length },
  });

  return NextResponse.json({ status: 'ok' });
}
