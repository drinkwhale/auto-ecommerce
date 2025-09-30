/**
 * OrderService - 주문 처리 비즈니스 로직
 *
 * 이 서비스는 주문 생성, 조회, 수정, 상태 관리 및 주문 관련 핵심 비즈니스 로직을 담당합니다.
 * Phase 3.4: 서비스 계층 구현 - T025
 */

import { PrismaClient, Order, OrderStatus, OrderItem, PurchaseStatus, ShippingStatus, OpenMarketPlatform, Prisma } from '@prisma/client';
import { z } from 'zod';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 오픈마켓 주문 정보 타입
 */
export interface MarketOrderInfo {
  platform: OpenMarketPlatform;
  orderId: string;
  orderDate: Date;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * 원본 구매 정보 타입
 */
export interface SourcePurchaseInfo {
  purchaseId?: string;
  purchaseDate?: Date;
  purchasePrice: number;
  purchaseStatus: PurchaseStatus;
  trackingNumber?: string;
}

/**
 * 고객 주소 정보 타입
 */
export interface CustomerAddress {
  zipCode: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  country: string;
}

/**
 * 고객 정보 타입
 */
export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: CustomerAddress;
  memo?: string;
}

/**
 * 배송 정보 타입
 */
export interface ShippingInfo {
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  status: ShippingStatus;
}

/**
 * 결제 정보 타입
 */
export interface PaymentInfo {
  saleAmount: number;
  costAmount: number;
  shippingFee: number;
  commission: number;
  netProfit: number;
  profitRate: number;
}

/**
 * 주문 생성 입력 데이터 검증 스키마
 */
export const CreateOrderSchema = z.object({
  productId: z.string(),
  marketOrder: z.object({
    platform: z.nativeEnum(OpenMarketPlatform),
    orderId: z.string(),
    orderDate: z.date(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
  }),
  customer: z.object({
    name: z.string().min(1, '고객명은 필수입니다'),
    phone: z.string().min(1, '전화번호는 필수입니다'),
    email: z.string().email().optional(),
    address: z.object({
      zipCode: z.string(),
      address1: z.string(),
      address2: z.string().optional(),
      city: z.string(),
      state: z.string().optional(),
      country: z.string().default('KR'),
    }),
    memo: z.string().optional(),
  }),
  payment: z.object({
    saleAmount: z.number().positive(),
    costAmount: z.number().optional(),
    shippingFee: z.number().default(0),
    commission: z.number().default(0),
  }),
  sourcePurchase: z.object({
    purchaseId: z.string().optional(),
    purchaseDate: z.date().optional(),
    purchasePrice: z.number().positive().optional(),
    purchaseStatus: z.nativeEnum(PurchaseStatus).default(PurchaseStatus.PENDING),
    trackingNumber: z.string().optional(),
  }).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * 주문 업데이트 입력 데이터 검증 스키마
 */
export const UpdateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  sourcePurchase: z.object({
    purchaseId: z.string().optional(),
    purchaseDate: z.date().optional(),
    purchasePrice: z.number().positive().optional(),
    purchaseStatus: z.nativeEnum(PurchaseStatus).optional(),
    trackingNumber: z.string().optional(),
  }).optional(),
  shipping: z.object({
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    shippedAt: z.date().optional(),
    deliveredAt: z.date().optional(),
    status: z.nativeEnum(ShippingStatus).optional(),
  }).optional(),
  payment: z.object({
    costAmount: z.number().optional(),
    shippingFee: z.number().optional(),
    commission: z.number().optional(),
  }).optional(),
});

export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;

/**
 * OrderService 클래스
 */
export class OrderService {
  /**
   * 새로운 주문 생성
   *
   * @param userId 사용자 ID
   * @param input 주문 생성 입력 데이터
   * @returns 생성된 주문 객체
   * @throws 유효성 검증 실패, 상품 없음 등
   */
  async createOrder(userId: string, input: CreateOrderInput): Promise<Order> {
    // 입력 데이터 검증
    const validatedInput = CreateOrderSchema.parse(input);

    // 상품 존재 및 소유권 확인
    const product = await prisma.product.findUnique({
      where: { id: validatedInput.productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    if (product.userId !== userId) {
      throw new Error('상품에 대한 권한이 없습니다');
    }

    // 결제 정보 계산
    const saleAmount = validatedInput.payment.saleAmount;
    const costAmount = validatedInput.payment.costAmount || 0;
    const shippingFee = validatedInput.payment.shippingFee || 0;
    const commission = validatedInput.payment.commission || 0;
    const netProfit = saleAmount - costAmount - shippingFee - commission;
    const profitRate = saleAmount > 0 ? netProfit / saleAmount : 0;

    const paymentInfo: PaymentInfo = {
      saleAmount,
      costAmount,
      shippingFee,
      commission,
      netProfit,
      profitRate,
    };

    // 초기 배송 정보
    const shippingInfo: ShippingInfo = {
      status: ShippingStatus.PREPARING,
    };

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        userId,
        productId: validatedInput.productId,
        marketOrder: validatedInput.marketOrder as Prisma.InputJsonValue,
        customer: validatedInput.customer as Prisma.InputJsonValue,
        payment: paymentInfo as Prisma.InputJsonValue,
        shipping: shippingInfo as Prisma.InputJsonValue,
        sourcePurchase: validatedInput.sourcePurchase as Prisma.InputJsonValue,
        status: OrderStatus.RECEIVED,
      },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return order;
  }

  /**
   * 주문 ID로 조회
   *
   * @param orderId 주문 ID
   * @param userId 사용자 ID (권한 확인용, optional)
   * @returns 주문 객체 또는 null
   */
  async getOrderById(orderId: string, userId?: string): Promise<Order | null> {
    const where: Prisma.OrderWhereInput = { id: orderId };

    // 사용자 ID가 제공된 경우 소유권 확인
    if (userId) {
      where.userId = userId;
    }

    return await prisma.order.findFirst({
      where,
      include: {
        product: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        orderItems: true,
      },
    });
  }

  /**
   * 주문 목록 조회 (페이지네이션 및 필터링)
   *
   * @param options 조회 옵션
   * @returns 주문 목록과 총 개수
   */
  async getOrders(options: {
    userId?: string;
    page?: number;
    limit?: number;
    status?: OrderStatus;
    platform?: OpenMarketPlatform;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'createdAt' | 'updatedAt' | 'completedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    orders: Order[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // 필터 조건 구성
    const where: Prisma.OrderWhereInput = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.platform) {
      where.marketOrder = {
        path: ['platform'],
        equals: options.platform,
      };
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    // 정렬 조건
    const orderBy: Prisma.OrderOrderByWithRelationInput = {};
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    // 총 개수 조회
    const totalCount = await prisma.order.count({ where });

    // 주문 목록 조회
    const orders = await prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        product: {
          select: {
            id: true,
            originalData: true,
            translatedData: true,
          },
        },
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
      orders,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * 주문 정보 업데이트
   *
   * @param orderId 주문 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param input 업데이트할 데이터
   * @returns 업데이트된 주문 객체
   * @throws 주문 없음, 권한 없음, 유효성 검증 실패 등
   */
  async updateOrder(
    orderId: string,
    userId: string,
    input: UpdateOrderInput
  ): Promise<Order> {
    // 입력 데이터 검증
    const validatedInput = UpdateOrderSchema.parse(input);

    // 주문 존재 및 소유권 확인
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new Error('주문을 찾을 수 없습니다');
    }

    if (existingOrder.userId !== userId) {
      throw new Error('주문을 수정할 권한이 없습니다');
    }

    // 업데이트 데이터 구성
    const updateData: Prisma.OrderUpdateInput = {};

    if (validatedInput.status) {
      updateData.status = validatedInput.status;

      // 주문이 완료된 경우 completedAt 설정
      if (validatedInput.status === OrderStatus.DELIVERED ||
          validatedInput.status === OrderStatus.CANCELLED ||
          validatedInput.status === OrderStatus.REFUNDED) {
        updateData.completedAt = new Date();
      }
    }

    if (validatedInput.sourcePurchase) {
      const currentSourcePurchase = (existingOrder.sourcePurchase as SourcePurchaseInfo) || {};
      updateData.sourcePurchase = {
        ...currentSourcePurchase,
        ...validatedInput.sourcePurchase,
      } as Prisma.InputJsonValue;
    }

    if (validatedInput.shipping) {
      const currentShipping = existingOrder.shipping as ShippingInfo;
      updateData.shipping = {
        ...currentShipping,
        ...validatedInput.shipping,
      } as Prisma.InputJsonValue;

      // 배송 완료 시 주문 상태도 업데이트
      if (validatedInput.shipping.status === ShippingStatus.DELIVERED) {
        updateData.status = OrderStatus.DELIVERED;
        updateData.completedAt = new Date();
      }
    }

    if (validatedInput.payment) {
      const currentPayment = existingOrder.payment as PaymentInfo;
      const updatedPayment = {
        ...currentPayment,
        ...validatedInput.payment,
      };

      // 수익 재계산
      updatedPayment.netProfit =
        updatedPayment.saleAmount -
        updatedPayment.costAmount -
        updatedPayment.shippingFee -
        updatedPayment.commission;
      updatedPayment.profitRate =
        updatedPayment.saleAmount > 0
          ? updatedPayment.netProfit / updatedPayment.saleAmount
          : 0;

      updateData.payment = updatedPayment as Prisma.InputJsonValue;
    }

    // 주문 업데이트
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        product: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return updatedOrder;
  }

  /**
   * 주문 상태 업데이트
   *
   * @param orderId 주문 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param status 새로운 상태
   * @returns 업데이트된 주문 객체
   */
  async updateOrderStatus(
    orderId: string,
    userId: string,
    status: OrderStatus
  ): Promise<Order> {
    // 주문 존재 및 소유권 확인
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new Error('주문을 찾을 수 없습니다');
    }

    if (existingOrder.userId !== userId) {
      throw new Error('주문을 수정할 권한이 없습니다');
    }

    const updateData: Prisma.OrderUpdateInput = { status };

    // 완료 상태인 경우 completedAt 설정
    if (status === OrderStatus.DELIVERED ||
        status === OrderStatus.CANCELLED ||
        status === OrderStatus.REFUNDED) {
      updateData.completedAt = new Date();
    }

    // 상태 업데이트
    return await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        product: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 주문 취소
   *
   * @param orderId 주문 ID
   * @param userId 사용자 ID (권한 확인용)
   * @param reason 취소 사유
   * @returns 취소된 주문 객체
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    reason?: string
  ): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('주문을 찾을 수 없습니다');
    }

    if (order.userId !== userId) {
      throw new Error('주문을 취소할 권한이 없습니다');
    }

    // 이미 배송 중이거나 완료된 주문은 취소 불가
    if (order.status === OrderStatus.SHIPPING ||
        order.status === OrderStatus.DELIVERED) {
      throw new Error('배송 중이거나 완료된 주문은 취소할 수 없습니다');
    }

    // 주문 취소
    return await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        completedAt: new Date(),
      },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 사용자의 주문 통계 조회
   *
   * @param userId 사용자 ID
   * @param options 통계 옵션 (기간 등)
   * @returns 주문 통계 정보
   */
  async getUserOrderStatistics(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalOrders: number;
    receivedOrders: number;
    confirmedOrders: number;
    purchasingOrders: number;
    purchasedOrders: number;
    shippingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    totalRevenue: number;
    totalProfit: number;
    averageOrderValue: number;
  }> {
    const where: Prisma.OrderWhereInput = { userId };

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        status: true,
        payment: true,
      },
    });

    const statistics = {
      totalOrders: orders.length,
      receivedOrders: 0,
      confirmedOrders: 0,
      purchasingOrders: 0,
      purchasedOrders: 0,
      shippingOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      totalRevenue: 0,
      totalProfit: 0,
      averageOrderValue: 0,
    };

    orders.forEach((order) => {
      // 상태별 카운트
      switch (order.status) {
        case OrderStatus.RECEIVED:
          statistics.receivedOrders++;
          break;
        case OrderStatus.CONFIRMED:
          statistics.confirmedOrders++;
          break;
        case OrderStatus.PURCHASING:
          statistics.purchasingOrders++;
          break;
        case OrderStatus.PURCHASED:
          statistics.purchasedOrders++;
          break;
        case OrderStatus.SHIPPING:
          statistics.shippingOrders++;
          break;
        case OrderStatus.DELIVERED:
          statistics.deliveredOrders++;
          break;
        case OrderStatus.CANCELLED:
          statistics.cancelledOrders++;
          break;
        case OrderStatus.REFUNDED:
          statistics.refundedOrders++;
          break;
      }

      // 금액 계산 (취소/환불 제외)
      if (order.status !== OrderStatus.CANCELLED &&
          order.status !== OrderStatus.REFUNDED) {
        const payment = order.payment as PaymentInfo;
        statistics.totalRevenue += payment.saleAmount || 0;
        statistics.totalProfit += payment.netProfit || 0;
      }
    });

    // 평균 주문 금액 계산
    const validOrderCount = statistics.totalOrders - statistics.cancelledOrders - statistics.refundedOrders;
    statistics.averageOrderValue = validOrderCount > 0
      ? statistics.totalRevenue / validOrderCount
      : 0;

    return statistics;
  }

  /**
   * 플랫폼별 주문 통계 조회
   *
   * @param userId 사용자 ID
   * @returns 플랫폼별 주문 통계
   */
  async getPlatformOrderStatistics(userId: string): Promise<Array<{
    platform: OpenMarketPlatform;
    orderCount: number;
    revenue: number;
    profit: number;
  }>> {
    const orders = await prisma.order.findMany({
      where: { userId },
      select: {
        marketOrder: true,
        payment: true,
        status: true,
      },
    });

    const platformStats = new Map<OpenMarketPlatform, {
      orderCount: number;
      revenue: number;
      profit: number;
    }>();

    orders.forEach((order) => {
      const marketOrder = order.marketOrder as MarketOrderInfo;
      const payment = order.payment as PaymentInfo;
      const platform = marketOrder.platform;

      if (!platformStats.has(platform)) {
        platformStats.set(platform, {
          orderCount: 0,
          revenue: 0,
          profit: 0,
        });
      }

      const stats = platformStats.get(platform)!;
      stats.orderCount++;

      // 취소/환불이 아닌 경우만 집계
      if (order.status !== OrderStatus.CANCELLED &&
          order.status !== OrderStatus.REFUNDED) {
        stats.revenue += payment.saleAmount || 0;
        stats.profit += payment.netProfit || 0;
      }
    });

    return Array.from(platformStats.entries()).map(([platform, stats]) => ({
      platform,
      ...stats,
    }));
  }

  /**
   * 주문 영구 삭제 (하드 삭제)
   * 관리자 전용 - 주의해서 사용
   *
   * @param orderId 주문 ID
   * @throws 주문 없음
   */
  async permanentlyDeleteOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new Error('주문을 찾을 수 없습니다');
    }

    // 관련 OrderItem 먼저 삭제
    await prisma.orderItem.deleteMany({
      where: { orderId },
    });

    // 하드 삭제
    await prisma.order.delete({
      where: { id: orderId },
    });
  }

  /**
   * 대량 주문 상태 업데이트
   *
   * @param orderIds 주문 ID 목록
   * @param userId 사용자 ID (권한 확인용)
   * @param status 새로운 상태
   * @returns 업데이트된 개수
   */
  async bulkUpdateOrderStatus(
    orderIds: string[],
    userId: string,
    status: OrderStatus
  ): Promise<number> {
    const updateData: Prisma.OrderUpdateManyArgs['data'] = { status };

    // 완료 상태인 경우 completedAt 설정
    if (status === OrderStatus.DELIVERED ||
        status === OrderStatus.CANCELLED ||
        status === OrderStatus.REFUNDED) {
      updateData.completedAt = new Date();
    }

    const result = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        userId, // 소유권 확인
      },
      data: updateData,
    });

    return result.count;
  }
}

// OrderService 싱글톤 인스턴스 export
export const orderService = new OrderService();