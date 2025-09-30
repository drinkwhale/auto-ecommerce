/**
 * 주문 목록 API 엔드포인트
 *
 * 주문 목록 조회를 담당하는 API
 * - OrderService를 활용한 비즈니스 로직 연동
 * - 페이지네이션, 필터링, 정렬 지원
 * - 인증된 사용자만 접근 가능
 *
 * Phase 3.5: API 엔드포인트 구현 - T039
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/v1/orders
 * 주문 목록 조회 (페이지네이션, 필터링, 정렬 지원)
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
    const status = searchParams.get('status') as OrderStatus | null;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const userId = searchParams.get('userId') || session.user.id;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
          customer: {
            path: ['name'],
            string_contains: search,
          },
        },
        {
          marketOrder: {
            path: ['orderId'],
            string_contains: search,
          },
        },
      ];
    }

    // 날짜 범위 필터
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 정렬 조건
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // 주문 목록 조회
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: {
              id: true,
              originalData: true,
              translatedData: true,
              status: true,
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
      }),
      prisma.order.count({ where }),
    ]);

    // 응답 데이터 포맷팅
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      productId: order.productId,
      productTitle:
        (order.product.translatedData as any)?.title ||
        (order.product.originalData as any)?.title,
      marketOrder: order.marketOrder,
      sourcePurchase: order.sourcePurchase,
      customer: order.customer,
      shipping: order.shipping,
      payment: order.payment,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt,
    }));

    // 통계 계산
    const statistics = {
      totalOrders: total,
      totalRevenue: orders.reduce(
        (sum, order) => sum + ((order.payment as any)?.netProfit || 0),
        0
      ),
      statusCounts: await prisma.order.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      }),
    };

    return NextResponse.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statistics,
      },
    });
  } catch (error) {
    console.error('주문 목록 조회 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '주문 목록 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}