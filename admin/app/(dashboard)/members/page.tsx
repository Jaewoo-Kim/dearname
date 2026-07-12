import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatKRW, maskContact, maskName } from '@/lib/format';
import type { Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function MembersPage({ searchParams }: { searchParams: { page?: string } }) {
  const supabase = createClient();
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const members = (data as unknown as Member[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">회원</h1>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">가입일</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">연락처</th>
              <th className="px-4 py-3 font-medium">구매횟수</th>
              <th className="px-4 py-3 font-medium">누적결제</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-red-600">회원 목록을 불러오지 못했습니다: {error.message}</td></tr>
            )}
            {!error && members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">회원 데이터가 없습니다.</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{formatDate(m.created_at)}</td>
                <td className="px-4 py-3">
                  <Link href={`/members/${m.id}`} className="text-brand-700 hover:underline">
                    {maskName(m.name)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{maskContact(m.contact)}</td>
                <td className="px-4 py-3 text-slate-600">{m.order_count}건</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatKRW(m.total_spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}명</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="hover:underline" href={`/members?page=${page - 1}`}>이전</Link>}
          <span>{page} / {totalPages}</span>
          {page < totalPages && <Link className="hover:underline" href={`/members?page=${page + 1}`}>다음</Link>}
        </div>
      </div>
    </div>
  );
}
