/**
 * OrderDetail 컴포넌트
 *
 * 주문 상세 정보 표시 컴포넌트
 * - 주문 정보
 * - 고객 정보
 * - 배송 정보
 * - 상태 변경
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T051
 */

'use client';

import { useState } from 'react';

interface Order {
  id: string;
  productId: string;
  marketOrder: {
    platform: string;
    orderId: string;
    orderDate: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  };
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };
  shipping: {
    carrier?: string;
    trackingNumber?: string;
    shippedAt?: string;
    deliveredAt?: string;
    status: string;
  };
  payment: {
    saleAmount: number;
    costAmount: number;
    shippingFee: number;
    commission: number;
    netProfit: number;
    profitRate: number;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderDetailProps {
  order: Order;
  onStatusUpdate?: (status: string) => Promise<void>;
}

const statusOptions = [
  { value: 'RECEIVED', label: '주문접수' },
  { value: 'CONFIRMED', label: '주문확인' },
  { value: 'PURCHASING', label: '원본구매중' },
  { value: 'PURCHASED', label: '원본구매완료' },
  { value: 'SHIPPING', label: '배송중' },
  { value: 'DELIVERED', label: '배송완료' },
  { value: 'CANCELLED', label: '취소' },
  { value: 'REFUNDED', label: '환불' },
];

export function OrderDetail({ order, onStatusUpdate }: OrderDetailProps) {
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (!onStatusUpdate) return;
    if (!confirm(`주문 상태를 변경하시겠습니까?`)) return;

    setUpdating(true);
    try {
      await onStatusUpdate(newStatus);
    } catch (error) {
      console.error('Status update error:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              주문 상세
            </h1>
            <p className="text-sm text-gray-600">
              주문번호: {order.marketOrder.orderId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">주문일</p>
            <p className="text-lg font-semibold">
              {new Date(order.createdAt).toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
      </div>

      {/* 상태 변경 */}
      {onStatusUpdate && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            주문 상태 변경
          </h2>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                disabled={updating || order.status === option.value}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  order.status === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 상품 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 정보</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">플랫폼:</span>
            <span className="font-medium">{order.marketOrder.platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">수량:</span>
            <span className="font-medium">{order.marketOrder.quantity}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">단가:</span>
            <span className="font-medium">
              ₩{order.marketOrder.unitPrice.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 고객 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">고객 정보</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">이름:</span>
            <span className="font-medium">{order.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">전화:</span>
            <span className="font-medium">{order.customer.phone}</span>
          </div>
          {order.customer.email && (
            <div className="flex justify-between">
              <span className="text-gray-600">이메일:</span>
              <span className="font-medium">{order.customer.email}</span>
            </div>
          )}
          <div className="pt-2 border-t">
            <p className="text-gray-600 mb-1">배송 주소:</p>
            <p className="font-medium">{order.customer.address}</p>
          </div>
        </div>
      </div>

      {/* 배송 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">배송 정보</h2>
        <div className="space-y-2 text-sm">
          {order.shipping.carrier && (
            <div className="flex justify-between">
              <span className="text-gray-600">택배사:</span>
              <span className="font-medium">{order.shipping.carrier}</span>
            </div>
          )}
          {order.shipping.trackingNumber && (
            <div className="flex justify-between">
              <span className="text-gray-600">송장번호:</span>
              <span className="font-medium font-mono">
                {order.shipping.trackingNumber}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">배송 상태:</span>
            <span className="font-medium">{order.shipping.status}</span>
          </div>
        </div>
      </div>

      {/* 결제 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">판매 금액:</span>
            <span className="font-medium">
              ₩{order.payment.saleAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">원가:</span>
            <span className="font-medium text-red-600">
              -₩{order.payment.costAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">배송비:</span>
            <span className="font-medium text-red-600">
              -₩{order.payment.shippingFee.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">수수료:</span>
            <span className="font-medium text-red-600">
              -₩{order.payment.commission.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-900 font-semibold">순이익:</span>
            <span className="font-bold text-green-600 text-lg">
              ₩{order.payment.netProfit.toLocaleString()} (
              {order.payment.profitRate}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderDetail;
