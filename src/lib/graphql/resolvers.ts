/**
 * GraphQL 리졸버
 *
 * GraphQL 쿼리 및 뮤테이션 리졸버 함수들
 * Phase 3.5: API 엔드포인트 구현 - T043
 */

import { Prisma, PrismaClient, ProductStatus, SourcePlatform, OpenMarketPlatform } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { crawlingService } from '@/services/crawling.service';
import { pricingService, type SupportedCurrency } from '@/services/pricing.service';

const prisma = new PrismaClient();

const CurrencyEnumValues = ['CNY', 'KRW', 'USD', 'JPY', 'EUR'] as const;

const TaobaoImportInputSchema = z.object({
  sourceUrl: z.string().url(),
  sourceProductId: z.string().optional(),
  marginRate: z.number().min(0).max(1),
  targetCurrency: z.enum(CurrencyEnumValues).default('KRW'),
  exchangeRate: z.number().positive().optional(),
  shippingCost: z.number().min(0).default(0),
  commissionRate: z.number().min(0).max(0.3).default(0.1),
  roundingUnit: z.number().min(1).default(100),
  targetMarkets: z.array(z.nativeEnum(OpenMarketPlatform)).min(1),
  autoUpdate: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});

type TaobaoImportInput = z.infer<typeof TaobaoImportInputSchema>;

const normalizeCurrency = (value: string | undefined, fallback: SupportedCurrency): SupportedCurrency => {
  const upper = value?.toUpperCase() as SupportedCurrency | undefined;
  if (upper && (CurrencyEnumValues as readonly string[]).includes(upper)) {
    return upper;
  }
  return fallback;
};

const extractProductIdFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const idFromQuery = parsed.searchParams.get('id');
    if (idFromQuery) {
      return idFromQuery;
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments.pop()!.replace(/[^0-9a-zA-Z_-]/g, '');
    }
  } catch {
    // ignore parsing error
  }
  return `taobao-${Date.now()}`;
};

export const resolvers = {
  Query: {
    // 현재 사용자 조회
    me: async (_: any, __: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await prisma.user.findUnique({
        where: { id: context.session.user.id },
      });
    },

    // 상품 목록 조회
    products: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const page = args.page || 1;
      const limit = args.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        userId: context.session.user.id,
      };

      if (args.status) {
        where.status = args.status;
      }

      if (args.search) {
        where.OR = [
          {
            originalData: {
              path: ['title'],
              string_contains: args.search,
            },
          },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [args.sortBy || 'createdAt']: args.sortOrder || 'desc' },
          include: {
            user: true,
            images: true,
            registrations: true,
          },
        }),
        prisma.product.count({ where }),
      ]);

      return {
        products,
        pageInfo: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },

    // 상품 상세 조회
    product: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: args.id },
        include: {
          user: true,
          images: true,
          registrations: true,
        },
      });

      if (!product) {
        throw new GraphQLError('상품을 찾을 수 없습니다.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (
        product.userId !== context.session.user.id &&
        context.session.user.role !== 'ADMIN'
      ) {
        throw new GraphQLError('접근 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return product;
    },

    // 주문 목록 조회
    orders: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const page = args.page || 1;
      const limit = args.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        userId: context.session.user.id,
      };

      if (args.status) {
        where.status = args.status;
      }

      if (args.startDate || args.endDate) {
        where.createdAt = {};
        if (args.startDate) {
          where.createdAt.gte = new Date(args.startDate);
        }
        if (args.endDate) {
          where.createdAt.lte = new Date(args.endDate);
        }
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [args.sortBy || 'createdAt']: args.sortOrder || 'desc' },
          include: {
            product: true,
            user: true,
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        orders,
        pageInfo: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },

    // 주문 상세 조회
    order: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: args.id },
        include: {
          product: true,
          user: true,
        },
      });

      if (!order) {
        throw new GraphQLError('주문을 찾을 수 없습니다.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (
        order.userId !== context.session.user.id &&
        context.session.user.role !== 'ADMIN'
      ) {
        throw new GraphQLError('접근 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return order;
    },

    // 대시보드 통계 조회 (간단한 버전)
    dashboard: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const period = args.period || 30;
      const userId = context.session.user.id;

      const totalProducts = await prisma.product.count({ where: { userId } });
      const totalOrders = await prisma.order.count({ where: { userId } });

      return {
        totalProducts,
        totalOrders,
        period,
      };
    },
  },

  Mutation: {
    // 상품 생성
    createProduct: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const product = await prisma.product.create({
        data: {
          userId: context.session.user.id,
          sourceInfo: {
            sourceUrl: args.input.sourceUrl,
            sourcePlatform: args.input.sourcePlatform,
            lastCrawledAt: new Date().toISOString(),
          },
          originalData: args.input.originalData,
          salesSettings: args.input.salesSettings,
          status: 'DRAFT',
          monitoring: {
            isActive: false,
          },
          statistics: {
            views: 0,
            clicks: 0,
            orders: 0,
          },
        },
        include: {
          user: true,
          images: true,
          registrations: true,
        },
      });

      return product;
    },

    // 상품 수정
    updateProduct: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!existingProduct) {
        throw new GraphQLError('상품을 찾을 수 없습니다.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (existingProduct.userId !== context.session.user.id) {
        throw new GraphQLError('수정 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const product = await prisma.product.update({
        where: { id: args.id },
        data: args.input,
        include: {
          user: true,
          images: true,
          registrations: true,
        },
      });

      return product;
    },

    // 상품 삭제
    deleteProduct: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: args.id },
      });

      if (!existingProduct) {
        throw new GraphQLError('상품을 찾을 수 없습니다.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (existingProduct.userId !== context.session.user.id) {
        throw new GraphQLError('삭제 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (args.hard && context.session.user.role !== 'ADMIN') {
        throw new GraphQLError('하드 삭제 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (args.hard) {
        await prisma.product.delete({ where: { id: args.id } });
        return { success: true, message: '상품이 완전히 삭제되었습니다.' };
      } else {
        await prisma.product.update({
          where: { id: args.id },
          data: { status: 'ARCHIVED' },
        });
        return { success: true, message: '상품이 아카이브되었습니다.' };
      }
    },

    // Taobao 상품 임포트
    importTaobaoProduct: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (context.session.user.role === 'VIEWER') {
        throw new GraphQLError('판매자 권한이 필요합니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      let input: TaobaoImportInput;
      try {
        input = TaobaoImportInputSchema.parse(args.input);
      } catch (error: any) {
        throw new GraphQLError('입력 값이 올바르지 않습니다.', {
          extensions: {
            code: 'BAD_USER_INPUT',
            details: error.errors ?? error.message,
          },
        });
      }

      const crawlResult = await crawlingService.crawlUrl({
        sourceUrl: input.sourceUrl,
        sourcePlatform: SourcePlatform.TAOBAO,
        userId: context.session.user.id,
      });

      if (!crawlResult.success || !crawlResult.data) {
        throw new GraphQLError('Taobao 상품 데이터를 가져오지 못했습니다.', {
          extensions: {
            code: 'TAOBAO_FETCH_FAILED',
            details: crawlResult.error,
          },
        });
      }

      const baseCurrency = normalizeCurrency(
        crawlResult.data.price.currency,
        'CNY'
      );

      let pricingSummary;
      try {
        pricingSummary = pricingService.calculateSalePrice({
          baseCost: crawlResult.data.price.amount,
          baseCurrency,
          targetCurrency: input.targetCurrency,
          exchangeRate: input.exchangeRate,
          marginRate: input.marginRate,
          commissionRate: input.commissionRate,
          shippingCost: input.shippingCost,
          roundingUnit: input.roundingUnit,
        });
      } catch (error: any) {
        throw new GraphQLError('가격 계산에 실패했습니다.', {
          extensions: {
            code: 'PRICING_CALCULATION_FAILED',
            details: error.message,
          },
        });
      }

      const now = new Date();
      const resolvedProductId =
        input.sourceProductId || extractProductIdFromUrl(input.sourceUrl);

      const productPayload = {
        sourceInfo: {
          sourceUrl: input.sourceUrl,
          sourcePlatform: SourcePlatform.TAOBAO,
          sourceProductId: resolvedProductId,
          lastCrawledAt: now.toISOString(),
        },
        originalData: {
          title: crawlResult.data.title,
          description: crawlResult.data.description,
          price: {
            amount: crawlResult.data.price.amount,
            currency: baseCurrency,
            originalAmount: crawlResult.data.price.originalAmount ?? crawlResult.data.price.amount,
            convertedAmount: pricingSummary.convertedCost,
            convertedCurrency: input.targetCurrency,
          },
          images: crawlResult.data.images?.map((url) => ({
            originalUrl: url,
          })) ?? [],
          specifications: crawlResult.data.specifications ?? {},
          category: crawlResult.data.category,
          brand: crawlResult.data.brand,
          model: crawlResult.data.model,
          tags: Array.from(new Set([...(crawlResult.data.tags ?? []), ...(input.tags ?? [])])),
          metadata: input.metadata,
        },
        salesSettings: {
          marginRate: input.marginRate,
          salePrice: pricingSummary.salePrice,
          targetMarkets: input.targetMarkets,
          autoUpdate: input.autoUpdate,
          targetCurrency: input.targetCurrency,
          shippingCost: input.shippingCost,
          commissionRate: input.commissionRate,
          roundingUnit: input.roundingUnit,
        },
        monitoring: {
          isActive: true,
          lastCheckedAt: now.toISOString(),
          priceHistory: [
            {
              price: pricingSummary.salePrice,
              currency: input.targetCurrency,
              timestamp: now.toISOString(),
              source: 'TAOBAO_IMPORT',
            },
          ],
        },
      };

      const existingProduct = await prisma.product.findFirst({
        where: {
          userId: context.session.user.id,
          sourceInfo: {
            path: ['sourceUrl'],
            equals: input.sourceUrl,
          },
        },
      });

      const include = {
        user: true,
        images: true,
        registrations: true,
      };

      const product = existingProduct
        ? await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              sourceInfo: productPayload.sourceInfo as Prisma.JsonValue,
              originalData: productPayload.originalData as Prisma.JsonValue,
              salesSettings: productPayload.salesSettings as Prisma.JsonValue,
              monitoring: productPayload.monitoring as Prisma.JsonValue,
              status: ProductStatus.READY,
            },
            include,
          })
        : await prisma.product.create({
            data: {
              userId: context.session.user.id,
              sourceInfo: productPayload.sourceInfo as Prisma.JsonValue,
              originalData: productPayload.originalData as Prisma.JsonValue,
              salesSettings: productPayload.salesSettings as Prisma.JsonValue,
              monitoring: productPayload.monitoring as Prisma.JsonValue,
              statistics: {
                totalOrders: 0,
                totalRevenue: 0,
                totalProfit: 0,
              } as Prisma.JsonValue,
              status: ProductStatus.READY,
            },
            include,
          });

      const warnings: string[] = [];
      if (input.marginRate < 0.15) {
        warnings.push('마진율이 낮습니다. 최소 15% 이상을 권장합니다.');
      }
      if (!input.exchangeRate && baseCurrency !== input.targetCurrency) {
        warnings.push('환율 정보가 없어 원가를 동일 통화로 환산하지 못했습니다.');
      }

      return {
        product,
        pricingSummary: {
          baseCost: crawlResult.data.price.amount,
          baseCurrency,
          convertedCost: pricingSummary.convertedCost,
          targetCurrency: input.targetCurrency,
          shippingCost: input.shippingCost,
          commissionAmount: pricingSummary.commissionAmount,
          marginAmount: pricingSummary.marginAmount,
          salePrice: pricingSummary.salePrice,
          marginRate: input.marginRate,
        },
        warnings,
        message: existingProduct
          ? '기존 상품 정보를 최신 Taobao 데이터로 갱신했습니다.'
          : 'Taobao 상품을 성공적으로 임포트했습니다.',
      };
    },

    // 주문 상태 업데이트
    updateOrderStatus: async (_: any, args: any, context: any) => {
      if (!context.session?.user?.id) {
        throw new GraphQLError('인증이 필요합니다.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const existingOrder = await prisma.order.findUnique({
        where: { id: args.id },
      });

      if (!existingOrder) {
        throw new GraphQLError('주문을 찾을 수 없습니다.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (existingOrder.userId !== context.session.user.id) {
        throw new GraphQLError('수정 권한이 없습니다.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const updateData: any = {
        status: args.input.status,
      };

      if (args.input.sourcePurchase) {
        updateData.sourcePurchase = args.input.sourcePurchase;
      }

      if (args.input.shipping) {
        updateData.shipping = args.input.shipping;
      }

      if (args.input.status === 'DELIVERED' && !existingOrder.completedAt) {
        updateData.completedAt = new Date();
      }

      const order = await prisma.order.update({
        where: { id: args.id },
        data: updateData,
        include: {
          product: true,
          user: true,
        },
      });

      return order;
    },
  },
};
