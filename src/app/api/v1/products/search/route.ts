/**
 * 상품 검색 API
 *
 * POST /api/v1/products/search
 *
 * 소스 플랫폼에서 상품을 검색합니다.
 * - 한국어 검색어 자동 번역 (플랫폼 언어에 맞게)
 * - 판매량 순 정렬 지원
 * - 페이지네이션 지원
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { crawlingService } from '@/services/crawling.service';
import { translationService } from '@/services/translation.service';
import { SourcePlatform } from '@prisma/client';
import { z } from 'zod';

/**
 * 검색 요청 스키마
 */
const SearchRequestSchema = z.object({
  query: z.string().min(1, '검색어를 입력해주세요'),
  platform: z.nativeEnum(SourcePlatform),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  sortBy: z.enum(['relevance', 'sales', 'price_asc', 'price_desc']).optional().default('sales'),
  autoTranslate: z.boolean().optional().default(true), // 한국어 자동 번역 여부
});

/**
 * POST /api/v1/products/search
 * 상품 검색
 */
export async function POST(req: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // 요청 바디 파싱
    const body = await req.json();

    // 입력 검증
    const validatedInput = SearchRequestSchema.parse(body);

    let searchQuery = validatedInput.query;

    // 한국어 자동 번역 (한국어 검색어 → 플랫폼 언어)
    if (validatedInput.autoTranslate) {
      const koreanRegex = /[가-힣]/;
      if (koreanRegex.test(validatedInput.query)) {
        try {
          searchQuery = await translationService.translateForPlatform(
            validatedInput.query,
            validatedInput.platform
          );
          console.log(`번역 완료: "${validatedInput.query}" → "${searchQuery}"`);
        } catch (error) {
          console.error('번역 실패, 원본 검색어 사용:', error);
          // 번역 실패 시 원본 검색어 사용
        }
      }
    }

    // 상품 검색
    const searchResults = await crawlingService.searchProducts({
      query: searchQuery,
      platform: validatedInput.platform,
      page: validatedInput.page,
      limit: validatedInput.limit,
      sortBy: validatedInput.sortBy,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...searchResults,
        originalQuery: validatedInput.query,
        translatedQuery: searchQuery !== validatedInput.query ? searchQuery : undefined,
      },
    });
  } catch (error) {
    console.error('상품 검색 오류:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '입력 데이터가 올바르지 않습니다',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '상품 검색 중 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}
