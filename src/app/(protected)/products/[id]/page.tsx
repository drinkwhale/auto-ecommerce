/**
 * 상품 상세/편집 페이지
 *
 * 상품 정보 조회 및 수정
 * - 상품 상세 정보 표시
 * - 상품 수정 (ProductForm 활용)
 * - 상태 변경 (DRAFT → READY → REGISTERED)
 * - 오픈마켓 등록 현황
 * - 주문 내역
 * - 통계 정보
 *
 * Phase 3.7: 페이지 구현 - T054
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ProductForm } from '@/components/product/ProductForm';

interface Product {
  id: string;
  userId: string;
  sourceInfo: {
    url: string;
    platform: string;
  };
  originalData: {
    title: string;
    price: number;
    description?: string;
    images?: string[];
    specifications?: Record<string, any>;
  };
  translatedData?: {
    title: string;
    description?: string;
  };
  images: {
    originalUrls: string[];
    processedUrls: string[];
  };
  salesSettings: {
    salePrice: number;
    marginRate: number;
    targetMarkets: string[];
  };
  status: string;
  statistics?: {
    views: number;
    orders: number;
    revenue: number;
  };
  registrations?: Array<{
    platform: string;
    status: string;
    platformProductId?: string;
    registeredAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  sourceUrl: string;
  sourcePlatform: 'TAOBAO' | 'AMAZON' | 'ALIBABA';
  title: string;
  description: string;
  price: number;
  images: string[];
  marginRate: number;
  salePrice?: number;
  targetMarkets: string[];
}

export default function ProductDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [activeTab, setActiveTab] = useState<'info' | 'registrations' | 'stats'>('info');

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 상품 데이터 로딩
  useEffect(() => {
    if (status === 'authenticated') {
      fetchProduct();
    }
  }, [status, productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/products/${productId}`);
      const result = await response.json();

      if (result.success) {
        setProduct(result.data);
      } else {
        setError(result.error || '상품을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('상품 정보를 불러오는 중 오류가 발생했습니다.');
      console.error('Product fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (formData: ProductFormData) => {
    try {
      const response = await fetch(`/api/v1/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          translatedData: {
            title: formData.title,
            description: formData.description,
          },
          salesSettings: {
            salePrice: formData.salePrice,
            marginRate: formData.marginRate,
            targetMarkets: formData.targetMarkets,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('상품이 수정되었습니다.');
        setMode('view');
        fetchProduct();
      } else {
        alert(result.error || '상품 수정에 실패했습니다.');
      }
    } catch (err) {
      alert('상품 수정 중 오류가 발생했습니다.');
      console.error('Update error:', err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`상태를 ${getStatusLabel(newStatus)}(으)로 변경하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('상태가 변경되었습니다.');
        fetchProduct();
      } else {
        alert(result.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('상태 변경 중 오류가 발생했습니다.');
      console.error('Status change error:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 상품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/products/${productId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('상품이 삭제되었습니다.');
        router.push('/products');
      } else {
        alert(result.error || '상품 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('상품 삭제 중 오류가 발생했습니다.');
      console.error('Delete error:', err);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: '초안',
      PROCESSING: '처리중',
      READY: '준비완료',
      REGISTERED: '등록완료',
      ERROR: '오류',
      ARCHIVED: '보관됨',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      READY: 'bg-green-100 text-green-800',
      REGISTERED: 'bg-purple-100 text-purple-800',
      ERROR: 'bg-red-100 text-red-800',
      ARCHIVED: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-800">{error || '상품을 찾을 수 없습니다.'}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={fetchProduct}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              다시 시도
            </button>
            <Link
              href="/products"
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 편집 모드
  if (mode === 'edit') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">상품 수정</h1>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <ProductForm
              initialData={{
                sourceUrl: product.sourceInfo.url,
                sourcePlatform: product.sourceInfo.platform as 'TAOBAO' | 'AMAZON' | 'ALIBABA',
                title: product.translatedData?.title || product.originalData.title,
                description: product.translatedData?.description || product.originalData.description || '',
                price: product.originalData.price,
                images: product.images.processedUrls || product.images.originalUrls,
                marginRate: product.salesSettings.marginRate,
                salePrice: product.salesSettings.salePrice,
                targetMarkets: product.salesSettings.targetMarkets,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setMode('view')}
              mode="edit"
            />
          </div>
        </div>
      </div>
    );
  }

  // 조회 모드
  const title = product.translatedData?.title || product.originalData.title;
  const description = product.translatedData?.description || product.originalData.description;
  const images = product.images.processedUrls.length > 0
    ? product.images.processedUrls
    : product.images.originalUrls;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/products"
                className="text-gray-600 hover:text-gray-900"
              >
                ← 목록으로
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">상품 상세</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(product.status)}`}>
                {getStatusLabel(product.status)}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('edit')}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'info'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                상품 정보
              </button>
              <button
                onClick={() => setActiveTab('registrations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'registrations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                오픈마켓 등록 ({product.registrations?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'stats'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                통계
              </button>
            </nav>
          </div>
        </div>

        {/* 상품 정보 탭 */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 이미지 갤러리 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 이미지</h2>
              {images.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {images.map((url, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`${title} ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=No+Image';
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">이미지가 없습니다.</p>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">제목</dt>
                    <dd className="mt-1 text-sm text-gray-900">{title}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">설명</dt>
                    <dd className="mt-1 text-sm text-gray-900">{description || '설명 없음'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">소스 URL</dt>
                    <dd className="mt-1 text-sm">
                      <a
                        href={product.sourceInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {product.sourceInfo.url}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">소스 플랫폼</dt>
                    <dd className="mt-1 text-sm text-gray-900">{product.sourceInfo.platform}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">가격 정보</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">원가</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(product.originalData.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">마진율</dt>
                    <dd className="mt-1 text-sm text-gray-900">{product.salesSettings.marginRate}%</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">판매가</dt>
                    <dd className="mt-1 text-lg font-bold text-blue-600">
                      {formatCurrency(product.salesSettings.salePrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">예상 마진</dt>
                    <dd className="mt-1 text-sm text-green-600 font-semibold">
                      {formatCurrency(product.salesSettings.salePrice - product.originalData.price)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">상태 관리</h2>
                <div className="space-y-2">
                  {['DRAFT', 'PROCESSING', 'READY', 'REGISTERED', 'ARCHIVED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={product.status === status}
                      className={`w-full px-4 py-2 text-sm rounded-md ${
                        product.status === status
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {getStatusLabel(status)}로 변경
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 오픈마켓 등록 탭 */}
        {activeTab === 'registrations' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">오픈마켓 등록 현황</h2>
            {product.registrations && product.registrations.length > 0 ? (
              <div className="space-y-4">
                {product.registrations.map((reg, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{reg.platform}</p>
                        <p className="text-sm text-gray-500">
                          상태: {reg.status}
                        </p>
                        {reg.platformProductId && (
                          <p className="text-sm text-gray-500">
                            상품 ID: {reg.platformProductId}
                          </p>
                        )}
                      </div>
                      {reg.registeredAt && (
                        <p className="text-sm text-gray-500">
                          {new Date(reg.registeredAt).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">아직 등록된 오픈마켓이 없습니다.</p>
            )}
          </div>
        )}

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">조회수</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(product.statistics?.views || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">주문 수</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatNumber(product.statistics?.orders || 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">총 수익</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {formatCurrency(product.statistics?.revenue || 0)}
              </p>
            </div>
          </div>
        )}

        {/* 타임스탬프 */}
        <div className="mt-8 text-sm text-gray-500 text-center">
          생성일: {new Date(product.createdAt).toLocaleString('ko-KR')} |
          수정일: {new Date(product.updatedAt).toLocaleString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
