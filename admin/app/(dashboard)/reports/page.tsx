import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildQueryHref, formatDate, getPeriodStartUTC } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import PeriodFilterBar from '@/components/PeriodFilterBar';
import EmptyState from '@/components/EmptyState';
import type { Report } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ReportsPage({ searchParams }: { searchParams: { period?: string; page?: string } }) {
  const supabase = createClient();
  const period = searchParams.period || '';
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());

  const { data, count, error } = await query;
  const reports = (data as unknown as Report[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { period };

  return (
    <div>
      <PageHeader title="보고서" />
      <PeriodFilterBar basePath="/reports" baseParams={baseParams} period={period} />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            보고서 목록을 불러오지 못했습니다: {error.message}
          </p>
        ) : reports.length === 0 ? (
          <EmptyState title="생성된 보고서가 없습니다" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">생성일시</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">한자</th>
                <th className="px-4 py-3 font-medium">성별</th>
                <th className="px-4 py-3 font-medium">점수</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/reports/${r.id}`} className="text-brand-700 hover:underline">
                      {r.baby_name_kr || '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.baby_name_hanja || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.gender || '-'}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                    {r.score != null ? `${r.score}점` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/reports/${r.id}`}>
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
            <Link className="hover:underline" href={buildQueryHref('/reports', { ...baseParams, page: String(page - 1) })}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={buildQueryHref('/reports', { ...baseParams, page: String(page + 1) })}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
