'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      // 認証状態を確認
      const res = await fetch('/api/auth/me');

      if (!res.ok) {
        // 未認証の場合はログインページへ
        router.push('/login');
        return;
      }

      const data = await res.json();
      const userRole = data.user?.role;

      // ロールに応じてリダイレクト
      switch (userRole) {
        case 'admin':
        case 'manager':
          router.push('/admin');
          break;
        case 'staff':
        default:
          router.push('/punch');
          break;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">HAAS</h1>
        <p className="text-gray-600">リダイレクト中...</p>
      </div>
    </main>
  );
}