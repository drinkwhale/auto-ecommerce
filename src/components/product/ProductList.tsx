/**
 * ProductList 컴포넌트
 *
 * 상품 목록 표시 컴포넌트
 * - DataTable 활용
 * - 상품 이미지 표시
 * - 상태 배지
 * - 액션 버튼
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T047
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '../common/DataTable';

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

interface ProductListProps {
  products: Product[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onRefresh?: () => void;
  onDelete?: (ids: string[]) => void;
  loading?: boolean;
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

export function ProductList({
  products,
  pagination,
  onRefresh,
  onDelete,
  loading = false,
}: ProductListProps) {
  const [selectedRows, setSelectedRows] = useState<Product[]>([]);

  const columns: Column<Product>[] = [
    {
      key: 'image',
      label: '이미지',
      width: 'w-20',
      render: (_, product) => {
        const imageUrl = product.originalData.images?.[0];
        return imageUrl ? (
          <img
            src={imageUrl}
            alt={product.originalData.title}
            className="w-12 h-12 object-cover rounded"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
            📦
          </div>
        );
      },
    },
    {
      key: 'title',
      label: '상품명',
      sortable: true,
      render: (_, product) => {
        const title =
          product.translatedData?.title || product.originalData.title;
        return (
          <Link
            href={`/products/${product.id}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {title.length > 50 ? title.substring(0, 50) + '...' : title}
          </Link>
        );
      },
    },
    {
      key: 'price',
      label: '원가',
      sortable: true,
      render: (_, product) => {
        return `¥${product.originalData.price.toLocaleString()}`;
      },
    },
    {
      key: 'salePrice',
      label: '판매가',
      sortable: true,
      render: (_, product) => {
        return `₩${product.salesSettings.salePrice.toLocaleString()}`;
      },
    },
    {
      key: 'marginRate',
      label: '마진율',
      sortable: true,
      render: (_, product) => {
        return `${product.salesSettings.marginRate}%`;
      },
    },
    {
      key: 'status',
      label: '상태',
      sortable: true,
      render: (_, product) => {
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusColors[product.status]
            }`}
          >
            {statusLabels[product.status]}
          </span>
        );
      },
    },
    {
      key: 'statistics',
      label: '통계',
      render: (_, product) => {
        return (
          <div className="text-xs text-gray-600">
            <div>조회: {product.statistics?.views || 0}</div>
            <div>주문: {product.statistics?.orders || 0}</div>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: '등록일',
      sortable: true,
      render: (value) => {
        return new Date(value).toLocaleDateString('ko-KR');
      },
    },
  ];

  const actions = [
    {
      label: '선택 삭제',
      onClick: (rows: Product[]) => {
        if (
          onDelete &&
          confirm(`${rows.length}개 상품을 삭제하시겠습니까?`)
        ) {
          onDelete(rows.map((r) => r.id));
          setSelectedRows([]);
        }
      },
      variant: 'danger' as const,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">상품 목록</h2>
        <div className="flex space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              🔄 새로고침
            </button>
          )}
          <Link
            href="/products/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            ➕ 상품 등록
          </Link>
        </div>
      </div>

      {/* 테이블 */}
      <DataTable
        data={products}
        columns={columns}
        pagination={pagination}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        actions={actions}
        emptyMessage="등록된 상품이 없습니다."
        loading={loading}
      />
    </div>
  );
}

export default ProductList;