import { STATUS_LABEL } from '@/lib/format';

const DOT: Record<string, string> = {
  paid: 'bg-emerald-500',
  refunded: 'bg-slate-400',
  failed: 'bg-red-500',
};

const TEXT: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  refunded: 'bg-slate-100 text-slate-500',
  failed: 'bg-red-50 text-red-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        TEXT[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status] || 'bg-slate-400'}`} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}
