/**
 * 보호된 페이지 레이아웃
 *
 * 인증이 필요한 모든 페이지(대시보드, 상품, 주문 등)에 공통으로 적용되는 레이아웃
 * - Header 컴포넌트 포함 (로고, 네비게이션, 로그아웃 버튼)
 * - 세션 확인 및 리다이렉트
 */

import { Header } from '@/components/common/Header';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}
