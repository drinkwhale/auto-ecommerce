/**
 * ProductCard 컴포넌트
 *
 * 상품 카드 컴포넌트 (그리드 뷰용)
 * - 이미지, 제목, 가격
 * - 상태 배지
 * - 호버 효과
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T049
 */

'use client';

import Link from 'next/link';

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
  };
  status: string;
}

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  READY: 'bg-green-100 text-green-800',
  REGISTERED: 'bg-purple-100 text-purple-800',
  ERROR: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  DRAFT: '초안',
  PROCESSING: '처리중',
  READY: '준비완료',
  REGISTERED: '등록완료',
  ERROR: '오류',
  ARCHIVED: '보관됨',
};

export function ProductCard({ product, onClick }: ProductCardProps) {
  const title = product.translatedData?.title || product.originalData.title;
  const imageUrl = product.originalData.images?.[0];

  const content = (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
      {/* 이미지 */}
      <div className="relative h-48 bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
            📦
          </div>
        )}
        {/* 상태 배지 */}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusColors[product.status]
            }`}
          >
            {statusLabels[product.status]}
          </span>
        </div>
      </div>

      {/* 내용 */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">원가</p>
            <p className="text-md font-medium text-gray-900">
              ¥{product.originalData.price.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">판매가</p>
            <p className="text-lg font-bold text-blue-600">
              ₩{product.salesSettings.salePrice.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }

  return <Link href={`/products/${product.id}`}>{content}</Link>;
}

export default ProductCard;