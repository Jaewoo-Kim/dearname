import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildQueryHref, formatDate, getPeriodStartUTC, sanitizeSearchTerm } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import PeriodFilterBar from '@/components/PeriodFilterBar';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import type { Report } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ReportsPage({ searchParams }: { searchParams: { period?: string; q?: string; page?: string } }) {
  const supabase = createClient();
  const period = searchParams.period || '';
  const q = sanitizeSearchTerm(searchParams.q || '');
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
  if (q) query = query.or(`baby_name_kr.ilike.%${q}%,baby_name_hanja.ilike.%${q}%`);

  const { data, count, error } = await query;
  const reports = (data as unknown as Report[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { period, q };

  return (
    <div>
      <PageHeader title="보고서" />
      <PeriodFilterBar basePath="/reports" baseParams={baseParams} period={period} />
      <SearchBar basePath="/reports" hiddenParams={{ period }} q={q} placeholder="아기 이름(한글/한자) 검색" />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            보고서 목록을 불러오지 못했습니다: {error.message}
          </p>
        ) : reports.length === 0 ? (
          <EmptyState title="생성된 보고서가 없습니다" />
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">생성일시</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">이름</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">한자</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">성별</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">점수</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">요청사항</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">열람</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/reports/${r.id}`} className="text-brand-700 hover:underline">
                      {r.purged_at ? '(파기됨)' : r.baby_name_kr || '-'}
                    </Link>
                    {r.purged_at && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        파기
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.baby_name_hanja || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.gender || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">
                    {r.score != null ? `${r.score}점` : '-'}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    {r.special_request ? (
                      <span className="line-clamp-1" title={r.special_request}>
                        {r.special_request}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.last_viewed_at ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700" title={formatDate(r.last_viewed_at)}>
                        열람함
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        미열람
                      </span>
                    )}
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
