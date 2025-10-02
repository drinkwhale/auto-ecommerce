/**
 * 상품 상세 API 엔드포인트
 *
 * 개별 상품의 조회, 수정, 삭제를 담당하는 API
 * - 상품 ID 기반 CRUD 작업
 * - 소유자 검증
 * - 인증된 사용자만 접근 가능
 *
 * Phase 3.5: API 엔드포인트 구현 - T035, T036, T037
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, ProductStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * GET /api/v1/products/[id]
 * 상품 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { createdAt: 'asc' },
        },
        registrations: {
          include: {
            product: false,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소유자 확인 (Admin은 모든 상품 조회 가능)
    if (
      product.userId !== session.user.id &&
      session.user.role !== 'ADMIN'
    ) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 조회수 증가
    await prisma.product.update({
      where: { id },
      data: {
        statistics: {
          ...(product.statistics as any),
          views: ((product.statistics as any)?.views || 0) + 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('상품 조회 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * 상품 수정 요청 데이터 검증 스키마
 */
const UpdateProductSchema = z.object({
  originalData: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      images: z.array(z.string().url()).optional(),
      specifications: z.record(z.any()).optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  translatedData: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      specifications: z.record(z.any()).optional(),
    })
    .optional(),
  salesSettings: z
    .object({
      marginRate: z.number().min(0).max(100).optional(),
      salePrice: z.number().positive().optional(),
      minPrice: z.number().positive().optional(),
      maxPrice: z.number().positive().optional(),
      targetMarkets: z.array(z.string()).optional(),
      autoUpdate: z.boolean().optional(),
    })
    .optional(),
  monitoring: z
    .object({
      isActive: z.boolean().optional(),
    })
    .optional(),
  status: z
    .enum(['DRAFT', 'PROCESSING', 'READY', 'REGISTERED', 'ERROR', 'ARCHIVED'])
    .optional(),
});

/**
 * PATCH /api/v1/products/[id]
 * 상품 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 기존 상품 조회
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (existingProduct.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = UpdateProductSchema.safeParse(body);
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

    const updateData: any = {};

    // 업데이트할 필드 병합
    if (validationResult.data.originalData) {
      updateData.originalData = {
        ...(existingProduct.originalData as any),
        ...validationResult.data.originalData,
      };
    }

    if (validationResult.data.translatedData) {
      updateData.translatedData = {
        ...(existingProduct.translatedData as any),
        ...validationResult.data.translatedData,
        translatedAt: new Date().toISOString(),
      };
    }

    if (validationResult.data.salesSettings) {
      const newSalesSettings = {
        ...(existingProduct.salesSettings as any),
        ...validationResult.data.salesSettings,
      };

      // 마진율이 변경되었으면 판매가 재계산
      if (validationResult.data.salesSettings.marginRate !== undefined) {
        const originalPrice = (updateData.originalData || existingProduct.originalData as any).price;
        newSalesSettings.salePrice =
          originalPrice * (1 + newSalesSettings.marginRate / 100);
      }

      updateData.salesSettings = newSalesSettings;
    }

    if (validationResult.data.monitoring) {
      updateData.monitoring = {
        ...(existingProduct.monitoring as any),
        ...validationResult.data.monitoring,
        lastCheckedAt: new Date().toISOString(),
      };
    }

    if (validationResult.data.status) {
      updateData.status = validationResult.data.status;
    }

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
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
        entityId: id,
        action: 'UPDATE',
        description: `상품 수정: ${(updatedProduct.originalData as any).title}`,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: '상품이 수정되었습니다.',
      data: updatedProduct,
    });
  } catch (error) {
    console.error('상품 수정 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 수정 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/products/[id]
 * 상품 삭제 (하드 삭제: 완전 삭제)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 기존 상품 조회
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (existingProduct.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 하드 삭제: 실제 데이터 삭제
    await prisma.product.delete({
      where: { id },
    });

    // 활동 로그 생성
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'PRODUCT',
        entityId: id,
        action: 'DELETE',
        description: `상품 삭제: ${(existingProduct.originalData as any).title}`,
        metadata: {
          deleteType: 'HARD',
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: '상품이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('상품 삭제 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '상품 삭제 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}