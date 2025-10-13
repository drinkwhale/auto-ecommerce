/**
 * POST /api/v1/crawling/taobao/search
 *
 * 타오바오 상품 검색 API
 *
 * 로그인된 세션을 사용하여 타오바오에서 상품을 검색합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { taobaoCrawlerService } from '@/services/taobao-crawler.service';
import { z } from 'zod';

// Playwright는 Node.js 런타임이 필요합니다
export const runtime = 'nodejs';

/**
 * 검색 요청 스키마
 */
const SearchRequestSchema = z.object({
  keyword: z.string().min(1, '검색 키워드를 입력해주세요.'),
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(1).max(100).optional().default(44),
  sortBy: z
    .enum(['default', 'price_asc', 'price_desc', 'sales', 'newest'])
    .optional(),
  filters: z
    .object({
      minPrice: z.number().min(0).optional(),
      maxPrice: z.number().min(0).optional(),
      location: z.string().optional(),
      freeShipping: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 요청 검증
    const validatedData = SearchRequestSchema.parse(body);

    console.log(`[API] Searching Taobao products: ${validatedData.keyword}`);

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

    // 상품 검색
    const searchResult = await taobaoCrawlerService.searchProducts(
      validatedData
    );

    if (searchResult.success) {
      return NextResponse.json(
        {
          success: true,
          data: {
            items: searchResult.items,
            pagination: searchResult.pagination,
          },
          metadata: searchResult.metadata,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: searchResult.error?.code || 'SEARCH_FAILED',
            message:
              searchResult.error?.message || '상품 검색에 실패했습니다.',
          },
          metadata: searchResult.metadata,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Taobao search error:', error);

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
