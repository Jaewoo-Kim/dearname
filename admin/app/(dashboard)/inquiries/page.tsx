import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildQueryHref, formatDate, isPaymentSlaOverdue, maskContact, maskName, sanitizeSearchTerm } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import PeriodFilterBar from '@/components/PeriodFilterBar';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import type { InquiryRow } from '@/lib/types';
import { INQUIRY_CATEGORY_LABELS } from '@/lib/types';
import { getPeriodStartUTC } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'pending', label: '대기중' },
  { value: 'answered', label: '답변완료' },
];
const TYPE_TABS = [
  { value: '', label: '전체' },
  { value: 'general', label: '일반 문의' },
  { value: 'complaint', label: '컴플레인' },
];

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string; period?: string; q?: string; page?: string };
}) {
  const supabase = createClient();
  const status = searchParams.status || '';
  const type = searchParams.type || '';
  const period = searchParams.period || '';
  const q = sanitizeSearchTerm(searchParams.q || '');
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('inquiries')
    .select('*, members(name, contact, withdrawn_at)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());
  if (q) query = query.or(`subject.ilike.%${q}%,message.ilike.%${q}%`);

  const { data, count, error } = await query;
  const inquiries = (data as unknown as InquiryRow[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { status, type, period, q };

  return (
    <div>
      <PageHeader
        title="고객문의"
        description="본 서비스에 로그인한 고객이 남긴 문의·컴플레인입니다. 답변을 저장하면 고객이 마이페이지에서 바로 확인할 수 있습니다."
        actions={STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildQueryHref('/inquiries', { ...baseParams, status: tab.value, page: '' })}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildQueryHref('/inquiries', { ...baseParams, type: tab.value, page: '' })}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              type === tab.value
                ? 'bg-rose-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <PeriodFilterBar basePath="/inquiries" baseParams={baseParams} period={period} />
      <SearchBar basePath="/inquiries" hiddenParams={{ status, type, period }} q={q} placeholder="제목 또는 내용 검색" />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            문의 목록을 불러오지 못했습니다: {error.message}
          </p>
        ) : inquiries.length === 0 ? (
          <EmptyState title="접수된 문의가 없습니다" />
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">접수일시</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">회원</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">구분</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">문의 내용</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {inquiries.map((iq) => (
                <tr key={iq.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(iq.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {iq.members?.withdrawn_at ? '(탈퇴한 회원)' : maskName(iq.members?.name)}
                    <div className="text-xs text-slate-400">
                      {iq.members?.withdrawn_at ? '-' : maskContact(iq.members?.contact)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {iq.type === 'complaint' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                        컴플레인{iq.priority === 'urgent' ? ' · 긴급' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        일반 문의
                      </span>
                    )}
                    {iq.category && (
                      <div className="mt-1 text-xs text-slate-400">{INQUIRY_CATEGORY_LABELS[iq.category] || iq.category}</div>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <Link href={`/inquiries/${iq.id}`} className="text-brand-700 hover:underline">
                      {iq.subject || iq.message.slice(0, 30)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        iq.status === 'answered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${iq.status === 'answered' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {iq.status === 'answered' ? '답변완료' : '대기중'}
                    </span>
                    {isPaymentSlaOverdue(iq) && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                        title="환불 처리 기한(3영업일)을 넘긴 결제·환불 문의입니다"
                      >
                        ⏰ 지연
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/inquiries/${iq.id}`}>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}건</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="hover:underline" href={buildQueryHref('/inquiries', { ...baseParams, page: String(page - 1) })}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={buildQueryHref('/inquiries', { ...baseParams, page: String(page + 1) })}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
