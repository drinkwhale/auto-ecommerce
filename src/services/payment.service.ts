/**
 * PaymentService - 결제 처리 비즈니스 로직
 *
 * 이 서비스는 결제 처리, 환불, 정산 등 금융 거래를 담당합니다.
 * - 결제 처리 (PG사 연동)
 * - 환불 처리
 * - 결제 내역 조회
 * - 정산 관리
 * - 가상계좌 발급
 *
 * Phase 3.4: 서비스 계층 구현 - T030
 */

import { PrismaClient, Order, OrderStatus } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 결제 제공자
 */
export enum PaymentProvider {
  TOSS = 'TOSS', // 토스페이먼츠
  STRIPE = 'STRIPE', // Stripe
  PAYPAL = 'PAYPAL', // PayPal
  IAMPORT = 'IAMPORT', // 아임포트
}

/**
 * 결제 방법
 */
export enum PaymentMethod {
  CARD = 'CARD', // 신용/체크카드
  BANK_TRANSFER = 'BANK_TRANSFER', // 계좌이체
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT', // 가상계좌
  MOBILE = 'MOBILE', // 휴대폰 결제
  PAYPAL = 'PAYPAL', // 페이팔
}

/**
 * 결제 상태
 */
export enum PaymentStatus {
  PENDING = 'PENDING', // 대기 중
  COMPLETED = 'COMPLETED', // 완료
  FAILED = 'FAILED', // 실패
  CANCELLED = 'CANCELLED', // 취소
  REFUNDED = 'REFUNDED', // 환불
  PARTIAL_REFUNDED = 'PARTIAL_REFUNDED', // 부분 환불
}

/**
 * 결제 요청 입력
 */
export interface ProcessPaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  provider?: PaymentProvider;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  additionalData?: Record<string, any>;
}

/**
 * 결제 결과
 */
export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  paidAt?: Date;
  method: PaymentMethod;
  provider: PaymentProvider;
  error?: string;
  receiptUrl?: string;
}

/**
 * 환불 요청 입력
 */
export interface RefundInput {
  paymentId: string;
  amount?: number; // 부분 환불 시 금액 (없으면 전액)
  reason: string;
}

/**
 * 환불 결과
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  refundedAt?: Date;
  status: PaymentStatus;
  error?: string;
}

/**
 * 가상계좌 발급 입력
 */
export interface CreateVirtualAccountInput {
  orderId: string;
  amount: number;
  customerName: string;
  bankCode?: string;
  expiresAt?: Date;
}

/**
 * 가상계좌 정보
 */
export interface VirtualAccountInfo {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountHolder: string;
  amount: number;
  expiresAt: Date;
}

/**
 * 정산 정보
 */
export interface SettlementInfo {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalAmount: number;
  commission: number;
  netAmount: number;
  payments: Array<{
    paymentId: string;
    orderId: string;
    amount: number;
    commission: number;
    netAmount: number;
    paidAt: Date;
  }>;
}

/**
 * 결제 요청 검증 스키마
 */
export const ProcessPaymentInputSchema = z.object({
  orderId: z.string().min(1, '주문 ID는 필수입니다'),
  amount: z.number().min(0, '결제 금액은 0 이상이어야 합니다'),
  method: z.nativeEnum(PaymentMethod),
  provider: z.nativeEnum(PaymentProvider).optional(),
  customerInfo: z.object({
    name: z.string().min(1, '고객 이름은 필수입니다'),
    email: z.string().email('유효한 이메일을 입력해주세요'),
    phone: z.string().min(1, '전화번호는 필수입니다'),
  }),
  additionalData: z.record(z.any()).optional(),
});

/**
 * 환불 요청 검증 스키마
 */
export const RefundInputSchema = z.object({
  paymentId: z.string().min(1, '결제 ID는 필수입니다'),
  amount: z.number().min(0).optional(),
  reason: z.string().min(1, '환불 사유는 필수입니다'),
});

/**
 * PaymentService 클래스
 */
class PaymentService {
  private axiosInstances: Map<PaymentProvider, AxiosInstance>;
  private readonly defaultProvider = PaymentProvider.TOSS;

  constructor() {
    this.axiosInstances = new Map();
    this.initializeClients();
  }

  /**
   * API 클라이언트 초기화
   */
  private initializeClients() {
    // Toss Payments
    this.axiosInstances.set(
      PaymentProvider.TOSS,
      axios.create({
        baseURL: 'https://api.tosspayments.com/v1',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    // Stripe
    this.axiosInstances.set(
      PaymentProvider.STRIPE,
      axios.create({
        baseURL: 'https://api.stripe.com/v1',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    );

    // 기타 제공자들...
  }

  /**
   * 결제 처리
   */
  async processPayment(input: ProcessPaymentInput): Promise<PaymentResult> {
    try {
      // 입력 검증
      const validatedInput = ProcessPaymentInputSchema.parse(input);

      // 주문 조회
      const order = await prisma.order.findUnique({
        where: { id: validatedInput.orderId },
      });

      if (!order) {
        throw new Error('주문을 찾을 수 없습니다');
      }

      // 결제 제공자 선택
      const provider = validatedInput.provider || this.selectBestProvider(validatedInput.method);

      // 결제 실행
      let result: PaymentResult;

      switch (provider) {
        case PaymentProvider.TOSS:
          result = await this.processTossPayment(validatedInput, order);
          break;

        case PaymentProvider.STRIPE:
          result = await this.processStripePayment(validatedInput, order);
          break;

        case PaymentProvider.IAMPORT:
          result = await this.processIamportPayment(validatedInput, order);
          break;

        default:
          throw new Error(`지원하지 않는 결제 제공자입니다: ${provider}`);
      }

      // 결제 성공 시 주문 상태 업데이트
      if (result.success) {
        await prisma.order.update({
          where: { id: validatedInput.orderId },
          data: {
            status: OrderStatus.CONFIRMED,
            payment: {
              ...(order.payment as any),
              paymentId: result.paymentId,
              transactionId: result.transactionId,
              paidAt: result.paidAt,
              method: result.method,
              provider: result.provider,
            } as any,
          },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        amount: input.amount,
        method: input.method,
        provider: input.provider || this.defaultProvider,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 환불 처리
   */
  async refundPayment(input: RefundInput): Promise<RefundResult> {
    try {
      // 입력 검증
      const validatedInput = RefundInputSchema.parse(input);

      // 결제 정보 조회 (Order의 payment 필드에서)
      const order = await prisma.order.findFirst({
        where: {
          payment: {
            path: ['paymentId'],
            equals: validatedInput.paymentId,
          },
        },
      });

      if (!order) {
        throw new Error('결제 정보를 찾을 수 없습니다');
      }

      const payment = order.payment as any;
      const provider = payment.provider as PaymentProvider;

      // 환불 실행
      let result: RefundResult;

      switch (provider) {
        case PaymentProvider.TOSS:
          result = await this.refundTossPayment(validatedInput, payment);
          break;

        case PaymentProvider.STRIPE:
          result = await this.refundStripePayment(validatedInput, payment);
          break;

        case PaymentProvider.IAMPORT:
          result = await this.refundIamportPayment(validatedInput, payment);
          break;

        default:
          throw new Error(`지원하지 않는 결제 제공자입니다: ${provider}`);
      }

      // 환불 성공 시 주문 상태 업데이트
      if (result.success) {
        const isFullRefund = !validatedInput.amount || validatedInput.amount >= payment.saleAmount;
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: isFullRefund ? OrderStatus.REFUNDED : order.status,
            payment: {
              ...payment,
              refundId: result.refundId,
              refundedAmount: result.amount,
              refundedAt: result.refundedAt,
              refundReason: validatedInput.reason,
            } as any,
          },
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        amount: 0,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 가상계좌 발급
   */
  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountInfo> {
    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new Error('주문을 찾을 수 없습니다');
    }

    // Toss Payments 가상계좌 발급 API 호출
    const tossClient = this.axiosInstances.get(PaymentProvider.TOSS);
    const secretKey = process.env.TOSS_SECRET_KEY;

    if (!tossClient || !secretKey) {
      throw new Error('Toss Payments 설정이 완료되지 않았습니다');
    }

    try {
      const response = await tossClient.post(
        '/virtual-accounts',
        {
          amount: input.amount,
          orderId: input.orderId,
          orderName: `주문 ${input.orderId}`,
          customerName: input.customerName,
          bank: input.bankCode || 'KB',
          validHours: input.expiresAt
            ? Math.floor((input.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60))
            : 72,
        },
        {
          auth: {
            username: secretKey,
            password: '',
          },
        }
      );

      const data = response.data;

      return {
        accountNumber: data.accountNumber,
        bankCode: data.bank,
        bankName: data.bankName || data.bank,
        accountHolder: data.customerName,
        amount: input.amount,
        expiresAt: new Date(data.dueDate),
      };
    } catch (error) {
      throw new Error(`가상계좌 발급 실패: ${toErrorMessage(error)}`);
    }
  }

  /**
   * 결제 내역 조회
   */
  async getPaymentHistory(userId: string, startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        payment: {
          path: ['paymentId'],
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order) => {
      const payment = order.payment as any;
      return {
        orderId: order.id,
        paymentId: payment.paymentId,
        amount: payment.saleAmount,
        method: payment.method,
        provider: payment.provider,
        status: this.getPaymentStatusFromOrder(order.status),
        paidAt: payment.paidAt,
        refundedAmount: payment.refundedAmount || 0,
      };
    });
  }

  /**
   * 정산 정보 조회
   */
  async getSettlement(userId: string, startDate: Date, endDate: Date): Promise<SettlementInfo> {
    const orders = await prisma.order.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: OrderStatus.DELIVERED,
      },
    });

    let totalAmount = 0;
    let totalCommission = 0;

    const payments = orders.map((order) => {
      const payment = order.payment as any;
      const amount = payment.saleAmount || 0;
      const commission = payment.commission || 0;
      const netAmount = amount - commission;

      totalAmount += amount;
      totalCommission += commission;

      return {
        paymentId: payment.paymentId || order.id,
        orderId: order.id,
        amount,
        commission,
        netAmount,
        paidAt: payment.paidAt || order.createdAt,
      };
    });

    return {
      period: { startDate, endDate },
      totalAmount,
      commission: totalCommission,
      netAmount: totalAmount - totalCommission,
      payments,
    };
  }

  /**
   * 결제 통계
   */
  async getPaymentStatistics(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        payment: {
          path: ['paymentId'],
          not: null,
        },
      },
    });

    // 결제 방법별 통계
    const byMethod: Record<string, { count: number; amount: number }> = {};

    // 제공자별 통계
    const byProvider: Record<string, { count: number; amount: number }> = {};

    orders.forEach((order) => {
      const payment = order.payment as any;
      const method = payment.method || 'UNKNOWN';
      const provider = payment.provider || 'UNKNOWN';
      const amount = payment.saleAmount || 0;

      // 방법별
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, amount: 0 };
      }
      byMethod[method].count++;
      byMethod[method].amount += amount;

      // 제공자별
      if (!byProvider[provider]) {
        byProvider[provider] = { count: 0, amount: 0 };
      }
      byProvider[provider].count++;
      byProvider[provider].amount += amount;
    });

    const totalAmount = orders.reduce((sum, order) => {
      const payment = order.payment as any;
      return sum + (payment.saleAmount || 0);
    }, 0);

    return {
      period: `${days}일`,
      totalPayments: orders.length,
      totalAmount,
      byMethod,
      byProvider,
    };
  }

  // ============================================
  // 플랫폼별 구현 (Toss Payments)
  // ============================================

  private async processTossPayment(
    input: ProcessPaymentInput,
    _order: Order
  ): Promise<PaymentResult> {
    const client = this.axiosInstances.get(PaymentProvider.TOSS);
    const secretKey = process.env.TOSS_SECRET_KEY;

    if (!client || !secretKey) {
      // 개발 환경: 시뮬레이션
      return {
        success: true,
        paymentId: `TOSS_${Date.now()}`,
        transactionId: `TXN_${Date.now()}`,
        status: PaymentStatus.COMPLETED,
        amount: input.amount,
        paidAt: new Date(),
        method: input.method,
        provider: PaymentProvider.TOSS,
        receiptUrl: `https://dashboard.tosspayments.com/receipt/TOSS_${Date.now()}`,
      };
    }

    try {
      const response = await client.post(
        '/payments/confirm',
        {
          paymentKey: input.additionalData?.paymentKey,
          orderId: input.orderId,
          amount: input.amount,
        },
        {
          auth: {
            username: secretKey,
            password: '',
          },
        }
      );

      const data = response.data;

      return {
        success: true,
        paymentId: data.paymentKey,
        transactionId: data.transactionKey,
        status: PaymentStatus.COMPLETED,
        amount: data.totalAmount,
        paidAt: new Date(data.approvedAt),
        method: input.method,
        provider: PaymentProvider.TOSS,
        receiptUrl: data.receipt?.url,
      };
    } catch (error) {
      throw new Error(`Toss Payments 결제 실패: ${toErrorMessage(error)}`);
    }
  }

  private async refundTossPayment(input: RefundInput, payment: any): Promise<RefundResult> {
    const client = this.axiosInstances.get(PaymentProvider.TOSS);
    const secretKey = process.env.TOSS_SECRET_KEY;

    if (!client || !secretKey) {
      // 개발 환경: 시뮬레이션
      return {
        success: true,
        refundId: `REFUND_${Date.now()}`,
        amount: input.amount || payment.saleAmount,
        refundedAt: new Date(),
        status: PaymentStatus.REFUNDED,
      };
    }

    try {
      const response = await client.post(
        `/payments/${payment.paymentId}/cancel`,
        {
          cancelReason: input.reason,
          cancelAmount: input.amount,
        },
        {
          auth: {
            username: secretKey,
            password: '',
          },
        }
      );

      const data = response.data;

      return {
        success: true,
        refundId: data.cancels?.[0]?.transactionKey,
        amount: data.cancels?.[0]?.cancelAmount || 0,
        refundedAt: new Date(data.cancels?.[0]?.canceledAt),
        status: data.status === 'CANCELED' ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL_REFUNDED,
      };
    } catch (error) {
      throw new Error(`Toss Payments 환불 실패: ${toErrorMessage(error)}`);
    }
  }

  // ============================================
  // 플랫폼별 구현 (Stripe)
  // ============================================

  private async processStripePayment(
    input: ProcessPaymentInput,
    _order: Order
  ): Promise<PaymentResult> {
    const client = this.axiosInstances.get(PaymentProvider.STRIPE);
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!client || !secretKey) {
      // 개발 환경: 시뮬레이션
      return {
        success: true,
        paymentId: `STRIPE_${Date.now()}`,
        transactionId: `ch_${Date.now()}`,
        status: PaymentStatus.COMPLETED,
        amount: input.amount,
        paidAt: new Date(),
        method: input.method,
        provider: PaymentProvider.STRIPE,
      };
    }

    try {
      const response = await client.post(
        '/charges',
        new URLSearchParams({
          amount: (input.amount * 100).toString(), // Stripe uses cents
          currency: 'krw',
          source: input.additionalData?.token || '',
          description: `Order ${input.orderId}`,
        }),
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      const data = response.data;

      return {
        success: true,
        paymentId: data.id,
        transactionId: data.balance_transaction,
        status: PaymentStatus.COMPLETED,
        amount: data.amount / 100,
        paidAt: new Date(data.created * 1000),
        method: input.method,
        provider: PaymentProvider.STRIPE,
        receiptUrl: data.receipt_url,
      };
    } catch (error) {
      throw new Error(`Stripe 결제 실패: ${toErrorMessage(error)}`);
    }
  }

  private async refundStripePayment(input: RefundInput, payment: any): Promise<RefundResult> {
    const client = this.axiosInstances.get(PaymentProvider.STRIPE);
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!client || !secretKey) {
      // 개발 환경: 시뮬레이션
      return {
        success: true,
        refundId: `re_${Date.now()}`,
        amount: input.amount || payment.saleAmount,
        refundedAt: new Date(),
        status: PaymentStatus.REFUNDED,
      };
    }

    try {
      const response = await client.post(
        '/refunds',
        new URLSearchParams({
          charge: payment.paymentId,
          amount: input.amount ? (input.amount * 100).toString() : '',
          reason: 'requested_by_customer',
        }),
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      const data = response.data;

      return {
        success: true,
        refundId: data.id,
        amount: data.amount / 100,
        refundedAt: new Date(data.created * 1000),
        status: data.status === 'succeeded' ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
      };
    } catch (error) {
      throw new Error(`Stripe 환불 실패: ${toErrorMessage(error)}`);
    }
  }

  // ============================================
  // 플랫폼별 구현 (Iamport)
  // ============================================

  private async processIamportPayment(
    input: ProcessPaymentInput,
    _order: Order
  ): Promise<PaymentResult> {
    // 아임포트 구현 (시뮬레이션)
    return {
      success: true,
      paymentId: `IMP_${Date.now()}`,
      transactionId: `imp_${Date.now()}`,
      status: PaymentStatus.COMPLETED,
      amount: input.amount,
      paidAt: new Date(),
      method: input.method,
      provider: PaymentProvider.IAMPORT,
    };
  }

  private async refundIamportPayment(input: RefundInput, payment: any): Promise<RefundResult> {
    // 아임포트 환불 구현 (시뮬레이션)
    return {
      success: true,
      refundId: `REFUND_${Date.now()}`,
      amount: input.amount || payment.saleAmount,
      refundedAt: new Date(),
      status: PaymentStatus.REFUNDED,
    };
  }

  // ============================================
  // 헬퍼 메서드
  // ============================================

  /**
   * 최적 결제 제공자 선택
   */
  private selectBestProvider(method: PaymentMethod): PaymentProvider {
    // 한국 결제 수단은 Toss Payments 우선
    if (
      method === PaymentMethod.CARD ||
      method === PaymentMethod.BANK_TRANSFER ||
      method === PaymentMethod.VIRTUAL_ACCOUNT ||
      method === PaymentMethod.MOBILE
    ) {
      return PaymentProvider.TOSS;
    }

    // 해외 결제는 Stripe
    if (method === PaymentMethod.PAYPAL) {
      return PaymentProvider.STRIPE;
    }

    return this.defaultProvider;
  }

  /**
   * 주문 상태에서 결제 상태 추출
   */
  private getPaymentStatusFromOrder(orderStatus: OrderStatus): PaymentStatus {
    switch (orderStatus) {
      case OrderStatus.CONFIRMED:
      case OrderStatus.PURCHASING:
      case OrderStatus.PURCHASED:
      case OrderStatus.SHIPPING:
      case OrderStatus.DELIVERED:
        return PaymentStatus.COMPLETED;

      case OrderStatus.CANCELLED:
        return PaymentStatus.CANCELLED;

      case OrderStatus.REFUNDED:
        return PaymentStatus.REFUNDED;

      case OrderStatus.RECEIVED:
      default:
        return PaymentStatus.PENDING;
    }
  }

  /**
   * 웹훅 서명 검증
   */
  verifyWebhookSignature(
    provider: PaymentProvider,
    payload: string,
    signature: string
  ): boolean {
    const secretKey = this.getWebhookSecret(provider);
    if (!secretKey) return false;

    const expectedSignature = createHmac('sha256', secretKey).update(payload).digest('hex');

    return expectedSignature === signature;
  }

  /**
   * 웹훅 시크릿 조회
   */
  private getWebhookSecret(provider: PaymentProvider): string | undefined {
    switch (provider) {
      case PaymentProvider.TOSS:
        return process.env.TOSS_WEBHOOK_SECRET;
      case PaymentProvider.STRIPE:
        return process.env.STRIPE_WEBHOOK_SECRET;
      default:
        return undefined;
    }
  }

  /**
   * 웹훅 처리
   */
  async handleWebhook(
    provider: PaymentProvider,
    eventType: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (eventType) {
        case 'payment.completed':
          await this.handlePaymentCompleted(provider, payload);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(provider, payload);
          break;

        case 'refund.completed':
          await this.handleRefundCompleted(provider, payload);
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

  private async handlePaymentCompleted(_provider: PaymentProvider, _payload: unknown) {
    // 결제 완료 처리
  }

  private async handlePaymentFailed(_provider: PaymentProvider, _payload: unknown) {
    // 결제 실패 처리
  }

  private async handleRefundCompleted(_provider: PaymentProvider, _payload: unknown) {
    // 환불 완료 처리
  }
}

// 싱글톤 인스턴스 내보내기
export const paymentService = new PaymentService();
