/**
 * 대시보드 페이지
 *
 * 주요 통계 및 최근 활동을 한눈에 볼 수 있는 대시보드
 * - 상품/주문/수익 통계 카드
 * - 수익 추이 그래프
 * - 플랫폼별 주문 분포
 * - 상위 상품 목록
 * - 최근 활동 로그
 *
 * Phase 3.7: 페이지 구현 - T052
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 타입 정의
interface DashboardOverview {
  totalProducts: number;
  recentProducts: number;
  totalOrders: number;
  recentOrders: number;
  totalRevenue: number;
  recentRevenue: number;
  avgOrderValue: number;
  avgProfitRate: number;
  orderGrowth: number;
}

interface ProductStat {
  status: string;
  count: number;
}

interface OrderStat {
  status: string;
  count: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface PlatformStat {
  platform: string;
  count: number;
  percentage: number;
}

interface TopProduct {
  id: string;
  title: string;
  orderCount: number;
  views: number;
  revenue: number;
}

interface Activity {
  id: string;
  entityType: string;
  action: string;
  description: string;
  createdAt: Date;
}

interface DashboardData {
  overview: DashboardOverview;
  productStats: {
    byStatus: ProductStat[];
    total: number;
  };
  orderStats: {
    byStatus: OrderStat[];
    total: number;
  };
  revenueStats: {
    total: number;
    recent: number;
    daily: DailyRevenue[];
  };
  platformStats: PlatformStat[];
  topProducts: TopProduct[];
  recentActivities: Activity[];
  period: {
    days: number;
    startDate: Date;
    endDate: Date;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30'); // 기본 30일

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 대시보드 데이터 로딩
  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status, period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/analytics/dashboard?period=${period}`);
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 숫자 포맷팅
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(Math.round(num));
  };

  const formatPercent = (num: number) => {
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  // 상태별 한글 변환
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: '임시저장',
      PROCESSING: '처리중',
      READY: '등록대기',
      REGISTERED: '등록완료',
      ERROR: '오류',
      ARCHIVED: '보관',
      RECEIVED: '주문접수',
      SOURCING: '소싱중',
      SOURCED: '소싱완료',
      SHIPPING: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소',
      REFUNDED: '환불',
      FAILED: '실패',
    };
    return labels[status] || status;
  };

  // 활동 타입별 아이콘
  const getActivityIcon = (entityType: string) => {
    const icons: Record<string, string> = {
      product: '📦',
      order: '🛒',
      user: '👤',
      payment: '💰',
    };
    return icons[entityType.toLowerCase()] || '📄';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-800">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { overview, productStats, orderStats, platformStats, topProducts, recentActivities } =
    dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-2 text-gray-600">
            환영합니다, {session?.user?.name || session?.user?.email}님!
          </p>

          {/* 기간 선택 */}
          <div className="mt-4 flex gap-2">
            {['7', '30', '90'].map((days) => (
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

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 상품 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 상품</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(overview.totalProducts)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  최근 {formatNumber(overview.recentProducts)}개 추가
                </p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          {/* 주문 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 주문</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatNumber(overview.totalOrders)}
                </p>
                <p className={`text-xs mt-1 ${overview.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(overview.orderGrowth)} 전월 대비
                </p>
              </div>
              <div className="text-4xl">🛒</div>
            </div>
          </div>

          {/* 수익 통계 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 수익</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(overview.totalRevenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  최근 {formatCurrency(overview.recentRevenue)}
                </p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          {/* 평균 주문액 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">평균 주문액</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(overview.avgOrderValue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  수익률 {formatPercent(overview.avgProfitRate)}
                </p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 상품 상태별 분포 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 상태별 분포</h2>
            <div className="space-y-3">
              {productStats.byStatus.map((stat) => (
                <div key={stat.status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getStatusLabel(stat.status)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(stat.count / productStats.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {formatNumber(stat.count)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 주문 상태별 분포 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 상태별 분포</h2>
            <div className="space-y-3">
              {orderStats.byStatus.map((stat) => (
                <div key={stat.status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{getStatusLabel(stat.status)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${(stat.count / orderStats.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {formatNumber(stat.count)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 플랫폼별 주문 분포 */}
        {platformStats.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">플랫폼별 주문 분포</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {platformStats.map((stat) => (
                <div key={stat.platform} className="border rounded-lg p-4">
                  <p className="text-sm text-gray-600">{stat.platform}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatNumber(stat.count)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stat.percentage.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 상위 상품 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">인기 상품 Top 5</h2>
            {topProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">아직 상품이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition"
                  >
                    <span className="text-lg font-bold text-gray-400 w-6">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        주문 {formatNumber(product.orderCount)}건 · 조회{' '}
                        {formatNumber(product.views)}회
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {formatCurrency(product.revenue)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 최근 활동 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 활동</h2>
            {recentActivities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">활동 내역이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <span className="text-2xl">{getActivityIcon(activity.entityType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/products/new"
            className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg p-4 hover:bg-blue-700 transition"
          >
            <span className="text-2xl">➕</span>
            <span className="font-medium">상품 등록</span>
          </Link>
          <Link
            href="/products/crawl"
            className="flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg p-4 hover:bg-green-700 transition"
          >
            <span className="text-2xl">🔍</span>
            <span className="font-medium">상품 크롤링</span>
          </Link>
          <Link
            href="/orders"
            className="flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg p-4 hover:bg-purple-700 transition"
          >
            <span className="text-2xl">📋</span>
            <span className="font-medium">주문 관리</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
