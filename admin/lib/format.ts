// 개인정보 마스킹 + 표시용 포맷 헬퍼 (admin_site_plan.md 6장 보안 체크리스트)

export function maskName(name?: string | null): string {
  if (!name) return '-';
  const chars = Array.from(name);
  if (chars.length <= 1) return chars.join('');
  if (chars.length === 2) return `${chars[0]}○`;
  return chars.map((c, i) => (i === 0 || i === chars.length - 1 ? c : '○')).join('');
}

export function maskContact(contact?: string | null): string {
  if (!contact) return '-';
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@');
    if (!domain) return contact;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
  }
  const digits = contact.replace(/[^0-9]/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return contact;
}

export function formatKRW(amount?: number | null): string {
  if (amount == null) return '-';
  return `₩${amount.toLocaleString('ko-KR')}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  refunded: '환불됨',
  failed: '실패',
};

export const PRODUCT_LABEL: Record<string, string> = {
  premium: 'AI 프리미엄 작명',
  self: '셀프 작명',
};

// 기간 필터 UI(주문·보고서·회원 목록 등)에서 공통으로 쓰는 옵션 목록
export const PERIOD_OPTIONS = [
  { value: '', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번주' },
  { value: 'month', label: '이번달' },
  { value: 'year', label: '올해' },
];

// 쿼리스트링 링크 생성 헬퍼 — 빈 값은 제거해 URL을 깔끔하게 유지
export function buildQueryHref(basePath: string, params: Record<string, string>): string {
  const usp = new URLSearchParams(params);
  for (const [k, v] of Array.from(usp.entries())) {
    if (!v) usp.delete(k);
  }
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// 기간 필터(주문 목록 등)의 KST 기준 시작 시각 계산
export function getPeriodStartUTC(period: string): Date | null {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();

  let startKst: Date;
  switch (period) {
    case 'today':
      startKst = new Date(Date.UTC(y, m, d));
      break;
    case 'week': {
      const day = kstNow.getUTCDay(); // 0=일요일
      const diffToMonday = day === 0 ? 6 : day - 1;
      startKst = new Date(Date.UTC(y, m, d - diffToMonday));
      break;
    }
    case 'month':
      startKst = new Date(Date.UTC(y, m, 1));
      break;
    case 'year':
      startKst = new Date(Date.UTC(y, 0, 1));
      break;
    default:
      return null;
  }
  return new Date(startKst.getTime() - KST_OFFSET_MS);
}
