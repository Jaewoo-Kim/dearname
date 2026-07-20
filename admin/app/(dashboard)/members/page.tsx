import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { buildQueryHref, formatDate, formatKRW, getPeriodStartUTC, maskContact, maskName, sanitizeSearchTerm } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import PeriodFilterBar from '@/components/PeriodFilterBar';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import type { Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function MembersPage({ searchParams }: { searchParams: { period?: string; q?: string; page?: string } }) {
  const supabase = createClient();
  const period = searchParams.period || '';
  const q = sanitizeSearchTerm(searchParams.q || '');
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());
  if (q) query = query.or(`name.ilike.%${q}%,contact.ilike.%${q}%`);

  const { data, count, error } = await query;
  const members = (data as unknown as Member[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { period, q };

  return (
    <div>
      <PageHeader title="회원" />
      <PeriodFilterBar basePath="/members" baseParams={baseParams} period={period} />
      <SearchBar basePath="/members" hiddenParams={{ period }} q={q} placeholder="이름 또는 연락처 검색" />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            회원 목록을 불러오지 못했습니다: {error.message}
          </p>
        ) : members.length === 0 ? (
          <EmptyState title="회원 데이터가 없습니다" />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">가입일</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">이름</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">연락처</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">구매횟수</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">누적결제</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(m.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/members/${m.id}`} className="text-brand-700 hover:underline">
                      {maskName(m.name)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{maskContact(m.contact)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{m.order_count}건</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{formatKRW(m.total_spent)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/members/${m.id}`}>
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
        <span>총 {(count || 0).toLocaleString('ko-KR')}명</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="hover:underline" href={buildQueryHref('/members', { ...baseParams, page: String(page - 1) })}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={buildQueryHref('/members', { ...baseParams, page: String(page + 1) })}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
