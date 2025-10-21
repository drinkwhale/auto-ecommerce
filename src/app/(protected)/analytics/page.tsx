/**
 * 통계 페이지
 *
 * 상세한 분석 및 리포트 제공
 * - 기간별 매출/수익 차트
 * - 플랫폼별 성과 분석
 * - 상품별 성과 순위
 * - 주문 추이 분석
 * - 수익성 지표
 *
 * Phase 3.7: 페이지 구현 - T056
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clientLogger } from '@/lib/client-logger';

interface AnalyticsData {
  period: {
    start: string;
    end: string;
    days: number;
  };
  revenue: {
    total: number;
    trend: number;
    byPlatform: Array<{
      platform: string;
      amount: number;
      percentage: number;
    }>;
    daily: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
  };
  orders: {
    total: number;
    trend: number;
    byStatus: Array<{
      status: string;
      count: number;
      percentage: number;
    }>;
  };
  products: {
    total: number;
    topPerforming: Array<{
      id: string;
      title: string;
      revenue: number;
      orders: number;
      profitRate: number;
    }>;
  };
  profitability: {
    avgMargin: number;
    avgProfitRate: number;
    totalProfit: number;
  };
}

export default function AnalyticsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 대시보드 API를 재사용하여 분석 데이터 가져오기
      const response = await fetch(`/api/v1/analytics/dashboard?period=${period}`);
      const result = await response.json();

      if (result.success) {
        // 데이터 변환
        const dashboard = result.data;
        const analyticsData: AnalyticsData = {
          period: {
            start: dashboard.period.startDate,
            end: dashboard.period.endDate,
            days: dashboard.period.days,
          },
          revenue: {
            total: dashboard.overview.recentRevenue,
            trend: dashboard.overview.orderGrowth,
            byPlatform: dashboard.platformStats,
            daily: dashboard.revenueStats.daily,
          },
          orders: {
            total: dashboard.overview.recentOrders,
            trend: dashboard.overview.orderGrowth,
            byStatus: dashboard.orderStats.byStatus,
          },
          products: {
            total: dashboard.overview.totalProducts,
            topPerforming: dashboard.topProducts,
          },
          profitability: {
            avgMargin: dashboard.overview.avgOrderValue - (dashboard.overview.avgOrderValue / (1 + dashboard.overview.avgProfitRate / 100)),
            avgProfitRate: dashboard.overview.avgProfitRate,
            totalProfit: dashboard.overview.recentRevenue,
          },
        };

        setData(analyticsData);
      } else {
        setError(result.error || '통계를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('통계 데이터를 불러오는 중 오류가 발생했습니다.');
      clientLogger.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status, fetchAnalytics]);

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(Math.round(num));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const formatPercent = (num: number) => {
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">통계 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-800">{error || '통계를 불러올 수 없습니다.'}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">통계 및 분석</h1>
          <p className="mt-2 text-gray-600">
            비즈니스 성과를 한눈에 확인하세요.
          </p>

          {/* 기간 선택 */}
          <div className="mt-4 flex gap-2">
            {['7', '30', '90', '365'].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-4 py-2 rounded ${
                  period === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                최근 {days}일
              </button>
            ))}
          </div>
        </div>

        {/* 매출 개요 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">매출 개요</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">총 매출</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.revenue.total)}
              </p>
              <p className={`text-sm mt-2 ${data.revenue.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.revenue.trend)} 전월 대비
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">평균 수익률</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {data.profitability.avgProfitRate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-2">
                순이익: {formatCurrency(data.profitability.totalProfit)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">주문 수</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {formatNumber(data.orders.total)}
              </p>
              <p className={`text-sm mt-2 ${data.orders.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(data.orders.trend)} 전월 대비
              </p>
            </div>
          </div>
        </div>

        {/* 플랫폼별 매출 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">플랫폼별 매출</h2>
          <div className="bg-white rounded-lg shadow p-6">
            {data.revenue.byPlatform.length > 0 ? (
              <div className="space-y-4">
                {data.revenue.byPlatform.map((platform) => (
                  <div key={platform.platform}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {platform.platform}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(platform.amount)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({platform.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${platform.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 일별 매출 추이 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">일별 매출 추이</h2>
          <div className="bg-white rounded-lg shadow p-6">
            {data.revenue.daily.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {data.revenue.daily.map((day) => {
                    const maxRevenue = Math.max(...data.revenue.daily.map(d => d.revenue));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 200 : 0;

                    return (
                      <div key={day.date} className="flex flex-col items-center">
                        <div className="h-52 flex items-end">
                          <div
                            className="w-8 bg-blue-600 rounded-t"
                            style={{ height: `${height}px` }}
                            title={`${formatCurrency(day.revenue)}`}
                          ></div>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 text-center">
                          {new Date(day.date).toLocaleDateString('ko-KR', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {day.orders}건
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 주문 상태 분포 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">주문 상태 분포</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.orders.byStatus.map((status) => (
                <div key={status.status} className="border rounded-lg p-4">
                  <p className="text-sm text-gray-600">{status.status}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(status.count)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {status.percentage.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 상위 상품 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">인기 상품 Top 10</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {data.products.topPerforming.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      순위
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상품명
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      주문 수
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      매출액
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      수익률
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.products.topPerforming.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/products/${product.id}`}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {product.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(product.orders)}건
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium text-right">
                        {product.profitRate ? product.profitRate.toFixed(1) : '0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-center py-8">데이터가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg p-4 hover:bg-blue-700 transition"
          >
            <span className="text-2xl">📊</span>
            <span className="font-medium">대시보드</span>
          </Link>
          <Link
            href="/orders"
            className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg p-4 hover:bg-green-700 transition"
          >
            <span className="text-2xl">📋</span>
            <span className="font-medium">주문 관리</span>
          </Link>
          <Link
            href="/products"
            className="flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg p-4 hover:bg-purple-700 transition"
          >
            <span className="text-2xl">📦</span>
            <span className="font-medium">상품 관리</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
