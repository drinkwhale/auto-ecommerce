/**
 * ProductService - 상품 관리 비즈니스 로직
 *
 * 이 서비스는 상품 생성, 조회, 수정, 삭제 및 상품 관련 핵심 비즈니스 로직을 담당합니다.
 * Phase 3.4: 서비스 계층 구현 - T024
 */

import { PrismaClient, Product, ProductStatus, SourcePlatform, OpenMarketPlatform, Prisma } from '@prisma/client';
import { z } from 'zod';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 상품 원본 정보 타입
 */
export interface ProductSourceInfo {
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  sourceProductId: string;
  lastCrawledAt?: Date;
}

/**
 * 상품 가격 정보 타입
 */
export interface ProductPrice {
  amount: number;
  currency: string;
  originalAmount?: number;
}

/**
 * 상품 이미지 정보 타입
 */
export interface ProductImageInfo {
  id?: string;
  originalUrl: string;
  processedImages?: Array<{
    size: string;
    url: string;
    width: number;
    height: number;
    format: string;
  }>;
  metadata?: {
    mimeType?: string;
    fileSize?: number;
    dimensions?: { width: number; height: number };
    dominantColors?: string[];
    hasWatermark?: boolean;
  };
  status?: string;
}

/**
 * 상품 원본 데이터 타입
 */
export interface ProductOriginalData {
  title: string;
  description?: string;
  price: ProductPrice;
  images?: ProductImageInfo[];
  specifications?: Record<string, any>;
  category?: string;
  brand?: string;
  model?: string;
  tags?: string[];
}

/**
 * 상품 번역 데이터 타입
 */
export interface ProductTranslatedData {
  title: string;
  description?: string;
  specifications?: Record<string, any>;
  translatedAt: Date;
  translationEngine: string;
  qualityScore: number;
}

/**
 * 상품 판매 설정 타입
 */
export interface ProductSalesSettings {
  marginRate: number;
  salePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  targetMarkets: OpenMarketPlatform[];
  autoUpdate: boolean;
}

/**
 * 상품 모니터링 정보 타입
 */
export interface ProductMonitoring {
  isActive: boolean;
  lastCheckedAt?: Date;
  priceHistory?: Array<{
    price: number;
    currency: string;
    timestamp: Date;
    source: string;
  }>;
  stockStatus?: {
    isInStock: boolean;
    quantity?: number;
    lastUpdated: Date;
  };
  alerts?: Array<{
    id: string;
    type: string;
    message: string;
    severity: string;
    isRead: boolean;
    createdAt: Date;
  }>;
}

/**
 * 상품 통계 정보 타입
 */
export interface ProductStatistics {
  totalOrders?: number;
  totalRevenue?: number;
  totalProfit?: number;
  profitRate?: number;
  averageOrderValue?: number;
  conversionRate?: number;
}

/**
 * 상품 생성 입력 데이터 검증 스키마
 */
export const CreateProductSchema = z.object({
  sourceInfo: z.object({
    sourceUrl: z.string().url('유효한 URL을 입력해주세요'),
    sourcePlatform: z.nativeEnum(SourcePlatform),
    sourceProductId: z.string(),
    lastCrawledAt: z.date().optional(),
  }),
  originalData: z.object({
    title: z.string().min(1, '상품명은 필수입니다'),
    description: z.string().optional(),
    price: z.object({
      amount: z.number().positive('가격은 0보다 커야 합니다'),
      currency: z.string().default('USD'),
      originalAmount: z.number().optional(),
    }),
    images: z.array(z.object({
      originalUrl: z.string().url(),
    })).optional(),
    specifications: z.record(z.any()).optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  salesSettings: z.object({
    marginRate: z.number().min(0).max(10, '마진율은 0~1000% 사이여야 합니다'),
    salePrice: z.number().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    targetMarkets: z.array(z.nativeEnum(OpenMarketPlatform)),
    autoUpdate: z.boolean().default(true),
  }),
  translatedData: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    specifications: z.record(z.any()).optional(),
    translatedAt: z.date().optional(),
    translationEngine: z.string().optional(),
    qualityScore: z.number().optional(),
  }).optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * 상품 업데이트 입력 데이터 검증 스키마
 */
export const UpdateProductSchema = z.object({
  originalData: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    price: z.object({
      amount: z.number().positive().optional(),
      currency: z.string().optional(),
      originalAmount: z.number().optional(),
    }).optional(),
    specifications: z.record(z.any()).optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  translatedData: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    specifications: z.record(z.any()).optional(),
    translatedAt: z.date().optional(),
    translationEngine: z.string().optional(),
    qualityScore: z.number().optional(),
  }).optional(),
  salesSettings: z.object({
    marginRate: z.number().min(0).max(10).optional(),
    salePrice: z.number().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    targetMarkets: z.array(z.nativeEnum(OpenMarketPlatform)).optional(),
    autoUpdate: z.boolean().optional(),
  }).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * ProductService 클래스
 */
export class ProductService {
  /**
   * 새로운 상품 생성
   *
   * @param userId 사용자 ID
   * @param input 상품 생성 입력 데이터
   * @returns 생성된 상품 객체
   * @throws 유효성 검증 실패 등
   */
  async createProduct(userId: string, input: CreateProductInput): Promise<Product> {
    // 입력 데이터 검증
    const validatedInput = CreateProductSchema.parse(input);

    // 판매 가격 계산 (마진율 적용)
    const originalPrice = validatedInput.originalData.price.amount;
    const marginRate = validatedInput.salesSettings.marginRate;
    const calculatedSalePrice = originalPrice * (1 + marginRate);

    const salesSettings: ProductSalesSettings = {
      ...validatedInput.salesSettings,
      salePrice: validatedInput.salesSettings.salePrice || calculatedSalePrice,
      minPrice: validatedInput.salesSettings.minPrice || originalPrice,
      maxPrice: validatedInput.salesSettings.maxPrice || calculatedSalePrice * 1.5,
    };

    // 상품 생성
    const product = await prisma.product.create({
      data: {
        userId,
        sourceInfo: validatedInput.sourceInfo as Prisma.InputJsonValue,
        originalData: validatedInput.originalData as Prisma.InputJsonValue,
        salesSettings: salesSettings as Prisma.InputJsonValue,
        translatedData: validatedInput.translatedData as Prisma.InputJsonValue,
        status: ProductStatus.DRAFT,
        monitoring: {
          isActive: false,
          lastCheckedAt: null,
        } as Prisma.InputJsonValue,
        statistics: {
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
        } as Prisma.InputJsonValue,
      },
    });

    return product;
  }

  /**
   * 상품 ID로 조회
   *
   * @param productId 상품 ID
   * @param userId 사용자 ID (권한 확인용, optional)
   * @returns 상품 객체 또는 null
   */
  async getProductById(productId: string, userId?: string): Promise<Product | null> {
    const where: Prisma.ProductWhereInput = { id: productId };

    // 사용자 ID가 제공된 경우 소유권 확인
    if (userId) {
      where.userId = userId;
    }

    return await prisma.product.findUnique({
      where: { id: productId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        images: true,
        registrations: true,
      },
    });
  }

  /**
   * 상품 목록 조회 (페이지네이션 및 필터링)
   *
   * @param options 조회 옵션
   * @returns 상품 목록과 총 개수
   */
  async getProducts(options: {
    userId?: string;
    page?: number;
    limit?: number;
    status?: ProductStatus;
    sourcePlatform?: SourcePlatform;
    searchQuery?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'price';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    products: Product[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: Prisma.ProductWhereInput = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.sourcePlatform) {
      where.sourceInfo = {
        path: ['sourcePlatform'],
        equals: options.sourcePlatform,
      };
    }

    if (options.searchQuery) {
      where.OR = [
        {
          originalData: {
            path: ['title'],
            string_contains: options.searchQuery,
          },
        },
        {
          translatedData: {
            path: ['title'],
            string_contains: options.searchQuery,
          },
        },
      ];
    }

    // 정렬 조건
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      orderBy[sortBy] = sortOrder;
    }

    // 총 개수 조회
    const totalCount = await prisma.product.count({ where });

    // 상품 목록 조회
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      products,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * 상품 정보 업데이트
   *
   * @param productId 상품 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param input 업데이트할 데이터
   * @returns 업데이트된 상품 객체
   * @throws 상품 없음, 권한 없음, 유효성 검증 실패 등
   */
  async updateProduct(
    productId: string,
    userId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    // 입력 데이터 검증
    const validatedInput = UpdateProductSchema.parse(input);

    // 상품 존재 및 소유권 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (existingProduct.userId !== userId) {
      throw new Error('상품을 수정할 권한이 없습니다');
    }

    // 업데이트 데이터 구성
    const updateData: Prisma.ProductUpdateInput = {};

    if (validatedInput.originalData) {
      const currentOriginalData = existingProduct.originalData as ProductOriginalData;
      updateData.originalData = {
        ...currentOriginalData,
        ...validatedInput.originalData,
      } as Prisma.InputJsonValue;
    }

    if (validatedInput.translatedData) {
      const currentTranslatedData = (existingProduct.translatedData as ProductTranslatedData) || {};
      updateData.translatedData = {
        ...currentTranslatedData,
        ...validatedInput.translatedData,
      } as Prisma.InputJsonValue;
    }

    if (validatedInput.salesSettings) {
      const currentSalesSettings = existingProduct.salesSettings as ProductSalesSettings;

      // 마진율이 변경된 경우 판매 가격 재계산
      if (validatedInput.salesSettings.marginRate !== undefined) {
        const originalData = existingProduct.originalData as ProductOriginalData;
        const newMarginRate = validatedInput.salesSettings.marginRate;
        const newSalePrice = originalData.price.amount * (1 + newMarginRate);
        validatedInput.salesSettings.salePrice = newSalePrice;
      }

      updateData.salesSettings = {
        ...currentSalesSettings,
        ...validatedInput.salesSettings,
      } as Prisma.InputJsonValue;
    }

    if (validatedInput.status) {
      updateData.status = validatedInput.status;
    }

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    return updatedProduct;
  }

  /**
   * 상품 상태 업데이트
   *
   * @param productId 상품 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param status 새로운 상태
   * @returns 업데이트된 상품 객체
   */
  async updateProductStatus(
    productId: string,
    userId: string,
    status: ProductStatus
  ): Promise<Product> {
    // 상품 존재 및 소유권 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (existingProduct.userId !== userId) {
      throw new Error('상품을 수정할 권한이 없습니다');
    }

    // 상태 업데이트
    return await prisma.product.update({
      where: { id: productId },
      data: { status },
    });
  }

  /**
   * 상품 삭제 (소프트 삭제 - 상태를 ARCHIVED로 변경)
   *
   * @param productId 상품 ID
   * @param userId 사용자 ID (권한 확인용)
   * @throws 상품 없음, 권한 없음
   */
  async deleteProduct(productId: string, userId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (product.userId !== userId) {
      throw new Error('상품을 삭제할 권한이 없습니다');
    }

    // 소프트 삭제 (상태를 ARCHIVED로 변경)
    await prisma.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
    });
  }

  /**
   * 상품 영구 삭제 (하드 삭제)
   * 관리자 전용 - 주의해서 사용
   *
   * @param productId 상품 ID
   * @throws 상품 없음, 관련 데이터 존재 시 외래키 제약 위반
   */
  async permanentlyDeleteProduct(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        orders: true,
        images: true,
        registrations: true,
      },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    // 관련 데이터가 있는 경우 경고
    if (product.orders.length > 0) {
      throw new Error(
        `상품에 ${product.orders.length}개의 주문이 있습니다. 먼저 관련 데이터를 처리해주세요.`
      );
    }

    // 관련 데이터 먼저 삭제
    await prisma.productImage.deleteMany({
      where: { productId },
    });

    await prisma.productRegistration.deleteMany({
      where: { productId },
    });

    // 하드 삭제
    await prisma.product.delete({
      where: { id: productId },
    });
  }

  /**
   * 상품 통계 업데이트
   *
   * @param productId 상품 ID
   * @param statistics 통계 정보
   */
  async updateProductStatistics(
    productId: string,
    statistics: Partial<ProductStatistics>
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    const currentStatistics = (product.statistics as ProductStatistics) || {};
    const updatedStatistics = {
      ...currentStatistics,
      ...statistics,
    };

    await prisma.product.update({
      where: { id: productId },
      data: {
        statistics: updatedStatistics as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 상품 모니터링 설정
   *
   * @param productId 상품 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param monitoring 모니터링 설정
   */
  async updateProductMonitoring(
    productId: string,
    userId: string,
    monitoring: Partial<ProductMonitoring>
  ): Promise<Product> {
    // 상품 존재 및 소유권 확인
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (existingProduct.userId !== userId) {
      throw new Error('상품을 수정할 권한이 없습니다');
    }

    const currentMonitoring = (existingProduct.monitoring as ProductMonitoring) || {
      isActive: false,
    };
    const updatedMonitoring = {
      ...currentMonitoring,
      ...monitoring,
    };

    return await prisma.product.update({
      where: { id: productId },
      data: {
        monitoring: updatedMonitoring as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 사용자의 상품 통계 조회
   *
   * @param userId 사용자 ID
   * @returns 상품 통계 정보
   */
  async getUserProductStatistics(userId: string): Promise<{
    totalProducts: number;
    draftProducts: number;
    processingProducts: number;
    readyProducts: number;
    registeredProducts: number;
    errorProducts: number;
    archivedProducts: number;
  }> {
    const products = await prisma.product.findMany({
      where: { userId },
      select: { status: true },
    });

    const statistics = {
      totalProducts: products.length,
      draftProducts: 0,
      processingProducts: 0,
      readyProducts: 0,
      registeredProducts: 0,
      errorProducts: 0,
      archivedProducts: 0,
    };

    products.forEach((product) => {
      switch (product.status) {
        case ProductStatus.DRAFT:
          statistics.draftProducts++;
          break;
        case ProductStatus.PROCESSING:
          statistics.processingProducts++;
          break;
        case ProductStatus.READY:
          statistics.readyProducts++;
          break;
        case ProductStatus.REGISTERED:
          statistics.registeredProducts++;
          break;
        case ProductStatus.ERROR:
          statistics.errorProducts++;
          break;
        case ProductStatus.ARCHIVED:
          statistics.archivedProducts++;
          break;
      }
    });

    return statistics;
  }

  /**
   * 상품 복제
   *
   * @param productId 원본 상품 ID
   * @param userId 사용자 ID (권한 확인용)
   * @returns 복제된 상품 객체
   */
  async duplicateProduct(productId: string, userId: string): Promise<Product> {
    // 원본 상품 조회 및 소유권 확인
    const originalProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!originalProduct) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (originalProduct.userId !== userId) {
      throw new Error('상품을 복제할 권한이 없습니다');
    }

    // 원본 데이터 복사하여 새 상품 생성
    const duplicatedProduct = await prisma.product.create({
      data: {
        userId,
        sourceInfo: originalProduct.sourceInfo,
        originalData: originalProduct.originalData,
        translatedData: originalProduct.translatedData,
        salesSettings: originalProduct.salesSettings,
        monitoring: {
          isActive: false,
          lastCheckedAt: null,
        } as Prisma.InputJsonValue,
        statistics: {
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
        } as Prisma.InputJsonValue,
        status: ProductStatus.DRAFT,
      },
    });

    return duplicatedProduct;
  }

  /**
   * 대량 상품 상태 업데이트
   *
   * @param productIds 상품 ID 목록
   * @param userId 사용자 ID (권한 확인용)
   * @param status 새로운 상태
   * @returns 업데이트된 개수
   */
  async bulkUpdateProductStatus(
    productIds: string[],
    userId: string,
    status: ProductStatus
  ): Promise<number> {
    const result = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        userId, // 소유권 확인
      },
      data: { status },
    });

    return result.count;
  }
}

// ProductService 싱글톤 인스턴스 export
export const productService = new ProductService();