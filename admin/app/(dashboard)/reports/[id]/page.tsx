import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import { formatDate } from '@/lib/format';
import ReissueCreditButton from '@/components/ReissueCreditButton';
import ReportContentEditor from '@/components/ReportContentEditor';
import ResendReportEmailForm from '@/components/ResendReportEmailForm';
import BackLink from '@/components/BackLink';
import type { Report, ReportEmailLogRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ReportJson {
  candidate?: { score?: number };
  report?: {
    tagline?: string;
    sajuStory?: string;
    jawonStory?: string;
    hanjaStory?: string;
    conclusionLetter?: string;
    careerAdvice?: string;
  };
}

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isViewer = (await fetchRole(supabase, user?.email || '')) === 'viewer';

  const { data } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!data) notFound();
  const report = data as unknown as Report;
  const rj = (report.report_json || {}) as ReportJson;
  const story = rj.report || {};

  // "메일을 못 받았다"는 문의에 답하려면 발송 이력이 필요하다(실패 건도 함께 보여준다).
  const { data: logData } = await supabase
    .from('report_email_logs')
    .select('*')
    .eq('report_id', params.id)
    .order('created_at', { ascending: false });
  const emailLogs = (logData as unknown as ReportEmailLogRow[]) || [];

  // 재발송 기본 수신자 — 주문에 연결된 회원의 연락처
  let memberContact: string | null = null;
  if (report.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('members(contact)')
      .eq('id', report.order_id)
      .single();
    memberContact = (order as unknown as { members?: { contact?: string | null } } | null)?.members?.contact || null;
  }

  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL || '';
  const viewUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/report-view.html?id=${report.id}` : null;

  return (
    <div className="max-w-3xl">
      <BackLink href="/reports" label="보고서 목록으로" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {report.baby_name_kr} <span className="text-slate-400">{report.baby_name_hanja}</span>
        </h1>
        {report.order_id && (
          <Link href={`/orders/${report.order_id}`} className="text-sm text-brand-700 hover:underline">
            연결 주문 보기 →
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        생성일시 {formatDate(report.created_at)} · {report.gender || '-'} · {report.score != null ? `${report.score}점` : '-'}
        {' · '}
        {report.last_viewed_at
          ? `최근 열람 ${formatDate(report.last_viewed_at)}`
          : '링크 열람 기록 없음'}
      </p>

      <div className="mt-4 flex flex-wrap items-start gap-2">
        {viewUrl ? (
          <a
            href={viewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            디어네임에서 열기 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="NEXT_PUBLIC_DEARNAME_SITE_URL 환경변수를 설정하면 활성화됩니다"
            className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
          >
            디어네임에서 열기 (사이트 주소 미설정)
          </button>
        )}

        <ReissueCreditButton
          reportId={report.id}
          disabled={isViewer}
          disabledReason={isViewer ? '조회 권한만 있어 생성권을 부여할 수 없습니다' : undefined}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">보관용 링크 메일 발송 이력</h2>
        {emailLogs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            아직 이 보고서의 링크를 메일로 보낸 기록이 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">발송일시</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">받는 주소</th>
                  <th className="whitespace-nowrap py-2 pr-4 font-medium">결과</th>
                  <th className="whitespace-nowrap py-2 font-medium">발송 주체</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-4 text-slate-500">{formatDate(log.created_at)}</td>
                    <td className="py-2 pr-4 text-slate-700">{log.to_email}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {log.status === 'sent' ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">발송 성공</span>
                      ) : (
                        <span
                          className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                          title={log.error || undefined}
                        >
                          발송 실패
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 text-slate-500">{log.sent_by || '고객 본인'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ResendReportEmailForm
          reportId={report.id}
          defaultEmail={memberContact}
          readOnly={isViewer}
        />
      </div>

      {report.special_request && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-amber-700">고객이 남긴 특별 요청사항</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-amber-900">{report.special_request}</p>
        </div>
      )}

      <ReportContentEditor reportId={report.id} initial={story} readOnly={isViewer} />
    </div>
  );
}
