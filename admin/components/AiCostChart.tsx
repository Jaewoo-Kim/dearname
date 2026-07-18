'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Point {
  label: string;
  cost: number;
  calls: number;
}

export default function AiCostChart({ data }: { data: Point[] }) {
  return (
    <div className="mt-2 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === '비용' ? [`$${value.toFixed(4)}`, name] : [`${value}건`, name]
            }
          />
          <Bar dataKey="cost" name="비용" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
