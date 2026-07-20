export const SETTINGS_KEYS = ['pricing', 'maintenance'] as const;
export type SettingKey = (typeof SETTINGS_KEYS)[number];

export function isValidSettingKey(key: unknown): key is SettingKey {
  return key === 'pricing' || key === 'maintenance';
}

export function isValidPromotion(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { enabled?: unknown; percent?: unknown; label?: unknown };
  if (typeof v.enabled !== 'boolean') return false;
  if (!Number.isFinite(v.percent) || (v.percent as number) < 0 || (v.percent as number) > 90) return false;
  return typeof v.label === 'string';
}

export function isValidPricing(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { self?: unknown; tiers?: unknown; promotion?: unknown };
  if (!Number.isFinite(v.self) || (v.self as number) < 0) return false;
  if (!isValidPromotion(v.promotion)) return false;
  const tiers = v.tiers;
  if (!Array.isArray(tiers) || tiers.length === 0) return false;
  const shapeValid = tiers.every(
    (t) =>
      t && typeof t === 'object' &&
      Number.isInteger((t as { count?: unknown }).count) && (t as { count: number }).count > 0 &&
      Number.isFinite((t as { price?: unknown }).price) && (t as { price: number }).price >= 0
  );
  if (!shapeValid) return false;

  // index.html의 _dnCountMap이 price를 키로 개수를 역참조하므로, 가격이 겹치면
  // 결제 시 엉뚱한 구성(개수)으로 매칭될 수 있다 — count/price 모두 중복을 막는다.
  const counts = tiers.map((t) => (t as { count: number }).count);
  const prices = tiers.map((t) => (t as { price: number }).price);
  return new Set(counts).size === counts.length && new Set(prices).size === prices.length;
}

export function isValidMaintenance(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { enabled?: unknown; message?: unknown };
  return typeof v.enabled === 'boolean' && typeof v.message === 'string';
}

export function isValidSettingValue(key: SettingKey, value: unknown): boolean {
  return key === 'pricing' ? isValidPricing(value) : isValidMaintenance(value);
}
