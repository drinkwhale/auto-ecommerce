/**
 * 상품 등록 페이지
 *
 * 새로운 상품을 등록하는 페이지
 * - 소스 플랫폼 선택 → 상품 검색 → 선택 → 등록
 * - 한국어 검색 자동 번역
 * - 판매량 순 정렬
 *
 * Phase 3.7: 페이지 구현 - 검색 기능 추가
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/product/ProductForm';
import { ProductSearchResults } from '@/components/product/ProductSearchResults';
import { SourcePlatform } from '@prisma/client';

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

interface SearchResult {
  id: string;
  title: string;
  price: {
    amount: number;
    currency: string;
  };
  imageUrl: string;
  sourceUrl: string;
  salesCount: number;
  rating: number;
  reviewCount: number;
  seller: {
    name: string;
    rating: number;
  };
  shipping: {
    isFree: boolean;
    estimatedDays: number;
  };
}

export default function ProductNewPage() {
  const { status } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색 관련 상태
  const [searchMode, setSearchMode] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<SourcePlatform>(SourcePlatform.TAOBAO);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    query: string;
    platform: string;
    results: SearchResult[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalResults: number;
      pageSize: number;
    };
    sortBy: string;
    originalQuery?: string;
    translatedQuery?: string;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 상품 검색 처리
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요');
      return;
    }

    try {
      setSearching(true);
      setError(null);

      const response = await fetch('/api/v1/products/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          platform: selectedPlatform,
          page: 1,
          limit: 20,
          sortBy: 'sales',
          autoTranslate: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data);
      } else {
        setError(result.error || '검색에 실패했습니다.');
      }
    } catch (err) {
      setError('검색 중 오류가 발생했습니다.');
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // 페이지 변경 처리
  const handlePageChange = async (page: number) => {
    try {
      setSearching(true);

      const response = await fetch('/api/v1/products/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          platform: selectedPlatform,
          page,
          limit: 20,
          sortBy: 'sales',
          autoTranslate: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data);
      }
    } catch (err) {
      console.error('Page change error:', err);
    } finally {
      setSearching(false);
    }
  };

  // 상품 선택 처리
  const handleSelectProduct = (product: SearchResult) => {
    setSelectedProduct(product);
    setSearchMode(false);
  };

  // 상품 등록 처리
  const handleSubmit = async (formData: ProductFormData) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        alert('상품이 성공적으로 등록되었습니다.');
        router.push(`/products/${result.data.id}`);
      } else {
        setError(result.error || '상품 등록에 실패했습니다.');
      }
    } catch (err) {
      setError('상품 등록 중 오류가 발생했습니다.');
      console.error('Product create error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (searchMode) {
      router.push('/products');
    } else {
      setSearchMode(true);
      setSelectedProduct(null);
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
              <h1 className="text-3xl font-bold text-gray-900">새 상품 등록</h1>
              <p className="mt-2 text-gray-600">
                {searchMode
                  ? '소스 플랫폼에서 상품을 검색하고 선택하세요'
                  : '선택한 상품을 확인하고 등록하세요'}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {searchMode ? '취소' : '다시 검색'}
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 검색 모드 */}
        {searchMode ? (
          <div className="space-y-6">
            {/* 검색 입력 */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 검색</h2>

              {/* 플랫폼 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  소스 플랫폼 선택
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: SourcePlatform.TAOBAO, label: '타오바오 (중국)' },
                    { value: SourcePlatform.AMAZON, label: '아마존 (미국)' },
                    { value: SourcePlatform.ALIBABA, label: '알리바바 (중국)' },
                  ].map((platform) => (
                    <button
                      key={platform.value}
                      onClick={() => setSelectedPlatform(platform.value)}
                      className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                        selectedPlatform === platform.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검색어 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  검색어 (한국어 입력 가능)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="예: 무선 이어폰"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {searching ? '검색 중...' : '검색'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  💡 한국어로 검색하면 자동으로 선택한 플랫폼의 언어로 번역됩니다
                </p>
              </div>
            </div>

            {/* 검색 결과 */}
            {searchResults && (
              <div className="bg-white shadow rounded-lg p-6">
                <ProductSearchResults
                  data={searchResults}
                  onSelectProduct={handleSelectProduct}
                  onPageChange={handlePageChange}
                  loading={searching}
                />
              </div>
            )}
          </div>
        ) : (
          /* 상품 등록 폼 */
          <div className="bg-white shadow rounded-lg p-6">
            <ProductForm
              mode="create"
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitting={submitting}
              initialData={
                selectedProduct
                  ? {
                      sourceUrl: selectedProduct.sourceUrl,
                      sourcePlatform: selectedPlatform as any,
                      title: selectedProduct.title,
                      description: '',
                      price: selectedProduct.price.amount,
                      images: [selectedProduct.imageUrl],
                      marginRate: 0.3,
                      targetMarkets: [],
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
