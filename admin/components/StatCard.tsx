import type { LucideIcon } from 'lucide-react';

type Accent = 'brand' | 'emerald' | 'red' | 'slate';

const ACCENT_BG: Record<Accent, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  footnote,
  accent = 'brand',
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** 증감(+/-)에 따라 초록/빨강으로 색칠되는 지표 — 이전 구간 대비 매출 변화처럼 방향성이 있는 값에만 사용 */
  trend?: { value: number; label?: string };
  /** 색상 의미 없이 덧붙이는 보조 설명 — 전환율처럼 값 자체에 좋고 나쁨이 없는 경우 */
  footnote?: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-popover">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {Icon && (
          <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg lg:flex ${ACCENT_BG[accent]}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
        </p>
      )}
      {footnote && <p className="mt-1 text-xs text-slate-400">{footnote}</p>}
    </div>
  );
}
