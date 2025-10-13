/**
 * 상품 크롤링 API 엔드포인트
 *
 * 외부 쇼핑몰 URL로부터 상품 정보를 크롤링하는 API
 * - CrawlingService 연동
 * - 비동기 크롤링 작업
 * - 크롤링 상태 조회
 *
 * Phase 3.5: API 엔드포인트 구현 - T038
 */

// Playwright는 Node.js 런타임이 필요합니다
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SourcePlatform } from '@prisma/client';
import { z } from 'zod';
import { crawlingService } from '@/services/crawling.service';
import { taobaoCrawlerService } from '@/services/taobao-crawler.service';

/**
 * 크롤링 요청 데이터 검증 스키마
 */
const CrawlRequestSchema = z.object({
  url: z.string().url('유효한 URL을 입력해주세요.'),
  platform: z.enum(['TAOBAO', 'AMAZON', 'ALIBABA'], {
    errorMap: () => ({
      message: '지원하는 플랫폼: TAOBAO, AMAZON, ALIBABA',
    }),
  }),
  options: z
    .object({
      includeSimilar: z.boolean().default(false),
      autoTranslate: z.boolean().default(true),
      processImages: z.boolean().default(true),
      marginRate: z.number().min(0).max(100).default(30),
    })
    .optional(),
});

/**
 * POST /api/v1/products/crawl
 * 상품 URL 크롤링 및 자동 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = CrawlRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '입력 데이터가 유효하지 않습니다.',
          details: validationResult.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { url, platform, options } = validationResult.data;

    // 중복 URL 확인 (JSON 필드에서 sourceUrl 검색)
    const allProducts = await prisma.product.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        sourceInfo: true,
      },
    });

    const existingProduct = allProducts.find(
      (p) => (p.sourceInfo as any)?.sourceUrl === url
    );

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 등록된 상품 URL입니다.',
          data: { existingProductId: existingProduct.id },
        },
        { status: 409 }
      );
    }

    // 크롤링 작업 생성 (임시 상품으로 생성)
    const product = await prisma.product.create({
      data: {
        userId: session.user.id,
        sourceInfo: {
          sourceUrl: url,
          sourcePlatform: platform,
          lastCrawledAt: new Date().toISOString(),
        },
        originalData: {
          title: '크롤링 중...',
          description: '',
          price: 0,
          images: [],
        },
        salesSettings: {
          marginRate: options?.marginRate || 30,
          salePrice: 0,
          targetMarkets: [],
          autoUpdate: options?.autoTranslate ?? true,
        },
        status: 'PROCESSING',
        monitoring: {
          isActive: false,
          lastCheckedAt: null,
          priceHistory: [],
          stockStatus: 'IN_STOCK',
          alerts: [],
        },
        statistics: {
          views: 0,
          clicks: 0,
          orders: 0,
          revenue: 0,
          conversionRate: 0,
        },
      },
    });

    // 활동 로그 생성
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'PRODUCT',
        entityId: product.id,
        action: 'CREATE',
        description: `상품 크롤링 시작: ${url}`,
        metadata: {
          url,
          platform,
          options,
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // 크롤링 작업 시작 (비동기 처리)
    // 백그라운드에서 크롤링을 수행하고 상품을 업데이트
    // Note: 실제 프로덕션에서는 Queue(BullMQ 등)를 사용하여 처리해야 함
    (async () => {
      try {
        console.log(`크롤링 시작: ${url} (상품 ID: ${product.id})`);

        let productData: any;
        let originalPrice: number;

        // 플랫폼별 크롤링 로직 분기
        if (platform === 'TAOBAO') {
          // 타오바오: TaobaoCrawlerService 사용 (Playwright 기반)
          console.log(`[Taobao] Checking session for: ${url}`);

          // 세션 상태 확인
          const sessionStatus = await taobaoCrawlerService.getSessionStatus();

          if (sessionStatus.isActive && sessionStatus.isLoggedIn) {
            // 세션이 있으면 실제 크롤링
            console.log(`[Taobao] Using TaobaoCrawlerService (session active)`);

            const taobaoDetail = await taobaoCrawlerService.getProductDetail(url);

            productData = {
              title: taobaoDetail.title,
              description: taobaoDetail.description || '',
              price: {
                amount: taobaoDetail.price.current,
                currency: taobaoDetail.price.currency,
              },
              images: taobaoDetail.images || [],
              specifications: taobaoDetail.specifications || {},
              category: taobaoDetail.category,
              seller: taobaoDetail.seller,
              sales: taobaoDetail.sales,
              tags: taobaoDetail.tags || ['taobao'],
            };
            originalPrice = taobaoDetail.price.current;
          } else {
            // 세션이 없으면 Mock 데이터 사용 (임시)
            console.log(`[Taobao] No session found, using CrawlingService mock data`);
            console.log(`[Taobao] To use real crawling, visit: /api/v1/crawling/taobao/login`);

            const crawlResult = await crawlingService.crawlUrl({
              sourceUrl: url,
              sourcePlatform: platform,
              userId: session.user.id,
            });

            if (!crawlResult.success || !crawlResult.data) {
              throw new Error(
                crawlResult.error?.message || '크롤링에 실패했습니다.'
              );
            }

            productData = crawlResult.data;
            originalPrice = productData.price.amount;
          }
        } else {
          // 다른 플랫폼: 기존 CrawlingService 사용 (Mock 데이터)
          const crawlResult = await crawlingService.crawlUrl({
            sourceUrl: url,
            sourcePlatform: platform,
            userId: session.user.id,
          });

          if (!crawlResult.success || !crawlResult.data) {
            throw new Error(
              crawlResult.error?.message || '크롤링에 실패했습니다.'
            );
          }

          productData = crawlResult.data;
          originalPrice = productData.price.amount;
        }

        // 가격 계산
        const marginRate = options?.marginRate || 30;
        const salePrice = originalPrice * (1 + marginRate / 100);

        // 상품 데이터 업데이트
        await prisma.product.update({
          where: { id: product.id },
          data: {
            sourceInfo: {
              sourceUrl: url,
              sourcePlatform: platform,
              sourceProductId: extractProductId(url, platform),
              lastCrawledAt: new Date().toISOString(),
            },
            originalData: {
              title: productData.title,
              description: productData.description || '',
              price: originalPrice,
              currency: productData.price.currency,
              images: productData.images || [],
              specifications: productData.specifications || {},
              category: productData.category,
              brand: productData.brand,
              model: productData.model,
              tags: productData.tags || [],
              seller: productData.seller,
              sales: productData.sales,
            },
            salesSettings: {
              marginRate: marginRate,
              salePrice: salePrice,
              minPrice: originalPrice * 0.9,
              maxPrice: originalPrice * 2.0,
              targetMarkets: [],
              autoUpdate: options?.autoTranslate ?? true,
            },
            status: 'READY', // 크롤링 완료 후 READY 상태로 변경
          },
        });

        console.log(`크롤링 완료: ${product.id} - ${productData.title}`);
      } catch (error) {
        console.error(`크롤링 중 예외 발생: ${product.id}`, error);

        // 오류 발생 시 ERROR 상태로 변경
        await prisma.product.update({
          where: { id: product.id },
          data: {
            status: 'ERROR',
            originalData: {
              title: '크롤링 실패',
              description: `오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
              price: 0,
              images: [],
            },
          },
        });
      }
    })();

    // 즉시 응답: 크롤링 작업이 시작되었음을 알림
    return NextResponse.json(
      {
        success: true,
        message: '크롤링 작업이 시작되었습니다.',
        data: {
          productId: product.id,
          status: 'PROCESSING',
          estimatedTime: '1-3분',
        },
      },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
    console.error('상품 크롤링 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 크롤링 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * URL에서 상품 ID 추출 헬퍼 함수
 */
function extractProductId(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    switch (platform) {
      case 'TAOBAO':
        return searchParams.get('id') || pathname.split('/').pop() || 'unknown';
      case 'AMAZON':
        const match = pathname.match(/\/dp\/([A-Z0-9]+)/);
        return match ? match[1] : 'unknown';
      case 'ALIBABA':
        return pathname.split('/').pop() || 'unknown';
      default:
        return pathname.split('/').pop() || 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/**
 * GET /api/v1/products/crawl?url={url}
 * 크롤링 가능 여부 및 미리보기
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL 파라미터가 필요합니다.',
        },
        { status: 400 }
      );
    }

    // URL 형식 검증
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: '유효한 URL이 아닙니다.',
        },
        { status: 400 }
      );
    }

    // 플랫폼 감지
    let platform: SourcePlatform | null = null;
    const urlLower = url.toLowerCase();

    if (urlLower.includes('taobao.com') || urlLower.includes('tmall.com')) {
      platform = 'TAOBAO';
    } else if (urlLower.includes('amazon.')) {
      platform = 'AMAZON';
    } else if (urlLower.includes('alibaba.com') || urlLower.includes('1688.com')) {
      platform = 'ALIBABA';
    }

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          error: '지원하지 않는 플랫폼입니다.',
          supportedPlatforms: ['Taobao', 'Tmall', 'Amazon', 'Alibaba', '1688'],
        },
        { status: 400 }
      );
    }

    // 중복 URL 확인 (JSON 필드에서 sourceUrl 검색)
    const allUserProducts = await prisma.product.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        status: true,
        sourceInfo: true,
        originalData: true,
        createdAt: true,
      },
    });

    const existingProduct = allUserProducts.find(
      (p) => (p.sourceInfo as any)?.sourceUrl === url
    );

    return NextResponse.json({
      success: true,
      data: {
        url,
        platform,
        isSupported: true,
        isDuplicate: !!existingProduct,
        existingProduct: existingProduct
          ? {
              id: existingProduct.id,
              status: existingProduct.status,
              title: (existingProduct.originalData as any)?.title,
              createdAt: existingProduct.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('크롤링 가능 여부 확인 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '크롤링 가능 여부 확인 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}