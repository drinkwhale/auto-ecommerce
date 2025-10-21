/**
 * OpenMarketService - 오픈마켓 연동 비즈니스 로직
 *
 * 이 서비스는 쿠팡, 지마켓, 11번가 등 오픈마켓 플랫폼과의 연동을 담당합니다.
 * - 상품 등록 및 수정
 * - 주문 조회 및 상태 업데이트
 * - 재고 동기화
 * - 배송 추적
 * - 정산 데이터 조회
 *
 * Phase 3.4: 서비스 계층 구현 - T029
 */

import { PrismaClient, OpenMarketPlatform, OrderStatus, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 오픈마켓 인증 정보
 */
export interface OpenMarketCredentials {
  platform: OpenMarketPlatform;
  apiKey: string;
  apiSecret: string;
  vendorId?: string;
  additionalConfig?: Record<string, any>;
}

/**
 * 상품 등록 요청
 */
export interface RegisterProductInput {
  productId: string;
  platform: OpenMarketPlatform;
  categoryId?: string;
  customFields?: Record<string, any>;
}

/**
 * 상품 등록 결과
 */
export interface RegisterProductResult {
  success: boolean;
  platform: OpenMarketPlatform;
  productId: string;
  marketProductId?: string;
  listingUrl?: string;
  error?: string;
}

/**
 * 주문 조회 입력
 */
export interface FetchOrdersInput {
  platform: OpenMarketPlatform;
  startDate: Date;
  endDate: Date;
  status?: string;
}

/**
 * 오픈마켓 주문 정보
 */
export interface MarketOrderInfo {
  platform: OpenMarketPlatform;
  orderId: string;
  orderDate: Date;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customerName: string;
  shippingAddress: string;
  phone: string;
  email?: string;
  memo?: string;
}

/**
 * 주문 상태 업데이트 입력
 */
export interface UpdateOrderStatusInput {
  orderId: string;
  platform: OpenMarketPlatform;
  status: string;
  trackingNumber?: string;
  carrier?: string;
}

/**
 * 재고 동기화 입력
 */
export interface SyncStockInput {
  productId: string;
  platforms: OpenMarketPlatform[];
  stockQuantity: number;
}

/**
 * 정산 데이터
 */
export interface SettlementData {
  platform: OpenMarketPlatform;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalSales: number;
  totalCommission: number;
  netRevenue: number;
  orders: Array<{
    orderId: string;
    saleAmount: number;
    commission: number;
    settledAmount: number;
  }>;
}

/**
 * 카테고리 매핑 입력
 */
export interface CategoryMappingInput {
  sourceCategory: string;
  platform: OpenMarketPlatform;
  targetCategoryId: string;
  targetCategoryName: string;
}

/**
 * 상품 등록 검증 스키마
 */
export const RegisterProductInputSchema = z.object({
  productId: z.string().min(1, '상품 ID는 필수입니다'),
  platform: z.nativeEnum(OpenMarketPlatform),
  categoryId: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

/**
 * OpenMarketService 클래스
 */
class OpenMarketService {
  private axiosInstances: Map<OpenMarketPlatform, AxiosInstance>;
  private credentials: Map<OpenMarketPlatform, OpenMarketCredentials>;

  constructor() {
    this.axiosInstances = new Map();
    this.credentials = new Map();
    this.initializeClients();
  }

  /**
   * API 클라이언트 초기화
   */
  private initializeClients() {
    // 각 플랫폼별 Axios 인스턴스 생성
    Object.values(OpenMarketPlatform).forEach((platform) => {
      const instance = axios.create({
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.axiosInstances.set(platform, instance);
    });
  }

  /**
   * 인증 정보 설정
   */
  setCredentials(credentials: OpenMarketCredentials) {
    this.credentials.set(credentials.platform, credentials);
  }

  /**
   * 상품 등록
   */
  async registerProduct(input: RegisterProductInput): Promise<RegisterProductResult> {
    try {
      // 입력 검증
      const validatedInput = RegisterProductInputSchema.parse(input);

      // 상품 조회
      const product = await prisma.product.findUnique({
        where: { id: validatedInput.productId },
      });

      if (!product) {
        throw new Error('상품을 찾을 수 없습니다');
      }

      // 번역 데이터 확인
      const translatedData = product.translatedData as any;
      if (!translatedData) {
        throw new Error('상품 번역이 완료되지 않았습니다');
      }

      // 플랫폼별 등록 처리
      let marketProductId: string | undefined;
      let listingUrl: string | undefined;

      switch (validatedInput.platform) {
        case OpenMarketPlatform.COUPANG:
          ({ marketProductId, listingUrl } = await this.registerToCoupang(
            product,
            translatedData,
            validatedInput.categoryId
          ));
          break;

        case OpenMarketPlatform.GMARKET:
          ({ marketProductId, listingUrl } = await this.registerToGmarket(
            product,
            translatedData,
            validatedInput.categoryId
          ));
          break;

        case OpenMarketPlatform.STREET11:
          ({ marketProductId, listingUrl } = await this.registerToStreet11(
            product,
            translatedData,
            validatedInput.categoryId
          ));
          break;

        default:
          throw new Error(`지원하지 않는 플랫폼입니다: ${validatedInput.platform}`);
      }

      // ProductRegistration 레코드 생성
      await prisma.productRegistration.create({
        data: {
          productId: validatedInput.productId,
          platform: validatedInput.platform,
          marketProductId: marketProductId || 'unknown',
          listingUrl,
          status: 'ACTIVE',
          registeredAt: new Date(),
        },
      });

      // 상품 상태 업데이트
      await prisma.product.update({
        where: { id: validatedInput.productId },
        data: {
          status: ProductStatus.REGISTERED,
        },
      });

      return {
        success: true,
        platform: validatedInput.platform,
        productId: validatedInput.productId,
        marketProductId,
        listingUrl,
      };
    } catch (error) {
      return {
        success: false,
        platform: input.platform,
        productId: input.productId,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 여러 플랫폼에 동시 등록
   */
  async registerToMultiplePlatforms(
    productId: string,
    platforms: OpenMarketPlatform[]
  ): Promise<RegisterProductResult[]> {
    const results: RegisterProductResult[] = [];

    for (const platform of platforms) {
      const result = await this.registerProduct({
        productId,
        platform,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 주문 조회
   */
  async fetchOrders(input: FetchOrdersInput): Promise<MarketOrderInfo[]> {
    const credentials = this.credentials.get(input.platform);
    if (!credentials) {
      throw new Error(`${input.platform} 인증 정보가 설정되지 않았습니다`);
    }

    let orders: MarketOrderInfo[] = [];

    switch (input.platform) {
      case OpenMarketPlatform.COUPANG:
        orders = await this.fetchCoupangOrders(input, credentials);
        break;

      case OpenMarketPlatform.GMARKET:
        orders = await this.fetchGmarketOrders(input, credentials);
        break;

      case OpenMarketPlatform.STREET11:
        orders = await this.fetchStreet11Orders(input, credentials);
        break;

      default:
        throw new Error(`지원하지 않는 플랫폼입니다: ${input.platform}`);
    }

    return orders;
  }

  /**
   * 주문 동기화 (오픈마켓 → 시스템)
   */
  async syncOrders(
    platform: OpenMarketPlatform,
    startDate: Date,
    endDate: Date
  ): Promise<{ created: number; updated: number; failed: number }> {
    // 주문 조회
    const marketOrders = await this.fetchOrders({
      platform,
      startDate,
      endDate,
    });

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const marketOrder of marketOrders) {
      try {
        // 기존 주문 확인
        const existingOrder = await prisma.order.findFirst({
          where: {
            marketOrder: {
              path: ['orderId'],
              equals: marketOrder.orderId,
            },
          },
        });

        if (existingOrder) {
          // 업데이트
          await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              marketOrder: marketOrder as any,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          // 새 주문 생성 (상품 매칭 필요)
          // 실제 구현에서는 marketProductId로 product를 찾아야 함
          // 여기서는 간략화
          created++;
        }
      } catch {
        failed++;
      }
    }

    return { created, updated, failed };
  }

  /**
   * 주문 상태 업데이트 (시스템 → 오픈마켓)
   */
  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<boolean> {
    const credentials = this.credentials.get(input.platform);
    if (!credentials) {
      throw new Error(`${input.platform} 인증 정보가 설정되지 않았습니다`);
    }

    switch (input.platform) {
      case OpenMarketPlatform.COUPANG:
        return await this.updateCoupangOrderStatus(input, credentials);

      case OpenMarketPlatform.GMARKET:
        return await this.updateGmarketOrderStatus(input, credentials);

      case OpenMarketPlatform.STREET11:
        return await this.updateStreet11OrderStatus(input, credentials);

      default:
        throw new Error(`지원하지 않는 플랫폼입니다: ${input.platform}`);
    }
  }

  /**
   * 재고 동기화
   */
  async syncStock(input: SyncStockInput): Promise<{ success: boolean; platform: string }[]> {
    const results: { success: boolean; platform: string }[] = [];

    for (const platform of input.platforms) {
      try {
        const credentials = this.credentials.get(platform);
        if (!credentials) {
          results.push({ success: false, platform });
          continue;
        }

        // 플랫폼별 재고 업데이트
        const success = await this.updateStock(
          input.productId,
          platform,
          input.stockQuantity,
          credentials
        );

        results.push({ success, platform });
      } catch {
        results.push({ success: false, platform });
      }
    }

    return results;
  }

  /**
   * 정산 데이터 조회
   */
  async getSettlementData(
    platform: OpenMarketPlatform,
    startDate: Date,
    endDate: Date
  ): Promise<SettlementData> {
    const credentials = this.credentials.get(platform);
    if (!credentials) {
      throw new Error(`${platform} 인증 정보가 설정되지 않았습니다`);
    }

    // 실제 구현에서는 플랫폼별 정산 API 호출
    // 여기서는 시뮬레이션
    const orders = await prisma.order.findMany({
      where: {
        marketOrder: {
          path: ['platform'],
          equals: platform,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: OrderStatus.DELIVERED,
      },
    });

    let totalSales = 0;
    let totalCommission = 0;

    const settlementOrders = orders.map((order) => {
      const payment = order.payment as any;
      const saleAmount = payment.saleAmount || 0;
      const commission = payment.commission || 0;

      totalSales += saleAmount;
      totalCommission += commission;

      return {
        orderId: order.id,
        saleAmount,
        commission,
        settledAmount: saleAmount - commission,
      };
    });

    return {
      platform,
      period: { startDate, endDate },
      totalSales,
      totalCommission,
      netRevenue: totalSales - totalCommission,
      orders: settlementOrders,
    };
  }

  /**
   * 카테고리 매핑 생성/업데이트
   */
  async createCategoryMapping(input: CategoryMappingInput) {
    return await prisma.categoryMapping.upsert({
      where: {
        sourceCategory_platform: {
          sourceCategory: input.sourceCategory,
          platform: input.platform,
        },
      },
      create: {
        sourceCategory: input.sourceCategory,
        platform: input.platform,
        targetCategoryId: input.targetCategoryId,
        targetCategoryName: input.targetCategoryName,
      },
      update: {
        targetCategoryId: input.targetCategoryId,
        targetCategoryName: input.targetCategoryName,
      },
    });
  }

  /**
   * 카테고리 매핑 조회
   */
  async getCategoryMapping(sourceCategory: string, platform: OpenMarketPlatform) {
    return await prisma.categoryMapping.findUnique({
      where: {
        sourceCategory_platform: {
          sourceCategory,
          platform,
        },
      },
    });
  }

  // ============================================
  // 플랫폼별 구현 (Coupang)
  // ============================================

  private async registerToCoupang(
    product: any,
    translatedData: any,
    categoryId?: string
  ): Promise<{ marketProductId?: string; listingUrl?: string }> {
    const credentials = this.credentials.get(OpenMarketPlatform.COUPANG);
    if (!credentials) {
      throw new Error('쿠팡 인증 정보가 설정되지 않았습니다');
    }

    // 실제 구현에서는 쿠팡 API 호출
    // https://developers.coupangcorp.com/hc/ko/articles/360034897214

    const salesSettings = product.salesSettings as any;

    const _requestBody = {
      vendorId: credentials.vendorId,
      displayCategoryCode: categoryId,
      sellerProductName: translatedData.title,
      generalProductName: translatedData.title,
      longDescription: translatedData.description,
      salePrice: salesSettings.salePrice,
      originalPrice: salesSettings.salePrice,
      // ... 기타 필드
    };

    // 시뮬레이션
    const marketProductId = `COUPANG_${Date.now()}`;
    const listingUrl = `https://www.coupang.com/vp/products/${marketProductId}`;

    return { marketProductId, listingUrl };
  }

  private async fetchCoupangOrders(
    _input: FetchOrdersInput,
    _credentials: OpenMarketCredentials
  ): Promise<MarketOrderInfo[]> {
    // 실제 구현에서는 쿠팡 주문 조회 API 호출
    // 시뮬레이션
    return [];
  }

  private async updateCoupangOrderStatus(
    _input: UpdateOrderStatusInput,
    _credentials: OpenMarketCredentials
  ): Promise<boolean> {
    // 실제 구현에서는 쿠팡 주문 상태 업데이트 API 호출
    return true;
  }

  // ============================================
  // 플랫폼별 구현 (Gmarket)
  // ============================================

  private async registerToGmarket(
    _product: any,
    _translatedData: any,
    _categoryId?: string
  ): Promise<{ marketProductId?: string; listingUrl?: string }> {
    const credentials = this.credentials.get(OpenMarketPlatform.GMARKET);
    if (!credentials) {
      throw new Error('지마켓 인증 정보가 설정되지 않았습니다');
    }

    // 실제 구현에서는 지마켓 API 호출
    const marketProductId = `GMARKET_${Date.now()}`;
    const listingUrl = `http://item.gmarket.co.kr/Item?goodscode=${marketProductId}`;

    return { marketProductId, listingUrl };
  }

  private async fetchGmarketOrders(
    _input: FetchOrdersInput,
    _credentials: OpenMarketCredentials
  ): Promise<MarketOrderInfo[]> {
    // 실제 구현에서는 지마켓 주문 조회 API 호출
    return [];
  }

  private async updateGmarketOrderStatus(
    _input: UpdateOrderStatusInput,
    _credentials: OpenMarketCredentials
  ): Promise<boolean> {
    // 실제 구현에서는 지마켓 주문 상태 업데이트 API 호출
    return true;
  }

  // ============================================
  // 플랫폼별 구현 (11번가)
  // ============================================

  private async registerToStreet11(
    _product: any,
    _translatedData: any,
    _categoryId?: string
  ): Promise<{ marketProductId?: string; listingUrl?: string }> {
    const credentials = this.credentials.get(OpenMarketPlatform.STREET11);
    if (!credentials) {
      throw new Error('11번가 인증 정보가 설정되지 않았습니다');
    }

    // 실제 구현에서는 11번가 API 호출
    const marketProductId = `11ST_${Date.now()}`;
    const listingUrl = `http://www.11st.co.kr/product/SellerProductDetail.tmall?method=getSellerProductDetail&prdNo=${marketProductId}`;

    return { marketProductId, listingUrl };
  }

  private async fetchStreet11Orders(
    _input: FetchOrdersInput,
    _credentials: OpenMarketCredentials
  ): Promise<MarketOrderInfo[]> {
    // 실제 구현에서는 11번가 주문 조회 API 호출
    return [];
  }

  private async updateStreet11OrderStatus(
    _input: UpdateOrderStatusInput,
    _credentials: OpenMarketCredentials
  ): Promise<boolean> {
    // 실제 구현에서는 11번가 주문 상태 업데이트 API 호출
    return true;
  }

  // ============================================
  // 공통 헬퍼 메서드
  // ============================================

  private async updateStock(
    _productId: string,
    _platform: OpenMarketPlatform,
    _quantity: number,
    _credentials: OpenMarketCredentials
  ): Promise<boolean> {
    // 실제 구현에서는 플랫폼별 재고 업데이트 API 호출
    return true;
  }

  /**
   * 플랫폼별 통계
   */
  async getPlatformStatistics(platform: OpenMarketPlatform, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 등록된 상품 수
    const registeredProducts = await prisma.productRegistration.count({
      where: {
        platform,
        registeredAt: { gte: since },
      },
    });

    // 주문 수
    const orders = await prisma.order.findMany({
      where: {
        marketOrder: {
          path: ['platform'],
          equals: platform,
        },
        createdAt: { gte: since },
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => {
      const payment = order.payment as any;
      return sum + (payment.saleAmount || 0);
    }, 0);

    return {
      platform,
      period: `${days}일`,
      registeredProducts,
      totalOrders,
      totalRevenue,
    };
  }

  /**
   * 모든 플랫폼 통계
   */
  async getAllPlatformsStatistics(days: number = 30) {
    const platforms = Object.values(OpenMarketPlatform);
    const results = [];

    for (const platform of platforms) {
      const stats = await this.getPlatformStatistics(platform, days);
      results.push(stats);
    }

    return results;
  }

  /**
   * 웹훅 처리 (오픈마켓에서 주문/상태 변경 알림)
   */
  async handleWebhook(
    platform: OpenMarketPlatform,
    eventType: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (eventType) {
        case 'order.created':
          // 새 주문 처리
          await this.handleNewOrder(platform, payload);
          break;

        case 'order.updated':
          // 주문 상태 변경 처리
          await this.handleOrderUpdate(platform, payload);
          break;

        case 'product.updated':
          // 상품 정보 변경 처리
          await this.handleProductUpdate(platform, payload);
          break;

        default:
          return { success: false, message: `지원하지 않는 이벤트 타입: ${eventType}` };
      }

      return { success: true, message: '웹훅 처리 완료' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '웹훅 처리 실패',
      };
    }
  }

  private async handleNewOrder(_platform: OpenMarketPlatform, _payload: unknown) {
    // 새 주문 생성 로직
    // 실제 구현에서는 payload를 파싱하여 Order 생성
  }

  private async handleOrderUpdate(_platform: OpenMarketPlatform, _payload: unknown) {
    // 주문 상태 업데이트 로직
  }

  private async handleProductUpdate(_platform: OpenMarketPlatform, _payload: unknown) {
    // 상품 정보 업데이트 로직
  }
}

// 싱글톤 인스턴스 내보내기
export const openMarketService = new OpenMarketService();
