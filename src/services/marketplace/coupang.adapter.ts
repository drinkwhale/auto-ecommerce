/**
 * Coupang Marketplace Adapter
 *
 * 쿠팡 오픈마켓 연동 어댑터
 * - 상품 등록/수정
 * - 주문 조회
 * - 재고 관리
 *
 * Phase 3A.3: T220 - 쿠팡 어댑터 인터페이스 + mock 구현
 */

import { OpenMarketPlatform } from '@prisma/client';
import {
  IMarketplaceAdapter,
  MarketplaceCredentials,
  RegisterProductRequest,
  RegisterProductResponse,
  UpdateProductRequest,
  UpdateStockRequest,
  MarketplaceOrder,
  UpdateOrderStatusRequest,
  CategoryInfo,
} from './types';

/**
 * 쿠팡 Mock 어댑터 (실제 API 연동 전 테스트용)
 */
export class CoupangMockAdapter implements IMarketplaceAdapter {
  readonly platform = OpenMarketPlatform.COUPANG;
  private credentials: MarketplaceCredentials | null = null;
  private mockProducts: Map<string, RegisterProductRequest> = new Map();
  private mockOrders: MarketplaceOrder[] = [];

  /**
   * 인증 정보 설정
   */
  setCredentials(credentials: MarketplaceCredentials): void {
    if (credentials.platform !== this.platform) {
      throw new Error(`잘못된 플랫폼 인증 정보입니다. 예상: ${this.platform}, 실제: ${credentials.platform}`);
    }
    this.credentials = credentials;
  }

  /**
   * 상품 등록
   */
  async registerProduct(request: RegisterProductRequest): Promise<RegisterProductResponse> {
    this.ensureAuthenticated();

    try {
      // 입력 검증
      this.validateRegisterProductRequest(request);

      // Mock 상품 ID 생성
      const productId = `CP${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Mock 데이터 저장
      this.mockProducts.set(productId, request);

      // Mock 응답 생성
      return {
        success: true,
        productId,
        listingUrl: `https://www.coupang.com/vp/products/${productId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        errorCode: 'REGISTER_FAILED',
      };
    }
  }

  /**
   * 상품 업데이트
   */
  async updateProduct(request: UpdateProductRequest): Promise<{ success: boolean; error?: string }> {
    this.ensureAuthenticated();

    try {
      // 상품 존재 확인
      const existingProduct = this.mockProducts.get(request.productId);
      if (!existingProduct) {
        return {
          success: false,
          error: `상품을 찾을 수 없습니다: ${request.productId}`,
        };
      }

      // Mock 업데이트
      const updatedProduct = {
        ...existingProduct,
        ...(request.price && { price: request.price }),
        ...(request.stockQuantity && { stockQuantity: request.stockQuantity }),
        ...(request.title && { title: request.title }),
        ...(request.description && { description: request.description }),
        ...(request.images && { images: request.images }),
      };

      this.mockProducts.set(request.productId, updatedProduct);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 재고 업데이트
   */
  async updateStock(request: UpdateStockRequest): Promise<{ success: boolean; error?: string }> {
    this.ensureAuthenticated();

    try {
      const existingProduct = this.mockProducts.get(request.productId);
      if (!existingProduct) {
        return {
          success: false,
          error: `상품을 찾을 수 없습니다: ${request.productId}`,
        };
      }

      // 재고 업데이트
      this.mockProducts.set(request.productId, {
        ...existingProduct,
        stockQuantity: request.quantity,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 주문 조회
   */
  async fetchOrders(startDate: Date, endDate: Date): Promise<MarketplaceOrder[]> {
    this.ensureAuthenticated();

    // 날짜 범위 내 주문 필터링
    return this.mockOrders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  /**
   * 주문 상태 업데이트
   */
  async updateOrderStatus(request: UpdateOrderStatusRequest): Promise<{ success: boolean; error?: string }> {
    this.ensureAuthenticated();

    try {
      const orderIndex = this.mockOrders.findIndex((order) => order.orderId === request.orderId);

      if (orderIndex === -1) {
        return {
          success: false,
          error: `주문을 찾을 수 없습니다: ${request.orderId}`,
        };
      }

      // Mock 주문 상태는 여기서는 업데이트하지 않음 (실제 시스템에서는 필요)
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 카테고리 목록 조회
   */
  async fetchCategories(parentCode?: string): Promise<CategoryInfo[]> {
    this.ensureAuthenticated();

    // Mock 카테고리 데이터
    if (!parentCode) {
      // 최상위 카테고리
      return [
        {
          code: 'CAT_ELECTRONICS',
          name: '가전디지털',
          path: ['가전디지털'],
          isLeaf: false,
        },
        {
          code: 'CAT_FASHION',
          name: '패션의류',
          path: ['패션의류'],
          isLeaf: false,
        },
        {
          code: 'CAT_BEAUTY',
          name: '뷰티',
          path: ['뷰티'],
          isLeaf: false,
        },
      ];
    }

    // 하위 카테고리
    if (parentCode === 'CAT_ELECTRONICS') {
      return [
        {
          code: 'CAT_ELECTRONICS_MOBILE',
          name: '모바일/태블릿',
          path: ['가전디지털', '모바일/태블릿'],
          isLeaf: false,
        },
        {
          code: 'CAT_ELECTRONICS_COMPUTER',
          name: '컴퓨터',
          path: ['가전디지털', '컴퓨터'],
          isLeaf: false,
        },
      ];
    }

    return [];
  }

  /**
   * 카테고리 검색
   */
  async searchCategory(keyword: string): Promise<CategoryInfo[]> {
    this.ensureAuthenticated();

    // Mock 카테고리 검색
    const allCategories = [
      {
        code: 'CAT_ELECTRONICS_MOBILE_ACCESSORIES',
        name: '스마트폰 액세서리',
        path: ['가전디지털', '모바일/태블릿', '스마트폰 액세서리'],
        isLeaf: true,
      },
      {
        code: 'CAT_ELECTRONICS_COMPUTER_PERIPHERALS',
        name: '컴퓨터 주변기기',
        path: ['가전디지털', '컴퓨터', '주변기기'],
        isLeaf: true,
      },
      {
        code: 'CAT_FASHION_WOMEN',
        name: '여성의류',
        path: ['패션의류', '여성의류'],
        isLeaf: true,
      },
    ];

    return allCategories.filter((category) => category.name.includes(keyword));
  }

  /**
   * Mock 주문 추가 (테스트용)
   */
  addMockOrder(order: MarketplaceOrder): void {
    this.mockOrders.push(order);
  }

  /**
   * Mock 데이터 초기화 (테스트용)
   */
  clearMockData(): void {
    this.mockProducts.clear();
    this.mockOrders = [];
  }

  /**
   * 인증 확인
   */
  private ensureAuthenticated(): void {
    if (!this.credentials) {
      throw new Error('쿠팡 인증 정보가 설정되지 않았습니다. setCredentials()를 먼저 호출하세요.');
    }
  }

  /**
   * 상품 등록 요청 검증
   */
  private validateRegisterProductRequest(request: RegisterProductRequest): void {
    const errors: string[] = [];

    if (!request.title || request.title.length < 5) {
      errors.push('상품명은 최소 5자 이상이어야 합니다');
    }

    if (!request.description || request.description.length < 10) {
      errors.push('상품 설명은 최소 10자 이상이어야 합니다');
    }

    if (!request.price || request.price < 100) {
      errors.push('가격은 100원 이상이어야 합니다');
    }

    if (!request.categoryCode) {
      errors.push('카테고리 코드는 필수입니다');
    }

    if (!request.images || request.images.length === 0) {
      errors.push('최소 1개 이상의 상품 이미지가 필요합니다');
    }

    if (errors.length > 0) {
      throw new Error(`상품 등록 검증 실패: ${errors.join(', ')}`);
    }
  }
}

/**
 * 쿠팡 실제 API 어댑터 (향후 구현)
 */
export class CoupangAdapter implements IMarketplaceAdapter {
  readonly platform = OpenMarketPlatform.COUPANG;
  private credentials: MarketplaceCredentials | null = null;

  setCredentials(credentials: MarketplaceCredentials): void {
    this.credentials = credentials;
  }

  async registerProduct(_request: RegisterProductRequest): Promise<RegisterProductResponse> {
    // TODO: 실제 쿠팡 API 연동 구현
    // https://developers.coupangcorp.com/hc/ko/articles/360034897214
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async updateProduct(_request: UpdateProductRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async updateStock(_request: UpdateStockRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async fetchOrders(_startDate: Date, _endDate: Date): Promise<MarketplaceOrder[]> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async updateOrderStatus(_request: UpdateOrderStatusRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async fetchCategories(_parentCode?: string): Promise<CategoryInfo[]> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }

  async searchCategory(_keyword: string): Promise<CategoryInfo[]> {
    throw new Error('실제 쿠팡 API 연동이 아직 구현되지 않았습니다');
  }
}

/**
 * Factory 함수: Mock 또는 실제 어댑터 생성
 */
export function createCoupangAdapter(useMock: boolean = true): IMarketplaceAdapter {
  return useMock ? new CoupangMockAdapter() : new CoupangAdapter();
}
