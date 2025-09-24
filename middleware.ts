import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // セッションの更新のみ（認可はRLSに委譲）
  const { data: { session } } = await supabase.auth.getSession();

  // パブリックパス（認証不要）
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout', '/api/health'];
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (isPublicPath) {
    return response;
  }

  // 保護されたパスへのアクセス制御（認証のみチェック）
  if (!session) {
    // APIルートの場合は401を返す
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // それ以外はログインページへリダイレクト
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // トップページへのアクセスの場合、デフォルトページへリダイレクト
  // （RLSによりロール判定は不要、クライアント側で処理）
  if (request.nextUrl.pathname === '/') {
    // 管理者判定は行わず、一旦punchページへ
    // クライアント側でロールに応じたリダイレクトを行う
    return NextResponse.redirect(new URL('/punch', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};