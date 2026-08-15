import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import SubTabs from '@/components/SubTabs';
import EmptyState from '@/components/EmptyState';
import type { ReportStatsMonthlyRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GENDER_LABEL: Record<string, string> = { M: '남아', F: '여아' };

// 개인정보처리방침 제3조5·8호, 제4조② — 아동정보는 성명·생년월일 등 식별정보를 전혀 노출하지
// 않는 비식별 통계로만 활용한다. 이 페이지는 report_stats_monthly 뷰(월·성별 집계, PII 없음)만
// 조회하며, reports 원본 테이블에는 접근하지 않는다.
export default async function NamingStatsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('report_stats_monthly')
    .select('*')
    .order('month', { ascending: false })
    .limit(24);

  const rows = (data as unknown as ReportStatsMonthlyRow[]) || [];

  const byMonth = new Map<string, { month: string; total: number; sumScore: number; scored: number }>();
  for (const r of rows) {
    const cur = byMonth.get(r.month) || { month: r.month, total: 0, sumScore: 0, scored: 0 };
    cur.total += r.report_count;
    if (r.avg_score != null) {
      cur.sumScore += r.avg_score * r.report_count;
      cur.scored += r.report_count;
    }
    byMonth.set(r.month, cur);
  }
  const months = Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div>
      <PageHeader
        title="작명 통계"
        description="성명·생년월일 등 식별정보 없이, 월별·성별로 집계된 비식별 통계만 보여줍니다(개인정보처리방침 제3조·제4조 참고)."
      />
      <SubTabs
        active="/analytics/naming-stats"
        tabs={[
          { href: '/analytics', label: '전환율 퍼널' },
          { href: '/analytics/ai-usage', label: 'AI 비용' },
          { href: '/analytics/naming-stats', label: '작명 통계' },
        ]}
      />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            통계를 불러오지 못했습니다: {error.message}
          </p>
        ) : months.length === 0 ? (
          <EmptyState title="아직 쌓인 소견서가 없습니다" />
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">월</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">발급 건수</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">평균 점수</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">성별 분포</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const genderRows = rows.filter((r) => r.month === m.month);
                const genderText = genderRows
                  .map((r) => `${GENDER_LABEL[r.gender || ''] || '미상'} ${r.report_count}건`)
                  .join(' · ');
                return (
                  <tr key={m.month} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(m.month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{m.total}건</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {m.scored > 0 ? `${Math.round(m.sumScore / m.scored)}점` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{genderText || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
