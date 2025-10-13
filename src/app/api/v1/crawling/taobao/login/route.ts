/**
 * POST /api/v1/crawling/taobao/login
 *
 * 타오바오 로그인 세션 생성 API
 *
 * 브라우저를 열어서 사용자가 수동으로 로그인할 수 있도록 하고,
 * 로그인 완료 후 세션을 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { taobaoCrawlerService } from '@/services/taobao-crawler.service';
import { z } from 'zod';

// Playwright는 Node.js 런타임이 필요합니다
export const runtime = 'nodejs';

/**
 * 로그인 요청 스키마
 */
const LoginRequestSchema = z.object({
  waitForLogin: z.number().min(30).max(300).optional().default(120),
});

/**
 * GET 핸들러 - 브라우저에서 직접 접속 시 자동으로 로그인 세션 생성
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Starting Taobao login session (GET request, default 120s wait)...');

    // 기본 대기 시간 120초
    const result = await taobaoCrawlerService.createLoginSession(120);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result.session,
          message: result.message,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error?.code || 'LOGIN_FAILED',
            message: result.error?.message || result.message,
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Taobao login error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST 핸들러 - 대기 시간을 커스터마이즈 가능
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 요청 검증
    const validatedData = LoginRequestSchema.parse(body);

    console.log(
      `[API] Starting Taobao login session (wait: ${validatedData.waitForLogin}s)...`
    );

    // 로그인 세션 생성
    const result = await taobaoCrawlerService.createLoginSession(
      validatedData.waitForLogin
    );

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          data: result.session,
          message: result.message,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error?.code || 'LOGIN_FAILED',
            message: result.error?.message || result.message,
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Taobao login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력 데이터가 유효하지 않습니다.',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    );
  }
}
