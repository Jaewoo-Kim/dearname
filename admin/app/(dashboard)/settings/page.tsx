import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/PageHeader';
import PricingSettingsForm from '@/components/PricingSettingsForm';
import MaintenanceSettingsForm from '@/components/MaintenanceSettingsForm';
import type { MaintenanceSettings, PricingSettings } from '@/lib/types';

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
  const { data } = await supabase.from('settings').select('*');
  const rows = (data as Array<{ key: string; value: unknown }> | null) || [];
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    pricing: (map.get('pricing') as PricingSettings) || DEFAULT_PRICING,
    maintenance: (map.get('maintenance') as MaintenanceSettings) || DEFAULT_MAINTENANCE,
  };
}

export default async function SettingsPage() {
  const { pricing, maintenance } = await getSettings();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="설정"
        description="본 서비스의 가격과 점검 모드를 관리합니다. 저장하면 실제 사이트에 바로 반영됩니다."
      />

      <div className="space-y-4">
        <PricingSettingsForm initial={pricing} />
        <MaintenanceSettingsForm initial={maintenance} />
      </div>
    </div>
  );
}
