'use client';

import { useRouter } from 'next/navigation';

export default function MonthPicker({ value }: { value: string }) {
  const router = useRouter();

  return (
    <input
      type="month"
      value={value}
      onChange={(e) => {
        if (!e.target.value) return;
        router.push(`/dashboard?range=month&month=${e.target.value}`);
      }}
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  );
}
