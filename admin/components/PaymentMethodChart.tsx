'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatKRW } from '@/lib/format';
import EmptyState from '@/components/EmptyState';
import type { PaymentMethodRow } from '@/lib/types';

export default function PaymentMethodChart({ data }: { data: PaymentMethodRow[] }) {
  const chartData = data
    .filter((d) => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map((d) => ({ label: d.payment_method, revenue: d.revenue }));

  if (chartData.length === 0) {
    return <EmptyState title="표시할 데이터가 없습니다" />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v: number) => `${Math.round(v / 10000)}만`} />
          <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 12, fill: '#64748b' }} />
          <Tooltip formatter={(value: number) => formatKRW(value)} />
          <Bar dataKey="revenue" fill="#c9973a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
