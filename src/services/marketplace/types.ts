/**
 * Marketplace Adapter Types
 *
 * 오픈마켓 연동을 위한 공통 타입 정의
 */

import { OpenMarketPlatform } from '@prisma/client';

/**
 * 마켓플레이스 인증 정보
 */
export interface MarketplaceCredentials {
  platform: OpenMarketPlatform;
  apiKey: string;
  apiSecret: string;
  vendorId?: string;
  additionalConfig?: Record<string, any>;
}

/**
 * 상품 등록 요청
 */
export interface RegisterProductRequest {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  categoryCode: string;
  images: string[];
  specifications?: Record<string, any>;
  stockQuantity?: number;
  shippingTemplate?: string;
  keywords?: string[];
}

/**
 * 상품 등록 응답
 */
export interface RegisterProductResponse {
  success: boolean;
  productId?: string;
  listingUrl?: string;
  error?: string;
  errorCode?: string;
}

/**
 * 상품 업데이트 요청
 */
export interface UpdateProductRequest {
  productId: string;
  price?: number;
  stockQuantity?: number;
  title?: string;
  description?: string;
  images?: string[];
}

/**
 * 재고 업데이트 요청
 */
export interface UpdateStockRequest {
  productId: string;
  quantity: number;
}

/**
 * 주문 정보
 */
export interface MarketplaceOrder {
  orderId: string;
  orderDate: Date;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: {
    zipCode: string;
    address1: string;
    address2?: string;
  };
  shippingMemo?: string;
}

/**
 * 주문 상태 업데이트 요청
 */
export interface UpdateOrderStatusRequest {
  orderId: string;
  status: 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
  trackingNumber?: string;
  carrier?: string;
  memo?: string;
}

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  code: string;
  name: string;
  path: string[];
  isLeaf: boolean;
}

/**
 * 마켓플레이스 어댑터 인터페이스
 */
export interface IMarketplaceAdapter {
  /**
   * 플랫폼 이름
   */
  readonly platform: OpenMarketPlatform;

  /**
   * 인증 정보 설정
   */
  setCredentials(credentials: MarketplaceCredentials): void;

  /**
   * 상품 등록
   */
  registerProduct(request: RegisterProductRequest): Promise<RegisterProductResponse>;

  /**
   * 상품 업데이트
   */
  updateProduct(request: UpdateProductRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * 재고 업데이트
   */
  updateStock(request: UpdateStockRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * 주문 조회
   */
  fetchOrders(startDate: Date, endDate: Date): Promise<MarketplaceOrder[]>;

  /**
   * 주문 상태 업데이트
   */
  updateOrderStatus(request: UpdateOrderStatusRequest): Promise<{ success: boolean; error?: string }>;

  /**
   * 카테고리 목록 조회
   */
  fetchCategories(parentCode?: string): Promise<CategoryInfo[]>;

  /**
   * 카테고리 검색
   */
  searchCategory(keyword: string): Promise<CategoryInfo[]>;
}
