/**
 * OrderList 컴포넌트
 *
 * 주문 목록 표시 컴포넌트
 * - DataTable 활용
 * - 주문 상태 배지
 * - 배송 정보
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T050
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DataTable, Column } from '../common/DataTable';

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

interface OrderListProps {
  orders: Order[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onRefresh?: () => void;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-indigo-100 text-indigo-800',
  PURCHASING: 'bg-yellow-100 text-yellow-800',
  PURCHASED: 'bg-orange-100 text-orange-800',
  SHIPPING: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  RECEIVED: '주문접수',
  CONFIRMED: '주문확인',
  PURCHASING: '원본구매중',
  PURCHASED: '원본구매완료',
  SHIPPING: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소',
  REFUNDED: '환불',
};

export function OrderList({
  orders,
  pagination,
  onRefresh,
  loading = false,
}: OrderListProps) {
  const [selectedRows, setSelectedRows] = useState<Order[]>([]);

  const columns: Column<Order>[] = [
    {
      key: 'orderId',
      label: '주문번호',
      sortable: true,
      render: (_, order) => {
        return (
          <Link
            href={`/orders/${order.id}`}
            className="text-blue-600 hover:underline font-mono text-sm"
          >
            {order.marketOrder.orderId.substring(0, 12)}...
          </Link>
        );
      },
    },
    {
      key: 'platform',
      label: '플랫폼',
      render: (_, order) => {
        return (
          <span className="text-sm font-medium">
            {order.marketOrder.platform}
          </span>
        );
      },
    },
    {
      key: 'productTitle',
      label: '상품',
      render: (_, order) => {
        return (
          <div className="max-w-xs">
            <Link
              href={`/products/${order.productId}`}
              className="text-sm text-gray-900 hover:text-blue-600 line-clamp-2"
            >
              {order.productTitle}
            </Link>
          </div>
        );
      },
    },
    {
      key: 'customer',
      label: '고객',
      render: (_, order) => {
        return (
          <div className="text-sm">
            <div className="font-medium">{order.customer.name}</div>
            <div className="text-gray-500">{order.customer.phone}</div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: '수량',
      sortable: true,
      render: (_, order) => {
        return <span className="text-sm">{order.marketOrder.quantity}개</span>;
      },
    },
    {
      key: 'payment',
      label: '금액/수익',
      sortable: true,
      render: (_, order) => {
        return (
          <div className="text-sm">
            <div className="font-medium">
              ₩{order.payment.saleAmount.toLocaleString()}
            </div>
            <div className="text-green-600">
              +₩{order.payment.netProfit.toLocaleString()} (
              {order.payment.profitRate}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: '상태',
      sortable: true,
      render: (_, order) => {
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              statusColors[order.status]
            }`}
          >
            {statusLabels[order.status]}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: '주문일',
      sortable: true,
      render: (value) => {
        return (
          <div className="text-sm text-gray-600">
            {new Date(value).toLocaleDateString('ko-KR')}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">주문 목록</h2>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            🔄 새로고침
          </button>
        )}
      </div>

      {/* 테이블 */}
      <DataTable
        data={orders}
        columns={columns}
        pagination={pagination}
        emptyMessage="주문이 없습니다."
        loading={loading}
      />
    </div>
  );
}

export default OrderList;