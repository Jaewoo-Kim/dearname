'use client';

import { useRouter } from 'next/navigation';

export default function YearPicker({ value, options }: { value: string; options: string[] }) {
  const router = useRouter();

  return (
    <select
      value={value}
      onChange={(e) => router.push(`/dashboard?range=year&year=${e.target.value}`)}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {options.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  );
}
