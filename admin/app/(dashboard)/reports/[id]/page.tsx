import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import { formatDate } from '@/lib/format';
import ReissueCreditButton from '@/components/ReissueCreditButton';
import ReportContentEditor from '@/components/ReportContentEditor';
import BackLink from '@/components/BackLink';
import type { Report } from '@/lib/types';

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
