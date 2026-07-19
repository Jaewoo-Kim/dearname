import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedEmail } from '@/lib/authz';

export async function middleware(request: NextRequest) {
  // 세션 쿠키는 JWT 크기 탓에 sb-*-auth-token.0/.1/... 여러 조각으로 나뉘어 set()이
  // 여러 번 호출된다. 매번 response를 새로 만들면 이전 호출에서 붙인 쿠키(조각)가
  // 사라져 마지막 조각만 저장되고, 다음 방문 때 세션을 못 읽어 매번 재로그인해야
  // 하는 문제가 생긴다 — 하나의 response를 계속 재사용해야 한다.
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '' });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/auth');

  const isAllowed = isAllowedEmail(user?.email);

  if (!isAllowed && !isPublic) {
    // API 라우트는 HTML 리다이렉트 대신 JSON 401을 내려줘야 fetch() 호출부가 정확히 처리할 수 있다.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (user) url.searchParams.set('error', 'not_allowed');
    return NextResponse.redirect(url);
  }

  if (isAllowed && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/orders';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
