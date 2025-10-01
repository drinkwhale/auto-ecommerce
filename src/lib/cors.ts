/**
 * CORS 및 보안 헤더 설정
 *
 * API 보안을 위한 CORS 설정 및 보안 헤더
 * - CORS 설정
 * - CSP (Content Security Policy)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 *
 * Phase 3.8: 통합 및 미들웨어 - T060
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS 설정
 */
export const corsConfig = {
  // 허용할 Origin 목록
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.NEXTAUTH_URL || '',
    process.env.NEXT_PUBLIC_APP_URL || '',
  ].filter(Boolean),

  // 허용할 HTTP 메서드
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // 허용할 헤더
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],

  // 노출할 헤더
  exposedHeaders: ['Content-Range', 'X-Content-Range'],

  // Credentials 허용
  credentials: true,

  // Preflight 요청 캐시 시간 (초)
  maxAge: 86400, // 24시간
};

/**
 * 보안 헤더 설정
 */
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join('; '),

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // XSS Protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions Policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * CORS 헤더 적용
 */
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');

  // Origin이 허용 목록에 있는지 확인
  if (origin && corsConfig.allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // 개발 환경에서는 모든 Origin 허용
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  );

  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  );

  response.headers.set(
    'Access-Control-Expose-Headers',
    corsConfig.exposedHeaders.join(', ')
  );

  if (corsConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());

  return response;
}

/**
 * 보안 헤더 적용
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * OPTIONS 요청 처리 (Preflight)
 */
export function handlePreflightRequest(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 });

  return applyCorsHeaders(request, response);
}

/**
 * API Response에 CORS 및 보안 헤더 적용
 */
export function withCorsAndSecurity(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  let result = applyCorsHeaders(request, response);
  result = applySecurityHeaders(result);

  return result;
}

/**
 * Rate Limiting 설정 (향후 확장용)
 */
export interface RateLimitConfig {
  windowMs: number; // 시간 윈도우 (밀리초)
  maxRequests: number; // 최대 요청 수
}

export const rateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15분
  maxRequests: 100, // 15분당 100개 요청
};

/**
 * IP 기반 요청 제한 확인 (간단한 메모리 기반 구현)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = requestCounts.get(ip);

  // 레코드가 없거나 리셋 시간이 지났으면 초기화
  if (!record || now > record.resetTime) {
    const resetTime = now + rateLimitConfig.windowMs;
    requestCounts.set(ip, { count: 1, resetTime });

    return {
      allowed: true,
      remaining: rateLimitConfig.maxRequests - 1,
      resetTime,
    };
  }

  // 요청 수 증가
  record.count += 1;

  // 제한 초과 확인
  if (record.count > rateLimitConfig.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  return {
    allowed: true,
    remaining: rateLimitConfig.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Rate Limit 헤더 적용
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  limit: { remaining: number; resetTime: number }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', rateLimitConfig.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', limit.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(limit.resetTime).toISOString());

  return response;
}
