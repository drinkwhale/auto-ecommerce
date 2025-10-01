/**
 * Next.js 미들웨어
 *
 * NextAuth.js를 사용한 라우트 보호 및 인증 처리
 * - 보호된 경로에 대한 인증 확인
 * - 미인증 사용자 리다이렉트
 * - 인증된 사용자의 auth 페이지 접근 차단
 * - API 라우트 보호
 *
 * Phase 3.8: 통합 및 미들웨어 - T059
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
    const isApiRoute = req.nextUrl.pathname.startsWith('/api');

    // 인증된 사용자가 auth 페이지에 접근하려는 경우
    if (isAuthPage && isAuth) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // API 라우트는 개별적으로 인증 처리 (withAuth가 자동 처리)
    if (isApiRoute) {
      // /api/auth는 항상 허용
      if (req.nextUrl.pathname.startsWith('/api/auth')) {
        return NextResponse.next();
      }

      // /api/health는 인증 불필요
      if (req.nextUrl.pathname === '/api/health') {
        return NextResponse.next();
      }

      // 나머지 API는 인증 필요 (withAuth가 자동으로 401 반환)
      // 미인증 시 withAuth의 authorized 콜백에서 false 반환
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith('/auth');
        const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth');
        const isHealthCheck = req.nextUrl.pathname === '/api/health';

        // auth 페이지와 auth API는 항상 허용
        if (isAuthPage || isApiAuth || isHealthCheck) {
          return true;
        }

        // 나머지는 토큰이 있어야 함
        return !!token;
      },
    },
  }
);

/**
 * 미들웨어가 실행될 경로 매칭 설정
 *
 * 포함:
 * - /dashboard, /products, /orders, /analytics (보호된 페이지)
 * - /api/v1/* (보호된 API)
 *
 * 제외:
 * - / (홈 페이지)
 * - /auth/* (인증 페이지)
 * - /api/auth/* (NextAuth.js API)
 * - /api/health (헬스체크)
 * - /_next/* (Next.js 내부)
 * - /favicon.ico, /robots.txt 등 정적 파일
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js API routes)
     * - api/health (Health check)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/dashboard/:path*',
    '/products/:path*',
    '/orders/:path*',
    '/analytics/:path*',
    '/api/v1/:path*',
  ],
};
