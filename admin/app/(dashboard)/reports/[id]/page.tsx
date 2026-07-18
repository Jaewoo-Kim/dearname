import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import RefundButton from '@/components/RefundButton';
import type { Order, Report } from '@/lib/types';

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

  const { data } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!data) notFound();
  const report = data as unknown as Report;
  const rj = (report.report_json || {}) as ReportJson;
  const story = rj.report || {};

  const { data: order } = report.order_id
    ? await supabase.from('orders').select('*').eq('id', report.order_id).single()
    : { data: null };
  const typedOrder = order as unknown as Order | null;

  const FIELDS: Array<[string, string | undefined]> = [
    ['핵심 메시지', story.tagline],
    ['사주 원국 서사', story.sajuStory],
    ['자원오행 보완', story.jawonStory],
    ['한자 종합 의미', story.hanjaStory],
    ['부모님께 드리는 편지', story.conclusionLetter],
    ['이름의 역할', story.careerAdvice],
  ];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          title="본 서비스에 보고서 재조회 화면이 연결되면 다음 단계에서 활성화됩니다"
          className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
        >
          디어네임에서 열기 (다음 단계에서 지원 예정)
        </button>
        {typedOrder && (
          <RefundButton
            orderId={typedOrder.id}
            disabled={typedOrder.status !== 'paid'}
            disabledReason={typedOrder.status === 'refunded' ? '이미 환불된 주문입니다' : '결제완료 상태의 주문만 환불할 수 있습니다'}
          />
        )}
      </div>

      <section className="mt-6 space-y-4">
        {FIELDS.filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-500">{label}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{value}</p>
          </div>
        ))}
        {FIELDS.every(([, v]) => !v) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
            저장된 보고서 본문을 표시할 수 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
