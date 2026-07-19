import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { isAllowedEmail } from '@/lib/authz';

// 운영자 설정 저장 (Phase 3 — 가격/점검모드). 본 서비스는 GET /api/settings로 조회만 하고
// 쓰기는 여기(서버 전용 Route Handler, service_role)에서만 이루어진다.
const ALLOWED_KEYS = ['pricing', 'maintenance'] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

function isValidPricing(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { self?: unknown; tiers?: unknown };
  if (!Number.isFinite(v.self) || (v.self as number) < 0) return false;
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

function isValidMaintenance(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as { enabled?: unknown; message?: unknown };
  return typeof v.enabled === 'boolean' && typeof v.message === 'string';
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const key = body.key as SettingKey;
  const value = body.value;

  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: '알 수 없는 설정 키입니다.' }, { status: 400 });
  }
  if (key === 'pricing' && !isValidPricing(value)) {
    return NextResponse.json({ error: '가격 설정 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (key === 'maintenance' && !isValidMaintenance(value)) {
    return NextResponse.json({ error: '점검모드 설정 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from('settings').upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: user!.email,
  });

  if (error) {
    return NextResponse.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'update_settings',
    target_type: 'settings',
    target_id: null,
    detail: { key, value },
  });

  return NextResponse.json({ status: 'ok' });
}
