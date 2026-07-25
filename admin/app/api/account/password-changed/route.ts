import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';

// 본인이 /account에서 비밀번호를 직접 바꾼 뒤 호출한다. admin_users는 authenticated
// 역할에 update 정책이 없어(service_role 전용) 본인이라도 직접 갱신할 수 없으므로,
// 여기서 로그인 세션으로 본인 확인 후 service_role로 강제변경 플래그만 해제한다.
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const db = createServiceRoleClient();
  await db
    .from('admin_users')
    .update({ must_change_password: false })
    .eq('email', user.email!.toLowerCase());

  return NextResponse.json({ status: 'ok' });
}
