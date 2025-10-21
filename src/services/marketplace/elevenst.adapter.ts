/**
 * 11번가 (11st/Street11) Marketplace Adapter
 *
 * 11번가 오픈마켓 연동 어댑터
 * - 상품 등록/수정
 * - 주문 조회
 * - 재고 관리
 *
 * Phase 3A.3: T220 - 11번가 어댑터 인터페이스 + mock 구현
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
 * 11번가 Mock 어댑터 (실제 API 연동 전 테스트용)
 */
export class ElevenstMockAdapter implements IMarketplaceAdapter {
  readonly platform = OpenMarketPlatform.STREET11;
  private credentials: MarketplaceCredentials | null = null;
  private mockProducts: Map<string, RegisterProductRequest> = new Map();
  private mockOrders: MarketplaceOrder[] = [];

  setCredentials(credentials: MarketplaceCredentials): void {
    if (credentials.platform !== this.platform) {
      throw new Error(`잘못된 플랫폼 인증 정보입니다. 예상: ${this.platform}, 실제: ${credentials.platform}`);
    }
    this.credentials = credentials;
  }

  async registerProduct(request: RegisterProductRequest): Promise<RegisterProductResponse> {
    this.ensureAuthenticated();

    try {
      this.validateRegisterProductRequest(request);

      const productId = `11ST${Date.now()}${Math.floor(Math.random() * 1000)}`;
      this.mockProducts.set(productId, request);

      return {
        success: true,
        productId,
        listingUrl: `http://www.11st.co.kr/product/SellerProductDetail.tmall?prdNo=${productId}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        errorCode: 'REGISTER_FAILED',
      };
    }
  }

  async updateProduct(request: UpdateProductRequest): Promise<{ success: boolean; error?: string }> {
    this.ensureAuthenticated();

    try {
      const existingProduct = this.mockProducts.get(request.productId);
      if (!existingProduct) {
        return {
          success: false,
          error: `상품을 찾을 수 없습니다: ${request.productId}`,
        };
      }

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

  async fetchOrders(startDate: Date, endDate: Date): Promise<MarketplaceOrder[]> {
    this.ensureAuthenticated();

    return this.mockOrders.filter((order) => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

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

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  async fetchCategories(parentCode?: string): Promise<CategoryInfo[]> {
    this.ensureAuthenticated();

    if (!parentCode) {
      return [
        {
          code: '11ST_CAT_FASHION',
          name: '패션의류/잡화',
          path: ['패션의류/잡화'],
          isLeaf: false,
        },
        {
          code: '11ST_CAT_BEAUTY',
          name: '화장품/미용',
          path: ['화장품/미용'],
          isLeaf: false,
        },
        {
          code: '11ST_CAT_DIGITAL',
          name: '디지털/가전',
          path: ['디지털/가전'],
          isLeaf: false,
        },
      ];
    }

    if (parentCode === '11ST_CAT_DIGITAL') {
      return [
        {
          code: '11ST_CAT_DIGITAL_MOBILE',
          name: '휴대폰/스마트폰',
          path: ['디지털/가전', '휴대폰/스마트폰'],
          isLeaf: false,
        },
        {
          code: '11ST_CAT_DIGITAL_PC',
          name: 'PC/노트북',
          path: ['디지털/가전', 'PC/노트북'],
          isLeaf: false,
        },
      ];
    }

    return [];
  }

  async searchCategory(keyword: string): Promise<CategoryInfo[]> {
    this.ensureAuthenticated();

    const allCategories = [
      {
        code: '11ST_CAT_DIGITAL_MOBILE_ACC',
        name: '스마트폰 악세서리',
        path: ['디지털/가전', '휴대폰/스마트폰', '악세서리'],
        isLeaf: true,
      },
      {
        code: '11ST_CAT_FASHION_WOMEN',
        name: '여성의류',
        path: ['패션의류/잡화', '여성의류'],
        isLeaf: true,
      },
      {
        code: '11ST_CAT_BEAUTY_SKINCARE',
        name: '스킨케어',
        path: ['화장품/미용', '스킨케어'],
        isLeaf: true,
      },
    ];

    return allCategories.filter((category) => category.name.includes(keyword));
  }

  addMockOrder(order: MarketplaceOrder): void {
    this.mockOrders.push(order);
  }

  clearMockData(): void {
    this.mockProducts.clear();
    this.mockOrders = [];
  }

  private ensureAuthenticated(): void {
    if (!this.credentials) {
      throw new Error('11번가 인증 정보가 설정되지 않았습니다. setCredentials()를 먼저 호출하세요.');
    }
  }

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
 * 11번가 실제 API 어댑터 (향후 구현)
 */
export class ElevenstAdapter implements IMarketplaceAdapter {
  readonly platform = OpenMarketPlatform.STREET11;
  private credentials: MarketplaceCredentials | null = null;

  setCredentials(credentials: MarketplaceCredentials): void {
    this.credentials = credentials;
  }

  async registerProduct(_request: RegisterProductRequest): Promise<RegisterProductResponse> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async updateProduct(_request: UpdateProductRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async updateStock(_request: UpdateStockRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async fetchOrders(_startDate: Date, _endDate: Date): Promise<MarketplaceOrder[]> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async updateOrderStatus(_request: UpdateOrderStatusRequest): Promise<{ success: boolean; error?: string }> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async fetchCategories(_parentCode?: string): Promise<CategoryInfo[]> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }

  async searchCategory(_keyword: string): Promise<CategoryInfo[]> {
    throw new Error('실제 11번가 API 연동이 아직 구현되지 않았습니다');
  }
}

export function createElevenstAdapter(useMock: boolean = true): IMarketplaceAdapter {
  return useMock ? new ElevenstMockAdapter() : new ElevenstAdapter();
}
