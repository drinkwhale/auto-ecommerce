/**
 * 주문 상세 API 엔드포인트
 *
 * 개별 주문의 조회 및 상태 업데이트를 담당하는 API
 * - 주문 ID 기반 조회 및 업데이트
 * - 소유자 검증
 * - 인증된 사용자만 접근 가능
 *
 * Phase 3.5: API 엔드포인트 구현 - T040, T041
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * GET /api/v1/orders/[id]
 * 주문 상세 조회
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

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소유자 확인 (Admin은 모든 주문 조회 가능)
    if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('주문 조회 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '주문 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * 주문 상태 업데이트 요청 데이터 검증 스키마
 */
const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    'RECEIVED',
    'CONFIRMED',
    'PURCHASING',
    'PURCHASED',
    'SHIPPING',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
  sourcePurchase: z
    .object({
      purchaseId: z.string().optional(),
      purchaseDate: z.string().optional(),
      purchasePrice: z.number().optional(),
      purchaseStatus: z.enum(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED']).optional(),
      trackingNumber: z.string().optional(),
    })
    .optional(),
  shipping: z
    .object({
      carrier: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippedAt: z.string().optional(),
      deliveredAt: z.string().optional(),
      status: z.enum(['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']).optional(),
    })
    .optional(),
  note: z.string().optional(),
});

/**
 * PATCH /api/v1/orders/[id]
 * 주문 상태 업데이트
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

    // 기존 주문 조회
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (existingOrder.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();

    // 입력 데이터 검증
    const validationResult = UpdateOrderStatusSchema.safeParse(body);
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

    const { status, sourcePurchase, shipping, note } = validationResult.data;

    // 상태 전환 유효성 검사
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      RECEIVED: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PURCHASING', 'CANCELLED'],
      PURCHASING: ['PURCHASED', 'CANCELLED'],
      PURCHASED: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: ['REFUNDED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (
      !validTransitions[existingOrder.status].includes(status) &&
      status !== existingOrder.status
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${existingOrder.status}에서 ${status}(으)로 상태 전환할 수 없습니다.`,
          validTransitions: validTransitions[existingOrder.status],
        },
        { status: 400 }
      );
    }

    // 업데이트 데이터 구성
    const updateData: any = {
      status,
    };

    if (sourcePurchase) {
      updateData.sourcePurchase = {
        ...(existingOrder.sourcePurchase as any),
        ...sourcePurchase,
      };
    }

    if (shipping) {
      updateData.shipping = {
        ...(existingOrder.shipping as any),
        ...shipping,
      };
    }

    // 완료 상태 체크
    if (status === 'DELIVERED' && !existingOrder.completedAt) {
      updateData.completedAt = new Date();
    }

    // 주문 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        product: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 활동 로그 생성
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        entityType: 'ORDER',
        entityId: id,
        action: 'UPDATE',
        description: `주문 상태 변경: ${existingOrder.status} → ${status}`,
        metadata: {
          previousStatus: existingOrder.status,
          newStatus: status,
          note,
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: '주문 상태가 업데이트되었습니다.',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('주문 상태 업데이트 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '주문 상태 업데이트 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}