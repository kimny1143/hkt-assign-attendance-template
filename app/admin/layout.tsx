'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo as Home Link */}
            <Link
              href="/admin"
              className="flex-shrink-0 flex items-center group"
              title="ダッシュボードに戻る"
            >
              <Image
                src="/icons/icon-72x72.png"
                alt="HAAS"
                width={32}
                height={32}
                className="mr-2 transition-transform group-hover:scale-110"
              />
              <h1 className="text-xl font-bold text-gray-900 group-hover:text-blue-600">HAAS</h1>
            </Link>

            {/* Current Page Indicator */}
            {pathname !== '/admin' && (
              <div className="hidden sm:flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {pathname.includes('/staff') && 'スタッフ管理'}
                {pathname.includes('/venues') && '会場管理'}
                {pathname.includes('/equipment') && '機材QR管理'}
                {pathname.includes('/events') && 'イベント管理'}
                {pathname.includes('/shifts') && 'シフト管理'}
                {pathname.includes('/assign') && 'アサイン管理'}
                {pathname.includes('/attendance') && '勤怠管理'}
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2 rounded-md hover:bg-gray-100 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}