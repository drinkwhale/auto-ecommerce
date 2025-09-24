/**
 * 상품 관리 API 계약 테스트
 * API 스키마와 실제 구현 간의 일치성을 검증합니다.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/types';
import request from 'supertest';
import { z } from 'zod';
import app from '../../../src/app';
import { setupTestDatabase, cleanupTestDatabase } from '../../../tests/helpers/database';
import { createTestUser, getAuthToken } from '../../../tests/helpers/auth';

// API Response Schema 정의
const ProductSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceInfo: z.object({
    sourceUrl: z.string().url(),
    sourcePlatform: z.enum(['TAOBAO', 'AMAZON', 'ALIBABA']),
    sourceProductId: z.string(),
    lastCrawledAt: z.string().datetime(),
  }),
  originalData: z.object({
    title: z.string().min(1),
    description: z.string(),
    price: z.object({
      amount: z.number().min(0),
      currency: z.enum(['USD', 'CNY', 'KRW', 'EUR', 'JPY']),
      originalAmount: z.number().min(0),
    }),
    images: z.array(z.object({
      id: z.string().uuid(),
      originalUrl: z.string().url(),
      processedImages: z.array(z.any()),
      status: z.enum(['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED']),
    })),
    category: z.string(),
    brand: z.string().optional(),
    tags: z.array(z.string()),
  }),
  translatedData: z.object({
    title: z.string(),
    description: z.string(),
    translatedAt: z.string().datetime(),
    translationEngine: z.enum(['GOOGLE', 'PAPAGO', 'BAIDU']),
    qualityScore: z.number().min(0).max(100),
  }).optional(),
  salesSettings: z.object({
    marginRate: z.number().min(0).max(1000),
    salePrice: z.number().min(0),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    targetMarkets: z.array(z.enum(['ELEVENST', 'GMARKET', 'AUCTION', 'COUPANG', 'NAVER'])),
    autoUpdate: z.boolean(),
  }),
  registrations: z.array(z.object({
    id: z.string().uuid(),
    platform: z.enum(['ELEVENST', 'GMARKET', 'AUCTION', 'COUPANG', 'NAVER']),
    platformProductId: z.string().optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'UPDATING']),
    categoryMapping: z.string(),
    registeredAt: z.string().datetime().optional(),
  })),
  status: z.enum(['DRAFT', 'PROCESSING', 'READY', 'REGISTERED', 'ERROR', 'ARCHIVED']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ProductListSchema = z.object({
  success: z.boolean(),
  data: z.object({
    products: z.array(ProductSchema),
    pagination: z.object({
      page: z.number().min(1),
      limit: z.number().min(1),
      total: z.number().min(0),
      totalPages: z.number().min(0),
    }),
  }),
});

const ProductCreateSchema = z.object({
  success: z.boolean(),
  data: z.object({
    product: ProductSchema,
  }),
});

const ErrorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

describe('상품 관리 API 계약 테스트', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    const { user, token } = await createTestUser();
    testUserId = user.id;
    authToken = token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/v1/products', () => {
    test('상품 목록 조회 - 성공 (빈 목록)', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 스키마 검증
      const result = ProductListSchema.parse(response.body);

      expect(result.success).toBe(true);
      expect(result.data.products).toBeInstanceOf(Array);
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.limit).toBe(20);
      expect(result.data.pagination.total).toBe(0);
    });

    test('상품 목록 조회 - 페이지네이션 파라미터', async () => {
      const response = await request(app)
        .get('/api/v1/products?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const result = ProductListSchema.parse(response.body);

      expect(result.data.pagination.page).toBe(2);
      expect(result.data.pagination.limit).toBe(10);
    });

    test('상품 목록 조회 - 필터 파라미터', async () => {
      const response = await request(app)
        .get('/api/v1/products?status=READY&platform=TAOBAO&search=laptop')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      ProductListSchema.parse(response.body);
    });

    test('상품 목록 조회 - 인증 없음', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(401);

      const result = ErrorSchema.parse(response.body);
      expect(result.success).toBe(false);
      expect(result.message).toContain('authorization');
    });

    test('상품 목록 조회 - 잘못된 파라미터', async () => {
      const response = await request(app)
        .get('/api/v1/products?page=-1&limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      ErrorSchema.parse(response.body);
    });
  });

  describe('POST /api/v1/products', () => {
    const validProductData = {
      sourceUrl: 'https://item.taobao.com/item.htm?id=123456789',
      marginRate: 30,
      targetMarkets: ['ELEVENST', 'GMARKET'],
      autoUpdate: true,
    };

    test('상품 등록 - 성공 (모든 필수 필드)', async () => {
      // 이 테스트는 실제 구현 전에는 실패해야 합니다
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validProductData)
        .expect(201);

      const result = ProductCreateSchema.parse(response.body);

      expect(result.success).toBe(true);
      expect(result.data.product.id).toBeDefined();
      expect(result.data.product.userId).toBe(testUserId);
      expect(result.data.product.sourceInfo.sourceUrl).toBe(validProductData.sourceUrl);
      expect(result.data.product.salesSettings.marginRate).toBe(validProductData.marginRate);
      expect(result.data.product.salesSettings.targetMarkets).toEqual(validProductData.targetMarkets);
      expect(result.data.product.status).toBe('DRAFT');
    });

    test('상품 등록 - 필수 필드 누락', async () => {
      const invalidData = {
        sourceUrl: 'https://item.taobao.com/item.htm?id=123456789',
        // marginRate 누락
        targetMarkets: ['ELEVENST'],
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.success).toBe(false);
      expect(result.message).toContain('marginRate');
    });

    test('상품 등록 - 잘못된 URL', async () => {
      const invalidData = {
        ...validProductData,
        sourceUrl: 'invalid-url',
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('url');
    });

    test('상품 등록 - 잘못된 마진율', async () => {
      const invalidData = {
        ...validProductData,
        marginRate: -10, // 음수
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('marginRate');
    });

    test('상품 등록 - 지원하지 않는 플랫폼', async () => {
      const invalidData = {
        ...validProductData,
        targetMarkets: ['INVALID_PLATFORM'],
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('targetMarkets');
    });

    test('상품 등록 - 인증 없음', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .send(validProductData)
        .expect(401);

      ErrorSchema.parse(response.body);
    });
  });

  describe('GET /api/v1/products/:productId', () => {
    test('상품 상세 조회 - 존재하지 않는 상품', async () => {
      const nonExistentId = '12345678-1234-5678-9012-123456789012';

      const response = await request(app)
        .get(`/api/v1/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      const result = ErrorSchema.parse(response.body);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    test('상품 상세 조회 - 잘못된 UUID 형식', async () => {
      const response = await request(app)
        .get('/api/v1/products/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('uuid');
    });

    test('상품 상세 조회 - 인증 없음', async () => {
      const productId = '12345678-1234-5678-9012-123456789012';

      const response = await request(app)
        .get(`/api/v1/products/${productId}`)
        .expect(401);

      ErrorSchema.parse(response.body);
    });
  });

  describe('PUT /api/v1/products/:productId', () => {
    const updateData = {
      marginRate: 35,
      targetMarkets: ['ELEVENST', 'GMARKET', 'AUCTION'],
      autoUpdate: false,
      translatedTitle: '업데이트된 상품명',
      translatedDescription: '업데이트된 상품 설명',
    };

    test('상품 수정 - 존재하지 않는 상품', async () => {
      const nonExistentId = '12345678-1234-5678-9012-123456789012';

      const response = await request(app)
        .put(`/api/v1/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      const result = ErrorSchema.parse(response.body);
      expect(result.success).toBe(false);
    });

    test('상품 수정 - 잘못된 데이터 타입', async () => {
      const productId = '12345678-1234-5678-9012-123456789012';
      const invalidData = {
        marginRate: 'invalid-number',
        autoUpdate: 'invalid-boolean',
      };

      const response = await request(app)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      ErrorSchema.parse(response.body);
    });
  });

  describe('DELETE /api/v1/products/:productId', () => {
    test('상품 삭제 - 존재하지 않는 상품', async () => {
      const nonExistentId = '12345678-1234-5678-9012-123456789012';

      const response = await request(app)
        .delete(`/api/v1/products/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      const result = ErrorSchema.parse(response.body);
      expect(result.success).toBe(false);
    });

    test('상품 삭제 - 인증 없음', async () => {
      const productId = '12345678-1234-5678-9012-123456789012';

      const response = await request(app)
        .delete(`/api/v1/products/${productId}`)
        .expect(401);

      ErrorSchema.parse(response.body);
    });
  });

  describe('POST /api/v1/products/crawl', () => {
    test('상품 크롤링 - 유효한 URL', async () => {
      const crawlData = {
        url: 'https://item.taobao.com/item.htm?id=123456789',
      };

      const response = await request(app)
        .post('/api/v1/products/crawl')
        .set('Authorization', `Bearer ${authToken}`)
        .send(crawlData);

      // 크롤링은 시간이 걸릴 수 있으므로 적절한 상태 코드를 확인
      expect([200, 202]).toContain(response.status);

      if (response.status === 200) {
        // 즉시 응답인 경우
        expect(response.body.success).toBe(true);
        expect(response.body.data.productData).toBeDefined();
      } else {
        // 비동기 처리인 경우
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('processing');
      }
    });

    test('상품 크롤링 - 잘못된 URL', async () => {
      const crawlData = {
        url: 'invalid-url',
      };

      const response = await request(app)
        .post('/api/v1/products/crawl')
        .set('Authorization', `Bearer ${authToken}`)
        .send(crawlData)
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('url');
    });

    test('상품 크롤링 - URL 누락', async () => {
      const response = await request(app)
        .post('/api/v1/products/crawl')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      const result = ErrorSchema.parse(response.body);
      expect(result.message).toContain('url');
    });

    test('상품 크롤링 - 인증 없음', async () => {
      const crawlData = {
        url: 'https://item.taobao.com/item.htm?id=123456789',
      };

      const response = await request(app)
        .post('/api/v1/products/crawl')
        .send(crawlData)
        .expect(401);

      ErrorSchema.parse(response.body);
    });
  });

  describe('API 응답 헤더 검증', () => {
    test('모든 API 응답에 올바른 Content-Type 헤더', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('CORS 헤더 존재 확인', async () => {
      const response = await request(app)
        .options('/api/v1/products')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('보안 헤더 확인', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('API 성능 검증', () => {
    test('상품 목록 조회 응답시간 < 1초', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
    });

    test('동시 요청 처리 능력', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/products')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});

/**
 * 이 테스트 파일의 목적:
 *
 * 1. API 스키마 준수 검증 - OpenAPI 스펙과 실제 응답의 일치성 확인
 * 2. 에러 처리 검증 - 잘못된 요청에 대한 적절한 에러 응답
 * 3. 인증/인가 검증 - 보안 요구사항 준수 확인
 * 4. 성능 검증 - 응답시간 및 동시성 요구사항 확인
 * 5. 헤더 검증 - 보안 헤더 및 CORS 설정 확인
 *
 * 주의사항:
 * - 이 테스트들은 TDD 방식으로 구현 전에 작성되므로 초기에는 실패합니다
 * - 실제 구현이 완료되면서 하나씩 통과하게 될 것입니다
 * - 각 테스트는 독립적으로 실행되어야 하며, 다른 테스트에 의존하지 않아야 합니다
 */