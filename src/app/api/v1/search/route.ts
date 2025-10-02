/**
 * 상품 검색 API 엔드포인트
 *
 * 소스 플랫폼별 상품 검색 기능
 * - 한글 검색어 자동 번역
 * - 플랫폼별 크롤링
 * - 판매량/리뷰수 정렬
 *
 * Phase 3.x: 상품 검색 기능 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { translationService, LanguageCode, TranslationEngine } from '@/services/translation.service';
import { SourcePlatform } from '@prisma/client';

/**
 * 검색 요청 스키마
 */
const SearchRequestSchema = z.object({
  query: z.string().min(1, '검색어를 입력해주세요'),
  platform: z.nativeEnum(SourcePlatform),
  sortBy: z.enum(['relevance', 'sales', 'reviews', 'price']).optional().default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(30),
});

/**
 * 검색 결과 아이템 타입
 */
interface SearchResultItem {
  id: string;
  title: string;
  imageUrl: string;
  price: {
    amount: number;
    currency: string;
  };
  salesCount?: number;
  reviewCount?: number;
  rating?: number;
  sourceUrl: string;
}

/**
 * GET /api/v1/search - 상품 검색
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: '로그인이 필요합니다', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const queryParam = searchParams.get('query');
    const platformParam = searchParams.get('platform');
    const sortByParam = searchParams.get('sortBy') || 'relevance';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    const pageParam = parseInt(searchParams.get('page') || '1');
    const limitParam = parseInt(searchParams.get('limit') || '30');

    // 입력 검증
    const validatedInput = SearchRequestSchema.parse({
      query: queryParam,
      platform: platformParam,
      sortBy: sortByParam,
      sortOrder: sortOrderParam,
      page: pageParam,
      limit: limitParam,
    });

    // 검색어 번역 (한글 → 플랫폼 언어)
    const translatedQuery = await translateQuery(
      validatedInput.query,
      validatedInput.platform
    );

    // 플랫폼별 상품 검색
    const searchResults = await searchProductsByPlatform(
      translatedQuery,
      validatedInput.platform,
      validatedInput.sortBy,
      validatedInput.sortOrder,
      validatedInput.page,
      validatedInput.limit
    );

    return NextResponse.json({
      success: true,
      data: {
        query: validatedInput.query,
        translatedQuery,
        platform: validatedInput.platform,
        total: searchResults.total,
        page: validatedInput.page,
        limit: validatedInput.limit,
        items: searchResults.items,
      },
    });
  } catch (error) {
    console.error('상품 검색 오류:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.errors[0].message,
            code: 'VALIDATION_ERROR',
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
          message: error instanceof Error ? error.message : '상품 검색에 실패했습니다',
          code: 'INTERNAL_ERROR',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * 검색어 번역 (한글 → 플랫폼 언어)
 */
async function translateQuery(query: string, platform: SourcePlatform): Promise<string> {
  // 한글 검색어인지 확인
  const isKorean = /[가-힣]/.test(query);

  if (!isKorean) {
    return query; // 이미 영어/중국어 등이면 그대로 반환
  }

  // 플랫폼별 대상 언어 결정
  const targetLang = getTargetLanguage(platform);

  // 번역 실행
  const translateResult = await translationService.translate({
    text: query,
    sourceLang: LanguageCode.KO,
    targetLang,
    engine: TranslationEngine.GOOGLE,
    options: {
      useCache: true,
      useDictionary: true,
    },
  });

  return translateResult.translatedText;
}

/**
 * 플랫폼별 대상 언어 반환
 */
function getTargetLanguage(platform: SourcePlatform): LanguageCode {
  const languageMap: Record<SourcePlatform, LanguageCode> = {
    [SourcePlatform.TAOBAO]: LanguageCode.ZH,
    [SourcePlatform.ALIBABA]: LanguageCode.ZH,
    [SourcePlatform.AMAZON]: LanguageCode.EN,
    [SourcePlatform.COUPANG]: LanguageCode.KO,
    [SourcePlatform.GMARKET]: LanguageCode.KO,
    [SourcePlatform.STREET11]: LanguageCode.KO,
    [SourcePlatform.OTHER]: LanguageCode.EN,
  };

  return languageMap[platform];
}

/**
 * 플랫폼별 상품 검색 (시뮬레이션)
 *
 * 실제 구현에서는 각 플랫폼의 검색 API를 호출하거나
 * 크롤링 서비스를 사용하여 실제 상품 데이터를 가져와야 합니다.
 */
async function searchProductsByPlatform(
  query: string,
  platform: SourcePlatform,
  sortBy: string,
  sortOrder: string,
  page: number,
  limit: number
): Promise<{ total: number; items: SearchResultItem[] }> {
  // 더미 데이터 생성 (개발 환경)
  // TODO: 실제 플랫폼 API 연동 또는 크롤링 구현
  const dummyItems: SearchResultItem[] = Array.from({ length: limit }, (_, i) => {
    const index = (page - 1) * limit + i + 1;
    return {
      id: `${platform}-${index}`,
      title: `${query} - 상품 ${index} (${platform})`,
      imageUrl: `https://via.placeholder.com/300x300?text=Product+${index}`,
      price: {
        amount: Math.floor(Math.random() * 100000) + 10000,
        currency: getCurrency(platform),
      },
      salesCount: Math.floor(Math.random() * 10000),
      reviewCount: Math.floor(Math.random() * 5000),
      rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0 ~ 5.0
      sourceUrl: `https://example.com/${platform.toLowerCase()}/product/${index}`,
    };
  });

  // 정렬 적용
  const sortedItems = sortSearchResults(dummyItems, sortBy, sortOrder);

  return {
    total: 1000, // 더미 전체 개수
    items: sortedItems,
  };
}

/**
 * 검색 결과 정렬
 */
function sortSearchResults(
  items: SearchResultItem[],
  sortBy: string,
  sortOrder: string
): SearchResultItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'sales':
        compareValue = (a.salesCount || 0) - (b.salesCount || 0);
        break;
      case 'reviews':
        compareValue = (a.reviewCount || 0) - (b.reviewCount || 0);
        break;
      case 'price':
        compareValue = a.price.amount - b.price.amount;
        break;
      case 'relevance':
      default:
        compareValue = 0; // 관련도는 이미 정렬된 상태로 가정
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  return sorted;
}

/**
 * 플랫폼별 통화 반환
 */
function getCurrency(platform: SourcePlatform): string {
  const currencyMap: Record<SourcePlatform, string> = {
    [SourcePlatform.TAOBAO]: 'CNY',
    [SourcePlatform.ALIBABA]: 'USD',
    [SourcePlatform.AMAZON]: 'USD',
    [SourcePlatform.COUPANG]: 'KRW',
    [SourcePlatform.GMARKET]: 'KRW',
    [SourcePlatform.STREET11]: 'KRW',
    [SourcePlatform.OTHER]: 'USD',
  };

  return currencyMap[platform];
}
