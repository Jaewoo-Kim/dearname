import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import PageHeader from '@/components/PageHeader';
import PricingSettingsForm from '@/components/PricingSettingsForm';
import MaintenanceSettingsForm from '@/components/MaintenanceSettingsForm';
import PendingSettingsApprovals from '@/components/PendingSettingsApprovals';
import MySettingsRequests from '@/components/MySettingsRequests';
import type { MaintenanceSettings, PendingSettingsChange, PricingSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PRICING: PricingSettings = {
  self: 0,
  tiers: [
    { count: 1, price: 30000 },
    { count: 2, price: 50000 },
    { count: 3, price: 70000 },
    { count: 5, price: 100000 },
  ],
  promotion: { enabled: false, percent: 0, label: '' },
};
const DEFAULT_MAINTENANCE: MaintenanceSettings = { enabled: false, message: '' };

async function getSettings() {
  const supabase = createClient();
  const { data: settingsData } = await supabase.from('settings').select('*');

  const rows = (settingsData as Array<{ key: string; value: unknown }> | null) || [];
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    pricing: (map.get('pricing') as PricingSettings) || DEFAULT_PRICING,
    maintenance: (map.get('maintenance') as MaintenanceSettings) || DEFAULT_MAINTENANCE,
  };
}

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = await fetchRole(supabase, user?.email || '');

  const { pricing, maintenance } = await getSettings();

  let pendingChanges: PendingSettingsChange[] = [];
  let myRequests: PendingSettingsChange[] = [];
  if (role === 'admin') {
    const { data } = await supabase
      .from('pending_settings_changes')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    pendingChanges = (data as PendingSettingsChange[] | null) || [];
  } else if (role === 'editor' && user?.email) {
    const { data } = await supabase
      .from('pending_settings_changes')
      .select('*')
      .eq('requested_by', user.email)
      .order('created_at', { ascending: false })
      .limit(10);
    myRequests = (data as PendingSettingsChange[] | null) || [];
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="운영 관리"
        description={
          role === 'editor'
            ? '가격과 점검 모드를 변경할 수 있지만, 파급력이 커서 어드민 승인 후 실제 사이트에 반영됩니다.'
            : '본 서비스의 가격과 점검 모드를 관리합니다. 저장하면 실제 사이트에 바로 반영됩니다.'
        }
      />

      <div className="space-y-4">
        {role === 'admin' && <PendingSettingsApprovals items={pendingChanges} />}
        {role === 'editor' && <MySettingsRequests items={myRequests} />}
        <MaintenanceSettingsForm initial={maintenance} role={role} />
        <PricingSettingsForm initial={pricing} role={role} />
      </div>
    </div>
  );
}
