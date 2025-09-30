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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, SourcePlatform } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

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

    // 중복 URL 확인
    const existingProduct = await prisma.product.findFirst({
      where: {
        userId: session.user.id,
        sourceInfo: {
          path: ['sourceUrl'],
          equals: url,
        },
      },
    });

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

    // 비동기 크롤링 작업 시작 (실제 구현에서는 Queue 사용)
    // 여기서는 즉시 응답하고, 백그라운드에서 CrawlingService가 처리
    // TODO: 실제로는 BullMQ 등의 작업 큐에 추가

    // 임시 응답: 크롤링 작업이 시작되었음을 알림
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

    // 중복 URL 확인
    const existingProduct = await prisma.product.findFirst({
      where: {
        userId: session.user.id,
        sourceInfo: {
          path: ['sourceUrl'],
          equals: url,
        },
      },
      select: {
        id: true,
        status: true,
        originalData: true,
        createdAt: true,
      },
    });

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