import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import PricingSettingsForm from '@/components/PricingSettingsForm';
import MaintenanceSettingsForm from '@/components/MaintenanceSettingsForm';
import TabooHanjaForm from '@/components/TabooHanjaForm';
import type { MaintenanceSettings, PricingSettings, TabooHanjaRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PRICING: PricingSettings = {
  tiers: [
    { count: 1, price: 30000 },
    { count: 2, price: 50000 },
    { count: 3, price: 70000 },
    { count: 5, price: 100000 },
  ],
};
const DEFAULT_MAINTENANCE: MaintenanceSettings = { enabled: false, message: '' };

async function getSettings() {
  const supabase = createClient();
  const [{ data: settingsData }, { data: tabooData }] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('taboo_hanja').select('hanja, reason').order('hanja', { ascending: true }),
  ]);

  const rows = (settingsData as Array<{ key: string; value: unknown }> | null) || [];
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    pricing: (map.get('pricing') as PricingSettings) || DEFAULT_PRICING,
    maintenance: (map.get('maintenance') as MaintenanceSettings) || DEFAULT_MAINTENANCE,
    tabooHanja: (tabooData as TabooHanjaRow[] | null) || [],
  };
}

export default async function SettingsPage() {
  const { pricing, maintenance, tabooHanja } = await getSettings();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="설정"
        description="본 서비스의 가격·점검 모드·금기 한자를 관리합니다. 저장하면 실제 사이트에 바로 반영됩니다."
      />

      <div className="space-y-4">
        <PricingSettingsForm initial={pricing} />
        <MaintenanceSettingsForm initial={maintenance} />
        <TabooHanjaForm initial={tabooHanja} />
      </div>
    </div>
  );
}
