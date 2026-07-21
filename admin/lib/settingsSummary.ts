export const SETTINGS_KEY_LABEL: Record<string, string> = { pricing: '가격 설정', maintenance: '점검 모드' };

export function summarizeSettingsValue(key: string, value: unknown): string {
  if (!value || typeof value !== 'object') return '-';
  if (key === 'maintenance') {
    const v = value as { enabled?: boolean; message?: string };
    return `점검모드 ${v.enabled ? '켜짐' : '꺼짐'}${v.message ? ` · "${v.message}"` : ''}`;
  }
  if (key === 'pricing') {
    const v = value as { self?: number; tiers?: Array<{ count: number; price: number }>; promotion?: { enabled?: boolean; percent?: number; label?: string } };
    const tiers = (v.tiers || []).map((t) => `${t.count}개 ${t.price.toLocaleString()}원`).join(', ');
    const promo = v.promotion?.enabled ? ` · 프로모션 ${v.promotion.percent}%${v.promotion.label ? ` "${v.promotion.label}"` : ''}` : '';
    return `${tiers}${promo}`;
  }
  return JSON.stringify(value);
}
