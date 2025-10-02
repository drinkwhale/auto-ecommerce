/**
 * 보호된 페이지 레이아웃
 *
 * 인증이 필요한 모든 페이지(대시보드, 상품, 주문 등)에 공통으로 적용되는 레이아웃
 * - Header 컴포넌트 포함 (로고, 네비게이션, 로그아웃 버튼)
 * - Sidebar 컴포넌트 포함 (메뉴 네비게이션)
 * - 세션 확인 및 리다이렉트
 */

'use client';

import { useState } from 'react';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
