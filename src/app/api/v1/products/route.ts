/**
 * 상품 관리 API 엔드포인트
 *
 * 상품 목록 조회 및 생성을 담당하는 API
 * - ProductService를 활용한 비즈니스 로직 연동
 * - 페이지네이션, 필터링, 정렬 지원
 * - 인증된 사용자만 접근 가능
 *
 * Phase 3.5: API 엔드포인트 구현 - T033, T034
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, ProductStatus, SourcePlatform } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * GET /api/v1/products
 * 상품 목록 조회 (페이지네이션, 필터링, 정렬 지원)
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

    // 쿼리 파라미터 파싱
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') as ProductStatus | null;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const userId = searchParams.get('userId') || session.user.id;

    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: any = {
      userId: userId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          originalData: {
            path: ['title'],
            string_contains: search,
          },
        },
        {
          translatedData: {
            path: ['title'],
            string_contains: search,
          },
        },
      ];
    }

    // 정렬 조건
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // 상품 목록 조회
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: {
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
          registrations: {
            select: {
              platform: true,
              status: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // 응답 데이터 포맷팅
    const formattedProducts = products.map((product) => ({
      id: product.id,
      sourceInfo: product.sourceInfo,
      originalData: product.originalData,
      translatedData: product.translatedData,
      salesSettings: product.salesSettings,
      status: product.status,
      statistics: product.statistics,
      mainImage: product.images[0]?.processedImages || null,
      registrations: product.registrations,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('상품 목록 조회 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 목록 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * 상품 생성 요청 데이터 검증 스키마
 */
const CreateProductSchema = z.object({
  sourceInfo: z.object({
    sourceUrl: z.string().url('유효한 URL을 입력해주세요.'),
    sourcePlatform: z.enum(['TAOBAO', 'AMAZON', 'ALIBABA']),
    sourceProductId: z.string().optional(),
  }),
  originalData: z.object({
    title: z.string().min(1, '상품명은 필수입니다.'),
    description: z.string().optional(),
    price: z.number().positive('가격은 양수여야 합니다.'),
    images: z.array(z.string().url()).optional(),
    specifications: z.record(z.any()).optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  salesSettings: z.object({
    marginRate: z.number().min(0).max(100).default(30),
    salePrice: z.number().positive().optional(),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    targetMarkets: z.array(z.string()).default([]),
    autoUpdate: z.boolean().default(true),
  }),
});

/**
 * POST /api/v1/products
 * 새 상품 생성
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
    const validationResult = CreateProductSchema.safeParse(body);
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

    const { sourceInfo, originalData, salesSettings } = validationResult.data;

    // 판매가 계산
    const marginRate = salesSettings.marginRate;
    const calculatedSalePrice =
      salesSettings.salePrice ||
      originalData.price * (1 + marginRate / 100);

    // 상품 생성
    const product = await prisma.product.create({
      data: {
        userId: session.user.id,
        sourceInfo: {
          ...sourceInfo,
          lastCrawledAt: new Date().toISOString(),
        },
        originalData,
        salesSettings: {
          ...salesSettings,
          salePrice: calculatedSalePrice,
        },
        status: 'DRAFT',
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
      include: {
        images: true,
        registrations: true,
      },
    });

    // 활동 로그 생성
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'PRODUCT',
        entityId: product.id,
        action: 'CREATE',
        description: `상품 생성: ${originalData.title}`,
        metadata: {
          sourceUrl: sourceInfo.sourceUrl,
          sourcePlatform: sourceInfo.sourcePlatform,
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: '상품이 생성되었습니다.',
        data: product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('상품 생성 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}