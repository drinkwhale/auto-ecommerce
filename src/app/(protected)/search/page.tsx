/**
 * 상품 검색 페이지
 *
 * 소스 플랫폼별 상품 검색 및 탐색 기능
 * - 플랫폼 선택 (타오바오, 아마존, 알리바바 등)
 * - 검색어 입력 (한글 자동 번역)
 * - 정렬 기능 (판매량, 리뷰수, 가격)
 * - 검색 결과 목록 표시
 *
 * Phase 3.x: 상품 검색 기능 추가
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SourcePlatform } from '@prisma/client';

// 플랫폼 옵션 (소스 플랫폼만 포함)
const PLATFORM_OPTIONS = [
  { value: SourcePlatform.TAOBAO, label: '타오바오', icon: '🛒' },
  { value: SourcePlatform.ALIBABA, label: '알리바바', icon: '📦' },
  { value: SourcePlatform.AMAZON, label: '아마존', icon: '🌐' },
];

// 정렬 옵션
const SORT_OPTIONS = [
  { value: 'relevance', label: '관련도순' },
  { value: 'sales', label: '판매량순' },
  { value: 'reviews', label: '리뷰수순' },
  { value: 'price', label: '가격순' },
];

interface SearchResultItem {
  id: string;
  title: string;
  imageUrl: string;
  price: {
    amount: number;
    currency: string;
  };
  salesCount?: number;
  reviewCount?: number;
  rating?: number;
  sourceUrl: string;
}

interface SearchResult {
  query: string;
  translatedQuery: string;
  platform: SourcePlatform;
  total: number;
  page: number;
  limit: number;
  items: SearchResultItem[];
}

export default function SearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 검색 상태
  const [selectedPlatform, setSelectedPlatform] = useState<SourcePlatform>(SourcePlatform.TAOBAO);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 검색 결과 상태
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 30;

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // 검색 실행
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('검색어를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/search?query=${encodeURIComponent(searchQuery)}&platform=${selectedPlatform}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${currentPage}&limit=${limit}`
      );

      const result = await response.json();

      if (result.success) {
        setSearchResult(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('검색 중 오류가 발생했습니다');
      console.error('검색 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 정렬 변경 시 자동 재검색
  useEffect(() => {
    if (searchResult) {
      handleSearch();
    }
  }, [sortBy, sortOrder]);

  // 페이지 변경 시 자동 재검색
  useEffect(() => {
    if (searchResult && currentPage > 1) {
      handleSearch();
    }
  }, [currentPage]);

  // 가격 포맷팅
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency === 'CNY' ? 'CNY' : currency === 'USD' ? 'USD' : 'KRW',
    }).format(amount);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">상품 검색</h1>
        <p className="mt-2 text-gray-600">
          글로벌 쇼핑몰에서 상품을 검색하고 소싱하세요
        </p>
      </div>

      {/* 검색 폼 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        {/* 플랫폼 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            소스 플랫폼
          </label>
          <div className="grid grid-cols-3 gap-4">
            {PLATFORM_OPTIONS.map((platform) => (
              <button
                key={platform.value}
                onClick={() => setSelectedPlatform(platform.value)}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${
                    selectedPlatform === platform.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }
                `}
              >
                <div className="text-3xl mb-2">{platform.icon}</div>
                <div className="text-base font-medium">{platform.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 검색어 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            검색어 (한글 입력 시 자동 번역됩니다)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="예: 무선 이어폰"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
        </div>

        {/* 정렬 옵션 */}
        {searchResult && (
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ 오름차순' : '↓ 내림차순'}
            </button>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 검색 결과 */}
      {searchResult && (
        <div>
          {/* 검색 결과 헤더 */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                검색 결과: "{searchResult.query}"
                {searchResult.translatedQuery !== searchResult.query && (
                  <span className="text-gray-500 text-base ml-2">
                    ({searchResult.translatedQuery})
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                총 {searchResult.total.toLocaleString()}개의 상품
              </p>
            </div>
          </div>

          {/* 상품 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {searchResult.items.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => window.open(item.sourceUrl, '_blank')}
              >
                {/* 상품 이미지 */}
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 상품 정보 */}
                <div className="p-4">
                  {/* 상품명 */}
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 h-10">
                    {item.title}
                  </h3>

                  {/* 가격 */}
                  <div className="text-lg font-bold text-blue-600 mb-2">
                    {formatPrice(item.price.amount, item.price.currency)}
                  </div>

                  {/* 판매량 및 리뷰 */}
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    {item.salesCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <span>📊</span>
                        <span>{item.salesCount.toLocaleString()}개 판매</span>
                      </div>
                    )}
                    {item.reviewCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <span>💬</span>
                        <span>{item.reviewCount.toLocaleString()}개 리뷰</span>
                      </div>
                    )}
                  </div>

                  {/* 평점 */}
                  {item.rating !== undefined && (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium">{item.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          <div className="mt-8 flex justify-center">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <div className="px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-600 font-medium">
                {currentPage}
              </div>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage * limit >= searchResult.total || isLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 검색 전 안내 */}
      {!searchResult && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg">플랫폼을 선택하고 검색어를 입력해주세요</p>
          <p className="text-sm mt-2">
            한글로 검색하면 자동으로 번역됩니다
          </p>
        </div>
      )}
    </div>
  );
}
