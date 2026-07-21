import { formatDate } from '@/lib/format';
import { SETTINGS_KEY_LABEL, summarizeSettingsValue } from '@/lib/settingsSummary';
import type { PendingSettingsChange } from '@/lib/types';

const STATUS_STYLE: Record<PendingSettingsChange['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

const STATUS_LABEL: Record<PendingSettingsChange['status'], string> = {
  pending: '승인 대기중',
  approved: '승인됨',
  rejected: '반려됨',
};

export default function MySettingsRequests({ items }: { items: PendingSettingsChange[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">내가 요청한 변경 내역</h2>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{SETTINGS_KEY_LABEL[item.key] || item.key}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
                {STATUS_LABEL[item.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{formatDate(item.created_at)}</p>
            <p className="mt-1 text-sm text-slate-600">{summarizeSettingsValue(item.key, item.requested_value)}</p>
            {item.status === 'rejected' && item.reject_reason && (
              <p className="mt-1 text-xs text-red-600">반려 사유: {item.reject_reason}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
