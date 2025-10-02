/**
 * Sidebar 컴포넌트
 *
 * 애플리케이션의 사이드바 네비게이션
 * - 계층적 메뉴 구조
 * - 아이콘 기반 네비게이션
 * - 접기/펼치기 기능
 * - 활성 상태 표시
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T045
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  {
    label: '대시보드',
    href: '/dashboard',
    icon: '📊',
  },
  {
    label: '상품',
    href: '/products',
    icon: '📦',
    children: [
      { label: '상품 목록', href: '/products', icon: '📋' },
      { label: '상품 등록', href: '/products/new', icon: '➕' },
      { label: '상품 검색', href: '/search', icon: '🔎' },
      { label: '크롤링', href: '/products/crawl', icon: '🔍' },
    ],
  },
  {
    label: '주문',
    href: '/orders',
    icon: '🛒',
    children: [
      { label: '주문 목록', href: '/orders', icon: '📋' },
      { label: '처리 대기', href: '/orders?status=RECEIVED', icon: '⏳' },
      { label: '배송중', href: '/orders?status=SHIPPING', icon: '🚚' },
      { label: '완료', href: '/orders?status=DELIVERED', icon: '✅' },
    ],
  },
  {
    label: '통계',
    href: '/analytics',
    icon: '📈',
    children: [
      { label: '대시보드', href: '/analytics', icon: '📊' },
      { label: '매출 분석', href: '/analytics/revenue', icon: '💰' },
      { label: '상품 분석', href: '/analytics/products', icon: '📦' },
    ],
  },
  {
    label: '설정',
    href: '/settings',
    icon: '⚙️',
    children: [
      { label: '프로필', href: '/settings/profile', icon: '👤' },
      { label: '계정', href: '/settings/account', icon: '🔐' },
      { label: '알림', href: '/settings/notifications', icon: '🔔' },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['/products', '/orders']);

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((item) => item !== href) : [...prev, href]
    );
  };

  const isExpanded = (href: string) => expandedItems.includes(href);

  return (
    <aside
      className={`
        bg-gray-900 text-white transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
        flex flex-col h-full
      `}
    >
      {/* 사이드바 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <h2 className="text-lg font-semibold truncate">메뉴</h2>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-800 transition-colors"
          aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* 사이드바 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {sidebarItems.map((item) => (
            <li key={item.href}>
              {/* 메인 아이템 */}
              <div className="relative">
                <Link
                  href={item.children ? '#' : item.href}
                  onClick={(e) => {
                    if (item.children) {
                      e.preventDefault();
                      toggleExpanded(item.href);
                    }
                  }}
                  className={`
                    flex items-center justify-between px-3 py-2 rounded-md
                    transition-colors group
                    ${
                      isActive(item.href)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && item.children && (
                    <span className="text-xs">
                      {isExpanded(item.href) ? '▼' : '▶'}
                    </span>
                  )}
                </Link>

                {/* 툴팁 (collapsed 상태일 때) */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </div>

              {/* 하위 아이템 */}
              {!collapsed && item.children && isExpanded(item.href) && (
                <ul className="mt-1 ml-4 space-y-1">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={`
                          flex items-center space-x-3 px-3 py-2 rounded-md
                          text-sm transition-colors
                          ${
                            isActive(child.href)
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                      >
                        <span className="text-base">{child.icon}</span>
                        <span className="truncate">{child.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* 사이드바 푸터 */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400 text-center">
            <p>Auto E-commerce v1.0</p>
            <p className="mt-1">© 2024 All rights reserved</p>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;