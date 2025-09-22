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

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser();

  // パブリックパス（認証不要）
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return response;
  }

  // 未認証の場合
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // トップページへのアクセスの場合、ロールに応じてリダイレクト
  if (request.nextUrl.pathname === '/') {
    // staffテーブルからロール情報を取得
    const { data: staffData } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let userRole = 'staff';

    if (staffData) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('staff_id', staffData.id)
        .single();

      if (roleData) {
        userRole = roleData.role;
      }
    }

    // ロールに応じてリダイレクト
    if (['admin', 'manager'].includes(userRole)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      return NextResponse.redirect(new URL('/punch', request.url));
    }
  }

  // admin配下のパスへのアクセス制御
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // まずstaffテーブルからstaff_idを取得
    const { data: staffData } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let userRole = 'staff'; // デフォルトはstaff

    if (staffData) {
      // ユーザーのロールを取得
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('staff_id', staffData.id)
        .single();

      if (roleData) {
        userRole = roleData.role;
      }

      console.log('Middleware - User ID:', user.id);
      console.log('Middleware - Staff ID:', staffData.id);
      console.log('Middleware - Role:', userRole);
    }

    // admin, manager以外はアクセス拒否
    if (!['admin', 'manager'].includes(userRole)) {
      // staffは打刻ページへ
      if (userRole === 'staff') {
        return NextResponse.redirect(new URL('/punch', request.url));
      }
      // その他はログインページへ
      return NextResponse.redirect(new URL('/login', request.url));
    }
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