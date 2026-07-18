import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Server Component/Route Handler 전용 Supabase 클라이언트.
// RLS "authenticated" 정책에 의존하므로 반드시 로그인한 운영자 세션 쿠키로 호출한다.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component에서 호출되면 세션 갱신은 middleware가 담당하므로 무시 가능
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // 위와 동일
          }
        },
      },
    }
  );
}
