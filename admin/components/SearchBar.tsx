import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { buildQueryHref } from '@/lib/format';

export default function SearchBar({
  basePath,
  hiddenParams,
  q,
  placeholder,
}: {
  basePath: string;
  hiddenParams: Record<string, string>;
  q: string;
  placeholder: string;
}) {
  return (
    <form action={basePath} method="get" className="mb-4 flex items-center gap-2">
      {Object.entries(hiddenParams)
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <div className="relative flex-1 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        검색
      </button>
      {q && (
        <Link
          href={buildQueryHref(basePath, { ...hiddenParams, q: '', page: '' })}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
          초기화
        </Link>
      )}
    </form>
  );
}
