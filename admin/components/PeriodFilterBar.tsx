import Link from 'next/link';
import { buildQueryHref, PERIOD_OPTIONS } from '@/lib/format';

export default function PeriodFilterBar({
  basePath,
  baseParams,
  period,
}: {
  basePath: string;
  baseParams: Record<string, string>;
  period: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {PERIOD_OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={buildQueryHref(basePath, { ...baseParams, period: opt.value, page: '' })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            period === opt.value
              ? 'bg-slate-800 text-white'
              : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
