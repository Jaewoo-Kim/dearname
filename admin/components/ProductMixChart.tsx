'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PRODUCT_LABEL, formatKRW } from '@/lib/format';
import EmptyState from '@/components/EmptyState';
import type { ProductMixRow } from '@/lib/types';

const COLORS = ['#c9973a', '#94a3b8'];

export default function ProductMixChart({ data }: { data: ProductMixRow[] }) {
  const chartData = data
    .filter((d) => d.revenue > 0)
    .map((d) => ({ name: PRODUCT_LABEL[d.product] || d.product, value: d.revenue }));

  if (chartData.length === 0) {
    return <EmptyState title="표시할 데이터가 없습니다" />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
          <Tooltip formatter={(value: number) => formatKRW(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
