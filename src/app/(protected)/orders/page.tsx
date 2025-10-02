/**
 * 주문 관리 페이지
 *
 * 주문 목록 조회, 검색, 필터링 기능 제공
 * - 주문 목록 표시 (OrderList 컴포넌트)
 * - 검색 기능 (주문 ID, 고객명, 상품명)
 * - 필터링 (상태, 플랫폼)
 * - 정렬 (최신순, 금액순)
 * - 페이지네이션
 *
 * Phase 3.7: 페이지 구현 - T055
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OrderList } from '@/components/order/OrderList';

interface Order {
  id: string;
  productId: string;
  productTitle: string;
  marketOrder: {
    platform: string;
    orderId: string;
    quantity: number;
    totalPrice: number;
  };
  customer: {
    name: string;
    phone: string;
  };
  payment: {
    saleAmount: number;
    netProfit: number;
    profitRate: number;
  };
  status: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 및 검색 상태
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [platformFilter, setPlatformFilter] = useState(searchParams.get('platform') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 주문 목록 로딩
  useEffect(() => {
    if (status === 'authenticated') {
      fetchOrders();
    }
  }, [status, searchQuery, statusFilter, platformFilter, sortBy, sortOrder, pagination.page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { q: searchQuery }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(platformFilter !== 'all' && { platform: platformFilter }),
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/v1/orders?${params}`);
      const result = await response.json();

      if (result.success) {
        setOrders(result.data.orders);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || '주문을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('주문 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchOrders();
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(Math.round(num));
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      RECEIVED: '주문접수',
      CONFIRMED: '주문확인',
      PURCHASING: '원본구매중',
      PURCHASED: '원본구매완료',
      SHIPPING: '배송중',
      DELIVERED: '배송완료',
      CANCELLED: '취소',
      REFUNDED: '환불',
    };
    return labels[status] || status;
  };

  // 통계 계산
  const stats = orders.reduce(
    (acc, order) => {
      acc.totalAmount += order.payment.saleAmount;
      acc.totalProfit += order.payment.netProfit;
      if (order.status === 'DELIVERED') {
        acc.deliveredCount += 1;
      }
      return acc;
    },
    { totalAmount: 0, totalProfit: 0, deliveredCount: 0 }
  );

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">주문 관리</h1>
              <p className="mt-2 text-gray-600">
                총 {formatNumber(pagination.total)}개의 주문이 있습니다.
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <span className="mr-2">🔄</span>
              새로고침
            </button>
          </div>

          {/* 요약 통계 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">전체 주문</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatNumber(pagination.total)}건
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">배송 완료</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatNumber(stats.deliveredCount)}건
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">총 판매액</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(stats.totalAmount)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">총 수익</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats.totalProfit)}
              </p>
            </div>
          </div>

          {/* 검색 및 필터 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* 검색 */}
            <form onSubmit={handleSearch} className="md:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="주문 ID, 고객명, 상품명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <button
                  type="submit"
                  className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  검색
                </button>
              </div>
            </form>

            {/* 상태 필터 */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체 상태</option>
                <option value="RECEIVED">주문접수</option>
                <option value="CONFIRMED">주문확인</option>
                <option value="PURCHASING">원본구매중</option>
                <option value="PURCHASED">원본구매완료</option>
                <option value="SHIPPING">배송중</option>
                <option value="DELIVERED">배송완료</option>
                <option value="CANCELLED">취소</option>
                <option value="REFUNDED">환불</option>
              </select>
            </div>

            {/* 플랫폼 필터 */}
            <div>
              <select
                value={platformFilter}
                onChange={(e) => {
                  setPlatformFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체 플랫폼</option>
                <option value="COUPANG">쿠팡</option>
                <option value="GMARKET">지마켓</option>
                <option value="ELEVEN_STREET">11번가</option>
              </select>
            </div>

            {/* 정렬 */}
            <div>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="createdAt-desc">최신순</option>
                <option value="createdAt-asc">오래된순</option>
                <option value="payment.saleAmount-desc">판매액 높은순</option>
                <option value="payment.saleAmount-asc">판매액 낮은순</option>
                <option value="payment.netProfit-desc">수익 높은순</option>
                <option value="payment.netProfit-asc">수익 낮은순</option>
              </select>
            </div>
          </div>

          {/* 검색 결과 요약 */}
          {(searchQuery || statusFilter !== 'all' || platformFilter !== 'all') && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">필터:</span>
              {searchQuery && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  검색: "{searchQuery}"
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  상태: {getStatusLabel(statusFilter)}
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="ml-2 text-green-600 hover:text-green-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              {platformFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  플랫폼: {platformFilter}
                  <button
                    onClick={() => {
                      setPlatformFilter('all');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="ml-2 text-purple-600 hover:text-purple-800"
                  >
                    ✕
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPlatformFilter('all');
                  setSortBy('createdAt');
                  setSortOrder('desc');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                모든 필터 제거
              </button>
            </div>
          )}
        </div>

        {/* 주문 목록 */}
        {error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-red-600 text-xl mb-4">⚠️</div>
            <p className="text-gray-800">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <OrderList
            orders={orders}
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              onPageChange: handlePageChange,
            }}
            onRefresh={fetchOrders}
            loading={loading}
          />
        )}

        {/* 빈 상태 */}
        {!loading && orders.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
                ? '검색 결과가 없습니다'
                : '아직 주문이 없습니다'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
                ? '다른 검색어나 필터를 사용해보세요.'
                : '주문이 들어오면 이곳에 표시됩니다.'}
            </p>
            {!(searchQuery || statusFilter !== 'all' || platformFilter !== 'all') && (
              <Link
                href="/products"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <span className="mr-2">📦</span>
                상품 관리로 이동
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
