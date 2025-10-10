/**
 * GET /api/v1/crawling/taobao/session
 *
 * 타오바오 세션 상태 확인 API
 *
 * 현재 저장된 세션의 유효성과 로그인 상태를 확인합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { taobaoCrawlerService } from '@/services/taobao-crawler.service';

/**
 * GET 핸들러 - 세션 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Checking Taobao session status...');

    const sessionStatus = await taobaoCrawlerService.getSessionStatus();

    return NextResponse.json(
      {
        success: true,
        data: {
          isActive: sessionStatus.isActive,
          isLoggedIn: sessionStatus.isLoggedIn,
          lastUpdated: sessionStatus.lastUpdated,
          expiresAt: sessionStatus.expiresAt,
          username: sessionStatus.username,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Session status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_CHECK_ERROR',
          message:
            error instanceof Error ? error.message : '세션 상태 확인에 실패했습니다.',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE 핸들러 - 세션 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('[API] Clearing Taobao session...');

    await taobaoCrawlerService.clearSession();

    return NextResponse.json(
      {
        success: true,
        message: '세션이 삭제되었습니다.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Session clear error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_CLEAR_ERROR',
          message:
            error instanceof Error ? error.message : '세션 삭제에 실패했습니다.',
        },
      },
      { status: 500 }
    );
  }
}
