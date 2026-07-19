import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import HanjaDbSearch from '@/components/HanjaDbSearch';
import TabooHanjaForm from '@/components/TabooHanjaForm';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/format';
import type { TabooHanjaRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface HanjaOverrideRow {
  hanja: string;
  kr: string;
  m: string | null;
  s: number | null;
  o: string | null;
  updated_at: string;
  updated_by: string | null;
}

async function getPageData() {
  const supabase = createClient();
  const [{ data: overridesData }, { data: tabooData }] = await Promise.all([
    supabase.from('hanja_overrides').select('*').order('updated_at', { ascending: false }),
    supabase.from('taboo_hanja').select('hanja, reason').order('hanja', { ascending: true }),
  ]);

  return {
    overrides: (overridesData as HanjaOverrideRow[] | null) || [],
    tabooHanja: (tabooData as TabooHanjaRow[] | null) || [],
  };
}

export default async function HanjaDbPage() {
  const { overrides, tabooHanja } = await getPageData();
  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL || null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="한자 DB"
        description="한자 검색·정정과 금기 한자 관리를 한 곳에서 합니다. 저장하면 이름 탐색 결과에 바로 반영됩니다."
      />

      <div className="space-y-4">
        <HanjaDbSearch siteUrl={siteUrl} />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-500">현재 적용 중인 정정 내역</h2>
          {overrides.length === 0 ? (
            <EmptyState title="아직 정정한 한자가 없습니다" />
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">한자</th>
                  <th className="py-2 font-medium">음</th>
                  <th className="py-2 font-medium">뜻</th>
                  <th className="py-2 font-medium">획수</th>
                  <th className="py-2 font-medium">자원오행</th>
                  <th className="py-2 font-medium">수정일시</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((r) => (
                  <tr key={`${r.hanja}-${r.kr}`} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-900">{r.hanja}</td>
                    <td className="py-2 text-slate-600">{r.kr}</td>
                    <td className="py-2 text-slate-600">{r.m || '-'}</td>
                    <td className="py-2 tabular-nums text-slate-600">{r.s ?? '-'}</td>
                    <td className="py-2 text-slate-600">{r.o || '-'}</td>
                    <td className="py-2 text-slate-400">{formatDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <TabooHanjaForm initial={tabooHanja} />
      </div>
    </div>
  );
}
