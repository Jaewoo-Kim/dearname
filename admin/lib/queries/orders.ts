import { getPeriodStartUTC, sanitizeSearchTerm } from '@/lib/format';

// orders 목록/CSV 내보내기가 공유하는 필터 로직. orders에는 회원 이름/연락처
// 컬럼이 없어(members 조인 필드) 검색어가 있으면 먼저 일치하는 회원 id를 찾은 뒤
// 토스 주문번호 검색과 OR로 묶는다.
export async function applyOrdersSearch(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  query: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  params: { status?: string; period?: string; q?: string }
) {
  const status = params.status || '';
  const period = params.period || '';
  const q = sanitizeSearchTerm(params.q || '');

  if (status) query = query.eq('status', status);
  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());
  if (q) {
    const { data: matchedMembers } = await supabase
      .from('members')
      .select('id')
      .or(`name.ilike.%${q}%,contact.ilike.%${q}%`);
    const memberIds = ((matchedMembers as { id: string }[] | null) || []).map((m) => m.id);
    const orParts = [`toss_order_id.ilike.%${q}%`];
    if (memberIds.length > 0) orParts.push(`member_id.in.(${memberIds.join(',')})`);
    query = query.or(orParts.join(','));
  }
  return query;
}
