import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// service_role 키는 RLS를 우회한다 — Route Handler(서버) 안에서만 생성/사용할 것.
// 브라우저 번들에 절대 노출되면 안 되므로 'use client' 컴포넌트에서 import 금지.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
