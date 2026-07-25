import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import { formatDate, maskContact, maskName } from '@/lib/format';
import BackLink from '@/components/BackLink';
import InquiryReplyForm from '@/components/InquiryReplyForm';
import type { InquiryRow } from '@/lib/types';
import { INQUIRY_CATEGORY_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function InquiryDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isViewer = (await fetchRole(supabase, user?.email || '')) === 'viewer';

  const { data } = await supabase
    .from('inquiries')
    .select('*, members(name, contact)')
    .eq('id', params.id)
    .single();

  if (!data) notFound();
  const inquiry = data as unknown as InquiryRow;

  return (
    <div className="max-w-2xl">
      <BackLink href="/inquiries" label="고객문의 목록으로" />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {inquiry.subject || '제목 없음'}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          {inquiry.order_id && (
            <Link href={`/orders/${inquiry.order_id}`} className="text-sm text-brand-700 hover:underline">
              연결 결제건 보기 →
            </Link>
          )}
          {inquiry.report_id && (
            <Link href={`/reports/${inquiry.report_id}`} className="text-sm text-brand-700 hover:underline">
              연결 보고서 보기 →
            </Link>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {formatDate(inquiry.created_at)} · {maskName(inquiry.members?.name)} · {maskContact(inquiry.members?.contact)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {inquiry.type === 'complaint' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
            컴플레인{inquiry.priority === 'urgent' ? ' · 긴급' : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            일반 문의
          </span>
        )}
        {inquiry.category && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
            {INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">문의 내용</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{inquiry.message}</p>
      </div>

      {inquiry.status === 'answered' && inquiry.reply && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-emerald-700">
            답변 완료 {inquiry.replied_by && `· ${inquiry.replied_by}`} {inquiry.replied_at && `· ${formatDate(inquiry.replied_at)}`}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-900">{inquiry.reply}</p>
        </div>
      )}

      <div className="mt-4">
        <InquiryReplyForm inquiryId={inquiry.id} readOnly={isViewer} />
      </div>
    </div>
  );
}
