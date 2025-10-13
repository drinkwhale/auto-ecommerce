/**
 * POST /api/v1/crawling/taobao/product
 *
 * 타오바오 상품 상세 정보 크롤링 API
 *
 * 로그인된 세션을 사용하여 특정 타오바오 상품의 상세 정보를 크롤링합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { taobaoCrawlerService } from '@/services/taobao-crawler.service';
import { z } from 'zod';

// Playwright는 Node.js 런타임이 필요합니다
export const runtime = 'nodejs';

/**
 * 상품 상세 요청 스키마
 */
const ProductDetailRequestSchema = z.object({
  productUrl: z.string().url('유효한 타오바오 상품 URL을 입력해주세요.'),
});

/**
 * POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 요청 검증
    const validatedData = ProductDetailRequestSchema.parse(body);

    console.log(
      `[API] Fetching Taobao product detail: ${validatedData.productUrl}`
    );

    // 세션 상태 확인
    const sessionStatus = await taobaoCrawlerService.getSessionStatus();
    if (!sessionStatus.isActive || !sessionStatus.isLoggedIn) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_REQUIRED',
            message:
              '로그인 세션이 필요합니다. /api/v1/crawling/taobao/login을 먼저 호출해주세요.',
          },
        },
        { status: 401 }
      );
    }

    // 상품 상세 정보 크롤링
    const productDetail = await taobaoCrawlerService.getProductDetail(
      validatedData.productUrl
    );

    return NextResponse.json(
      {
        success: true,
        data: productDetail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Taobao product detail error:', error);

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
            error instanceof Error
              ? error.message
              : '알 수 없는 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    );
  }
}
