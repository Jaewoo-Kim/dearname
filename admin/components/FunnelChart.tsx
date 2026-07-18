'use client';

import { Funnel, FunnelChart as ReFunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts';

interface Stage {
  name: string;
  value: number;
  fill: string;
}

export default function FunnelChart({ data }: { data: Stage[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ReFunnelChart>
          <Tooltip formatter={(value: number) => `${value.toLocaleString('ko-KR')}건`} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList position="right" dataKey="name" fill="#334155" stroke="none" fontSize={13} />
          </Funnel>
        </ReFunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
