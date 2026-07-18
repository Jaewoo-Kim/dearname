import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import HanjaDbSearch from '@/components/HanjaDbSearch';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/format';

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

async function getOverrides() {
  const supabase = createClient();
  const { data } = await supabase.from('hanja_overrides').select('*').order('updated_at', { ascending: false });
  return (data as HanjaOverrideRow[] | null) || [];
}

export default async function HanjaDbPage() {
  const overrides = await getOverrides();
  const siteUrl = process.env.NEXT_PUBLIC_DEARNAME_SITE_URL || null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="한자 DB 수정"
        description="한자 검색 후 뜻·획수·자원오행을 정정할 수 있습니다. 저장하면 이름 탐색 결과에 바로 반영됩니다."
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
      </div>
    </div>
  );
}
