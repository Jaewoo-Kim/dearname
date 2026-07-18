import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import type { Report } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ReportsPage({ searchParams }: { searchParams: { page?: string } }) {
  const supabase = createClient();
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const reports = (data as unknown as Report[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">보고서</h1>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">생성일시</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">한자</th>
              <th className="px-4 py-3 font-medium">성별</th>
              <th className="px-4 py-3 font-medium">점수</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-red-600">보고서 목록을 불러오지 못했습니다: {error.message}</td></tr>
            )}
            {!error && reports.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">생성된 보고서가 없습니다.</td></tr>
            )}
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3">
                  <Link href={`/reports/${r.id}`} className="text-brand-700 hover:underline">
                    {r.baby_name_kr || '-'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{r.baby_name_hanja || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{r.gender || '-'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{r.score != null ? `${r.score}점` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}건</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="hover:underline" href={`/reports?page=${page - 1}`}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page < totalPages && <Link className="hover:underline" href={`/reports?page=${page + 1}`}>다음</Link>}
        </div>
      </div>
    </div>
  );
}
