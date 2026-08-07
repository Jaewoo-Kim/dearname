import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 보고서 보관용 링크 재발송 — "메일을 못 받았다"는 문의가 왔을 때 운영자가 직접 다시 보낸다.
// SMTP 설정은 본 서비스(Flask)에만 있으므로 발송 자체는 그쪽에 위임하고, 어드민과 본 서비스가
// 별도 배포인 만큼 ADMIN_API_SECRET 공유 시크릿으로 호출자를 확인한다.
// 발송 이력(report_email_logs)은 본 서비스가 기록하고, 어드민은 audit_logs에 운영 행위를 남긴다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 메일을 재발송할 수 없습니다.' }, { status: 403 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL;
  const adminSecret = process.env.ADMIN_API_SECRET;
  if (!siteUrl || !adminSecret) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_DEARNAME_SITE_URL과 ADMIN_API_SECRET을 설정해야 재발송할 수 있습니다.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email.includes('@')) {
    return NextResponse.json({ error: '보낼 이메일 주소를 입력해주세요.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: report } = await db
    .from('reports')
    .select('id, baby_name_kr')
    .eq('id', params.id)
    .single();

  if (!report) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${siteUrl.replace(/\/$/, '')}/proxy/report/email/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret },
      body: JSON.stringify({ reportId: params.id, email, sentBy: user!.email }),
    });
  } catch {
    return NextResponse.json({ error: '본 서비스에 연결하지 못했습니다.' }, { status: 502 });
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: result.error || '메일 재발송에 실패했습니다.' },
      { status: upstream.status },
    );
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'resend_report_email',
    target_type: 'report',
    target_id: params.id,
    detail: { babyNameKr: report.baby_name_kr, toEmail: email },
  });

  return NextResponse.json({ status: 'ok' });
}
