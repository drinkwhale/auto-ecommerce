/**
 * ProductSearchResults 컴포넌트
 *
 * 상품 검색 결과를 표시하는 컴포넌트
 * - 판매량 순 정렬
 * - 그리드 레이아웃
 * - 상품 카드 클릭 시 선택
 * - 페이지네이션
 */

'use client';

import React from 'react';
import Image from 'next/image';

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

interface SearchResultsData {
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
}

interface ProductSearchResultsProps {
  data: SearchResultsData;
  onSelectProduct: (product: SearchResult) => void;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function ProductSearchResults({
  data,
  onSelectProduct,
  onPageChange,
  loading = false,
}: ProductSearchResultsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">검색 중...</p>
        </div>
      </div>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">검색 결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 검색 정보 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">&quot;{data.originalQuery || data.query}&quot;</span> 검색 결과
              {data.translatedQuery && (
                <span className="ml-2 text-blue-600">
                  (번역: &quot;{data.translatedQuery}&quot;)
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              플랫폼: {data.platform} | 총 {data.pagination.totalResults.toLocaleString()}개 상품
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              정렬: {data.sortBy === 'sales' ? '판매량 순' : data.sortBy}
            </p>
          </div>
        </div>
      </div>

      {/* 검색 결과 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.results.map((product) => (
          <div
            key={product.id}
            onClick={() => onSelectProduct(product)}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
          >
            {/* 상품 이미지 */}
            <div className="relative h-48 bg-gray-100">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                unoptimized
              />
              {product.shipping.isFree && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  무료배송
                </div>
              )}
            </div>

            {/* 상품 정보 */}
            <div className="p-4">
              {/* 제목 */}
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 h-10 mb-2">
                {product.title}
              </h3>

              {/* 가격 */}
              <div className="mb-2">
                <p className="text-lg font-bold text-gray-900">
                  {product.price.amount.toLocaleString()} {product.price.currency}
                </p>
              </div>

              {/* 판매량 및 평점 */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <div className="flex items-center">
                  <span className="text-yellow-500">★</span>
                  <span className="ml-1">{product.rating}</span>
                  <span className="ml-1">({product.reviewCount.toLocaleString()})</span>
                </div>
                <div>
                  판매 {product.salesCount.toLocaleString()}
                </div>
              </div>

              {/* 판매자 정보 */}
              <div className="text-xs text-gray-500 border-t pt-2">
                <p>{product.seller.name}</p>
                <p className="mt-1">
                  배송: {product.shipping.estimatedDays}일 소요
                </p>
              </div>
            </div>

            {/* 선택 버튼 */}
            <div className="px-4 pb-4">
              <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                이 상품 선택
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-8">
          <button
            onClick={() => onPageChange(data.pagination.currentPage - 1)}
            disabled={data.pagination.currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>

          <div className="flex space-x-1">
            {Array.from({ length: Math.min(data.pagination.totalPages, 5) }, (_, i) => {
              const page = i + 1;
              const isActive = page === data.pagination.currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`px-4 py-2 border rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(data.pagination.currentPage + 1)}
            disabled={data.pagination.currentPage === data.pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
