/**
 * NextAuth.js API Route Handler
 *
 * Next.js 14 App Router에서 NextAuth.js를 사용하기 위한 API 라우트 핸들러
 * - GET, POST 메서드를 모두 NextAuth가 처리
 * - /api/auth/* 경로의 모든 요청 처리
 *
 * Phase 3.5: API 엔드포인트 구현 - T031
 *
 * 지원하는 엔드포인트:
 * - GET/POST /api/auth/signin - 로그인
 * - GET/POST /api/auth/signout - 로그아웃
 * - GET /api/auth/session - 현재 세션 조회
 * - GET /api/auth/csrf - CSRF 토큰 조회
 * - GET /api/auth/providers - 사용 가능한 인증 제공자 목록
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * NextAuth 핸들러 생성
 * - authOptions를 사용하여 인증 설정 적용
 */
const handler = NextAuth(authOptions);

/**
 * GET, POST 요청을 모두 NextAuth 핸들러로 전달
 */
export { handler as GET, handler as POST };