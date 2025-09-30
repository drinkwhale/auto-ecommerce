/**
 * GraphQL 리졸버
 *
 * GraphQL 쿼리 및 뮤테이션 리졸버 함수들
 * Phase 3.5: API 엔드포인트 구현 - T043
 */

import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

const prisma = new PrismaClient();

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