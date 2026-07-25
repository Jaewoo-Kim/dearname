import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 보고서 본문(AI가 생성한 서사 6개 항목) 직접 수정. AI가 사실과 다르게 쓰거나
// 어색한 표현을 넣었을 때, 재발급(생성권 부여)까지 가지 않고 바로 고칠 수 있게 한다.
// report_json의 다른 필드(candidate 등)는 건드리지 않고 report.<field>만 병합한다.
const EDITABLE_FIELDS = ['tagline', 'sajuStory', 'jawonStory', 'hanjaStory', 'conclusionLetter', 'careerAdvice'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 보고서를 수정할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = body.fields;
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'fields가 필요합니다.' }, { status: 400 });
  }

  const updates: Partial<Record<EditableField, string>> = {};
  for (const key of EDITABLE_FIELDS) {
    if (typeof fields[key] === 'string') updates[key] = fields[key].slice(0, 5000);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: report, error: fetchError } = await db
    .from('reports')
    .select('report_json')
    .eq('id', params.id)
    .single();

  if (fetchError || !report) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }

  const reportJson = (report.report_json && typeof report.report_json === 'object' ? report.report_json : {}) as Record<string, unknown>;
  const storyPart = (reportJson.report && typeof reportJson.report === 'object' ? reportJson.report : {}) as Record<string, unknown>;
  const nextReportJson = { ...reportJson, report: { ...storyPart, ...updates } };

  const { error: updateError } = await db.from('reports').update({ report_json: nextReportJson }).eq('id', params.id);
  if (updateError) {
    return NextResponse.json({ error: `저장 실패: ${updateError.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'edit_report_content',
    target_type: 'report',
    target_id: params.id,
    detail: { fields: Object.keys(updates) },
  });

  return NextResponse.json({ status: 'ok' });
}
