'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  label: string;
  revenue: number;
  orderCount: number;
}

export default function RevenueChart({ data }: { data: Point[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis
            yAxisId="revenue"
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickFormatter={(v: number) => `${Math.round(v / 10000)}만`}
          />
          <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === '매출' ? [`₩${value.toLocaleString('ko-KR')}`, name] : [`${value}건`, name]
            }
          />
          <Legend />
          <Bar yAxisId="revenue" dataKey="revenue" name="매출" fill="#c9973a" radius={[4, 4, 0, 0]} />
          <Line yAxisId="count" dataKey="orderCount" name="주문건수" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
