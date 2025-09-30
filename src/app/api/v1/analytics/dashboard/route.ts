/**
 * 대시보드 통계 API 엔드포인트
 *
 * 대시보드에 표시할 주요 통계 데이터를 제공하는 API
 * - 상품 통계
 * - 주문 통계
 * - 수익 통계
 * - 최근 활동
 *
 * Phase 3.5: API 엔드포인트 구현 - T042
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/v1/analytics/dashboard
 * 대시보드 통계 조회
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
    const period = searchParams.get('period') || '30'; // 기본 30일
    const userId = session.user.id;

    // 기간 계산
    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // 1. 상품 통계
    const productStats = await prisma.product.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const totalProducts = await prisma.product.count({
      where: { userId },
    });

    const recentProducts = await prisma.product.count({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    // 2. 주문 통계
    const orderStats = await prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const totalOrders = await prisma.order.count({
      where: { userId },
    });

    const recentOrders = await prisma.order.count({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    // 3. 수익 통계
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: 'DELIVERED',
      },
      select: {
        payment: true,
        createdAt: true,
      },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + ((order.payment as any)?.netProfit || 0),
      0
    );

    const recentRevenue = orders
      .filter((order) => order.createdAt >= startDate)
      .reduce((sum, order) => sum + ((order.payment as any)?.netProfit || 0), 0);

    // 4. 일별 수익 추이 (최근 30일)
    const dailyRevenue = await prisma.$queryRaw<
      Array<{ date: string; revenue: number; orders: number }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(CAST(payment->>'netProfit' AS DECIMAL)), 0) as revenue
      FROM orders
      WHERE
        user_id = ${userId}
        AND status = 'DELIVERED'
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    // 5. 최근 활동 로그
    const recentActivities = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        entityType: true,
        action: true,
        description: true,
        createdAt: true,
      },
    });

    // 6. 상위 상품 (조회수/주문수 기준)
    const topProducts = await prisma.product.findMany({
      where: { userId },
      orderBy: {
        orders: {
          _count: 'desc',
        },
      },
      take: 5,
      select: {
        id: true,
        originalData: true,
        translatedData: true,
        statistics: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    // 7. 플랫폼별 주문 통계
    const platformStats = await prisma.order.findMany({
      where: { userId },
      select: {
        marketOrder: true,
      },
    });

    const platformCounts = platformStats.reduce((acc: any, order) => {
      const platform = (order.marketOrder as any)?.platform || 'UNKNOWN';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    // 8. 월별 성장률 계산
    const lastMonthStart = new Date();
    lastMonthStart.setDate(lastMonthStart.getDate() - periodDays * 2);
    lastMonthStart.setDate(lastMonthStart.getDate() + periodDays);

    const lastPeriodOrders = await prisma.order.count({
      where: {
        userId,
        createdAt: {
          gte: lastMonthStart,
          lt: startDate,
        },
      },
    });

    const orderGrowth =
      lastPeriodOrders > 0
        ? ((recentOrders - lastPeriodOrders) / lastPeriodOrders) * 100
        : 0;

    // 9. 평균 주문 금액
    const avgOrderValue =
      totalOrders > 0
        ? orders.reduce(
            (sum, order) => sum + ((order.payment as any)?.saleAmount || 0),
            0
          ) / totalOrders
        : 0;

    // 10. 수익률
    const avgProfitRate =
      totalOrders > 0
        ? orders.reduce(
            (sum, order) => sum + ((order.payment as any)?.profitRate || 0),
            0
          ) / totalOrders
        : 0;

    // 응답 데이터 구성
    const dashboard = {
      overview: {
        totalProducts,
        recentProducts,
        totalOrders,
        recentOrders,
        totalRevenue,
        recentRevenue,
        avgOrderValue,
        avgProfitRate,
        orderGrowth,
      },
      productStats: {
        byStatus: productStats.map((stat) => ({
          status: stat.status,
          count: stat._count,
        })),
        total: totalProducts,
      },
      orderStats: {
        byStatus: orderStats.map((stat) => ({
          status: stat.status,
          count: stat._count,
        })),
        total: totalOrders,
      },
      revenueStats: {
        total: totalRevenue,
        recent: recentRevenue,
        daily: dailyRevenue,
      },
      platformStats: Object.entries(platformCounts).map(([platform, count]) => ({
        platform,
        count,
        percentage: ((count as number) / totalOrders) * 100,
      })),
      topProducts: topProducts.map((product) => ({
        id: product.id,
        title:
          (product.translatedData as any)?.title ||
          (product.originalData as any)?.title,
        orderCount: product._count.orders,
        views: (product.statistics as any)?.views || 0,
        revenue: (product.statistics as any)?.revenue || 0,
      })),
      recentActivities,
      period: {
        days: periodDays,
        startDate,
        endDate: new Date(),
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('대시보드 통계 조회 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: '대시보드 통계 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}