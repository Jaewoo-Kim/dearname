import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/adminUser';
import { buildQueryHref, formatDate, getPeriodStartUTC } from '@/lib/format';
import { ACTION_LABEL, actionLabel, targetHref, targetLabel } from '@/lib/auditLog';
import PageHeader from '@/components/PageHeader';
import PeriodFilterBar from '@/components/PeriodFilterBar';
import EmptyState from '@/components/EmptyState';
import AuditLogDetail from '@/components/AuditLogDetail';
import type { AdminUserRow, AuditLogRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { period?: string; action?: string; actor?: string; page?: string };
}) {
  const me = await getCurrentAdminUser();
  if (!me || me.role !== 'admin') redirect('/dashboard');

  const supabase = createClient();
  const period = searchParams.period || '';
  const action = searchParams.action || '';
  const actor = searchParams.actor || '';
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (action) query = query.eq('action', action);
  if (actor) query = query.eq('actor', actor);
  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());

  const { data, count, error } = await query;
  const logs = (data as AuditLogRow[] | null) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { period, action, actor };

  const { data: adminUsersData } = await supabase.from('admin_users').select('email').order('email', { ascending: true });
  const actorOptions = ((adminUsersData as AdminUserRow[] | null) || []).map((u) => u.email);

  return (
    <div>
      <PageHeader
        title="감사 로그"
        description="환불·승인·등급 변경 등 민감한 작업의 기록입니다. 누가·언제·무엇을 했는지 여기서 확인할 수 있습니다."
      />

      <PeriodFilterBar basePath="/audit-logs" baseParams={baseParams} period={period} />

      <div className="mb-4">
        <form className="flex flex-wrap gap-2" action="/audit-logs" method="get">
          {period && <input type="hidden" name="period" value={period} />}
          <select
            name="action"
            defaultValue={action}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-brand-500 focus:outline-none"
          >
            <option value="">전체 작업</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            name="actor"
            defaultValue={actor}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 focus:border-brand-500 focus:outline-none"
          >
            <option value="">전체 담당자</option>
            {actorOptions.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
          >
            적용
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            감사 로그를 불러오지 못했습니다: {error.message}
          </p>
        ) : logs.length === 0 ? (
          <EmptyState title="기록이 없습니다" />
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">시각</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">담당자</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">작업</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">대상</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const href = targetHref(log.target_type, log.target_id);
                return (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{formatDate(log.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{log.actor}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{actionLabel(log.action)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {href ? (
                        <Link href={href} className="text-brand-700 hover:underline">
                          {targetLabel(log.target_type)} 보기 →
                        </Link>
                      ) : (
                        <span className="text-slate-400">{targetLabel(log.target_type)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AuditLogDetail detail={log.detail} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}건</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="hover:underline" href={buildQueryHref('/audit-logs', { ...baseParams, page: String(page - 1) })}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={buildQueryHref('/audit-logs', { ...baseParams, page: String(page + 1) })}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
