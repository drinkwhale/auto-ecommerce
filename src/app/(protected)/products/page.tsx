/**
 * 상품 관리 페이지
 *
 * 상품 목록 조회, 검색, 필터링, 정렬 기능 제공
 * - 상품 목록 표시 (ProductList 컴포넌트)
 * - 검색 기능 (제목, ID)
 * - 필터링 (상태, 플랫폼)
 * - 정렬 (최신순, 가격순, 조회수순)
 * - 페이지네이션
 * - 대량 삭제 기능
 *
 * Phase 3.7: 페이지 구현 - T053
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProductList } from '@/components/product/ProductList';

interface Product {
  id: string;
  originalData: {
    title: string;
    price: number;
    images?: string[];
  };
  translatedData?: {
    title: string;
  };
  salesSettings: {
    salePrice: number;
    marginRate: number;
  };
  status: string;
  statistics?: {
    views: number;
    orders: number;
  };
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ProductsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
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
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 상품 목록 로딩
  useEffect(() => {
    if (status === 'authenticated') {
      fetchProducts();
    }
  }, [status, searchQuery, statusFilter, sortBy, sortOrder, pagination.page]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { q: searchQuery }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/v1/products?${params}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data.products);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || '상품을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('상품 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('Products fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchProducts();
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`선택한 ${ids.length}개의 상품을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      const promises = ids.map((id) =>
        fetch(`/api/v1/products/${id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every((r) => r.ok);

      if (allSuccess) {
        alert('상품이 삭제되었습니다.');
        // 삭제 후 목록 새로고침
        await fetchProducts();
      } else {
        alert('일부 상품 삭제에 실패했습니다.');
        await fetchProducts();
      }
    } catch (err) {
      alert('상품 삭제 중 오류가 발생했습니다.');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">상품 관리</h1>
              <p className="mt-2 text-gray-600">
                총 {pagination.total}개의 상품이 있습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/products/crawl"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <span className="mr-2">🔍</span>
                상품 크롤링
              </Link>
              <Link
                href="/products/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <span className="mr-2">➕</span>
                상품 등록
              </Link>
            </div>
          </div>

          {/* 검색 및 필터 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <form onSubmit={handleSearch} className="md:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="상품 제목 또는 ID로 검색..."
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
                <option value="DRAFT">초안</option>
                <option value="PROCESSING">처리중</option>
                <option value="READY">준비완료</option>
                <option value="REGISTERED">등록완료</option>
                <option value="ERROR">오류</option>
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
                <option value="salesSettings.salePrice-desc">가격 높은순</option>
                <option value="salesSettings.salePrice-asc">가격 낮은순</option>
                <option value="statistics.views-desc">조회수순</option>
                <option value="statistics.orders-desc">주문수순</option>
              </select>
            </div>
          </div>

          {/* 검색 결과 요약 */}
          {(searchQuery || statusFilter !== 'all') && (
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
                  상태: {statusFilter}
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
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
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

        {/* 상품 목록 */}
        {error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-red-600 text-xl mb-4">⚠️</div>
            <p className="text-gray-800">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <ProductList
            products={products}
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              onPageChange: handlePageChange,
            }}
            onRefresh={fetchProducts}
            onDelete={handleDelete}
            loading={loading}
          />
        )}

        {/* 빈 상태 */}
        {!loading && products.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all'
                ? '검색 결과가 없습니다'
                : '아직 등록된 상품이 없습니다'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? '다른 검색어나 필터를 사용해보세요.'
                : '새로운 상품을 등록하거나 크롤링하여 시작하세요.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/products/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <span className="mr-2">➕</span>
                상품 등록
              </Link>
              <Link
                href="/products/crawl"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <span className="mr-2">🔍</span>
                상품 크롤링
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
