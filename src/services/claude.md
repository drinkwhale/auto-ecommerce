# Services 모듈 - 비즈니스 로직 서비스 계층

## 모듈 역할
- **비즈니스 로직 계층**: 데이터 처리, 검증, 외부 API 연동 등 핵심 비즈니스 로직을 담당합니다.
- **데이터베이스 추상화**: Prisma ORM을 통해 데이터베이스와 상호작용합니다.
- **재사용성**: API 엔드포인트와 컴포넌트에서 공통으로 사용할 수 있는 로직을 제공합니다.

## 디렉토리 구조
```
src/services/
├── user.service.ts              # 사용자 관리 (인증, 프로필)
├── product.service.ts           # 상품 관리 (CRUD, 상태 관리)
├── order.service.ts             # 주문 처리 (생성, 상태 업데이트)
├── crawling.service.ts          # 상품 크롤링 (타오바오/아마존/알리바바)
├── translation.service.ts       # 번역 처리 (Google/Papago API)
├── image-processing.service.ts  # 이미지 처리 (다운로드, 최적화, 워터마크 제거)
├── openmarket.service.ts        # 오픈마켓 연동 (11번가/지마켓/쿠팡)
└── payment.service.ts           # 결제 연동 (토스페이먼츠 등)
```

## 핵심 규칙

### 규칙 1: 모든 서비스 함수는 async/await 패턴 사용
- **비동기 작업은 Promise 반환**
- **동기 작업도 일관성을 위해 async 함수로 작성 권장**
  ```typescript
  // ✅ 좋은 예시
  export async function createProduct(data: CreateProductInput): Promise<Product> {
    try {
      const product = await prisma.product.create({
        data: {
          ...data,
          status: ProductStatus.DRAFT,
        },
      });
      return product;
    } catch (error) {
      throw new Error('상품 생성 중 오류가 발생했습니다.');
    }
  }

  // ❌ 나쁜 예시
  export function createProduct(data: CreateProductInput): Product {
    // 동기 함수는 사용하지 않음
  }
  ```

### 규칙 2: Prisma ORM 사용
- **데이터베이스 접근은 Prisma Client를 통해서만 수행**
- **트랜잭션이 필요한 경우 `prisma.$transaction()` 사용**
- **Raw 쿼리는 최소화** (필요시에만 `prisma.$queryRaw` 사용)
  ```typescript
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  // ✅ 기본 쿼리
  export async function getProductById(id: string): Promise<Product | null> {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        registrations: true,
      },
    });
  }

  // ✅ 트랜잭션 사용
  export async function createOrder(orderData: CreateOrderInput): Promise<Order> {
    return await prisma.$transaction(async (tx) => {
      // 1. 재고 확인
      const product = await tx.product.findUnique({ where: { id: orderData.productId } });
      if (!product) throw new Error('상품을 찾을 수 없습니다.');

      // 2. 주문 생성
      const order = await tx.order.create({ data: orderData });

      // 3. 재고 차감 로직 (향후 구현)
      // ...

      return order;
    });
  }
  ```

### 규칙 3: 에러 처리는 커스텀 Error 클래스로 throw
- **명확한 에러 메시지 제공**
- **에러 타입 구분** (ValidationError, NotFoundError, DatabaseError 등)
- **에러는 서비스 계층에서 처리하고, API 계층에서 HTTP 응답으로 변환**
  ```typescript
  // ✅ 커스텀 에러 클래스 정의
  export class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }

  export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  // ✅ 서비스 함수에서 사용
  export async function deleteProduct(id: string): Promise<void> {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundError(`ID ${id}에 해당하는 상품을 찾을 수 없습니다.`);
    }

    if (product.status === ProductStatus.REGISTERED) {
      throw new ValidationError('등록된 상품은 삭제할 수 없습니다.');
    }

    await prisma.product.delete({ where: { id } });
  }
  ```

### 규칙 4: 입력 데이터는 Zod 스키마로 검증
- **모든 외부 입력은 검증 필수**
- **타입 안정성과 런타임 검증을 동시에 확보**
  ```typescript
  import { z } from 'zod';

  // ✅ Zod 스키마 정의
  export const CreateProductSchema = z.object({
    userId: z.string().cuid(),
    sourceInfo: z.object({
      sourceUrl: z.string().url(),
      sourcePlatform: z.enum(['TAOBAO', 'AMAZON', 'ALIBABA']),
      sourceProductId: z.string(),
    }),
    originalData: z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      price: z.number().positive(),
      images: z.array(z.string().url()),
    }),
    salesSettings: z.object({
      marginRate: z.number().min(0).max(100),
      salePrice: z.number().positive(),
    }),
  });

  export type CreateProductInput = z.infer<typeof CreateProductSchema>;

  // ✅ 검증 적용
  export async function createProduct(rawData: unknown): Promise<Product> {
    // 입력 검증
    const data = CreateProductSchema.parse(rawData);

    // 비즈니스 로직
    const product = await prisma.product.create({
      data: {
        ...data,
        status: ProductStatus.DRAFT,
      },
    });

    return product;
  }
  ```

### 규칙 5: 외부 API 호출 시 재시도 로직 포함
- **네트워크 오류 대비 재시도 메커니즘 구현**
- **타임아웃 설정**
- **Rate Limiting 준수**
  ```typescript
  import axios, { AxiosError } from 'axios';

  // ✅ 재시도 로직이 포함된 API 호출
  async function fetchWithRetry<T>(
    url: string,
    maxRetries: number = 3,
    timeout: number = 5000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get<T>(url, { timeout });
        return response.data;
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`API 호출 실패 (${maxRetries}회 시도): ${url}`);
        }

        // 지수 백오프 (Exponential Backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('예상치 못한 오류');
  }

  // ✅ 크롤링 서비스에서 사용
  export async function crawlProduct(url: string): Promise<ProductData> {
    const html = await fetchWithRetry<string>(url);
    const productData = extractProductData(html);
    return productData;
  }
  ```

### 규칙 6: 함수는 단일 책임 원칙 (SRP) 준수
- **하나의 함수는 하나의 작업만 수행**
- **복잡한 로직은 여러 함수로 분리**
  ```typescript
  // ✅ 좋은 예시 - 단일 책임
  async function calculateSalePrice(costPrice: number, marginRate: number): Promise<number> {
    return costPrice * (1 + marginRate / 100);
  }

  async function createProductWithCalculatedPrice(data: CreateProductInput): Promise<Product> {
    const salePrice = await calculateSalePrice(
      data.originalData.price,
      data.salesSettings.marginRate
    );

    return await prisma.product.create({
      data: {
        ...data,
        salesSettings: {
          ...data.salesSettings,
          salePrice,
        },
      },
    });
  }

  // ❌ 나쁜 예시 - 여러 책임
  async function createProductAndUploadImagesAndNotifyUsers(data: any): Promise<Product> {
    // 상품 생성 + 이미지 업로드 + 사용자 알림 (너무 많은 책임)
  }
  ```

### 규칙 7: 비즈니스 로직은 서비스 계층에만 존재
- **API 엔드포인트는 서비스 함수를 호출만 수행**
- **컴포넌트에서 직접 데이터베이스 접근 금지**
  ```typescript
  // ✅ 서비스 계층 (src/services/product.service.ts)
  export async function getProducts(params: GetProductsParams): Promise<ProductListResult> {
    const { page = 1, limit = 10, status, userId } = params;

    const where = {
      ...(status && { status }),
      ...(userId && { userId }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ✅ API 계층 (src/app/api/v1/products/route.ts)
  export async function GET(request: Request) {
    try {
      const params = parseQueryParams(request.url);
      const result = await getProducts(params);
      return Response.json({ success: true, data: result });
    } catch (error) {
      return Response.json({ success: false, error: '...' }, { status: 500 });
    }
  }
  ```

### 규칙 8: 타입 정의는 명시적으로
- **모든 함수의 매개변수와 반환 타입 명시**
- **인터페이스는 서비스 파일 상단에 정의**
  ```typescript
  // ✅ 타입 정의
  export interface CreateProductInput {
    userId: string;
    sourceInfo: ProductSourceInfo;
    originalData: ProductOriginalData;
    salesSettings: ProductSalesSettings;
  }

  export interface ProductListResult {
    products: Product[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  // ✅ 함수 정의
  export async function createProduct(data: CreateProductInput): Promise<Product> {
    // ...
  }

  export async function getProducts(params: GetProductsParams): Promise<ProductListResult> {
    // ...
  }
  ```

### 규칙 9: 환경 변수 및 설정은 안전하게 관리
- **민감한 정보는 .env 파일에 저장**
- **환경 변수 접근은 process.env 사용**
- **기본값 제공**
  ```typescript
  // ✅ 환경 변수 사용
  const OPENMARKET_API_KEY = process.env.OPENMARKET_API_KEY || '';
  const OPENMARKET_API_URL = process.env.OPENMARKET_API_URL || 'https://api.example.com';

  if (!OPENMARKET_API_KEY) {
    throw new Error('OPENMARKET_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  export async function registerProductToOpenMarket(productId: string): Promise<void> {
    const response = await axios.post(
      `${OPENMARKET_API_URL}/products`,
      { productId },
      { headers: { Authorization: `Bearer ${OPENMARKET_API_KEY}` } }
    );
  }
  ```

### 규칙 10: 로깅 및 모니터링
- **중요한 작업은 로그 기록**
- **에러 발생 시 상세 로그 남기기**
  ```typescript
  // ✅ 로깅
  export async function processOrder(orderId: string): Promise<void> {
    console.log(`[OrderService] 주문 처리 시작: ${orderId}`);

    try {
      const order = await prisma.order.findUnique({ where: { id: orderId } });

      if (!order) {
        console.error(`[OrderService] 주문을 찾을 수 없음: ${orderId}`);
        throw new NotFoundError('주문을 찾을 수 없습니다.');
      }

      // 주문 처리 로직
      await updateOrderStatus(orderId, OrderStatus.PROCESSING);

      console.log(`[OrderService] 주문 처리 완료: ${orderId}`);
    } catch (error) {
      console.error(`[OrderService] 주문 처리 실패: ${orderId}`, error);
      throw error;
    }
  }
  ```

## 주요 서비스 설명

### user.service.ts
- **역할**: 사용자 관리 및 인증
- **주요 함수**:
  - `createUser()`: 사용자 등록 (비밀번호 해싱)
  - `getUserById()`: 사용자 조회
  - `updateUserProfile()`: 프로필 업데이트
  - `authenticateUser()`: 로그인 인증

### product.service.ts
- **역할**: 상품 CRUD 및 관리
- **주요 함수**:
  - `createProduct()`: 상품 생성
  - `getProducts()`: 상품 목록 조회 (페이지네이션, 필터링)
  - `updateProduct()`: 상품 수정
  - `deleteProduct()`: 상품 삭제 (소프트 삭제)
  - `updateProductStatus()`: 상품 상태 변경
  - `calculateSalePrice()`: 마진율 적용 판매가 계산

### order.service.ts
- **역할**: 주문 처리 및 관리
- **주요 함수**:
  - `createOrder()`: 주문 생성 (오픈마켓 웹훅 수신)
  - `getOrders()`: 주문 목록 조회
  - `updateOrderStatus()`: 주문 상태 업데이트
  - `calculateProfit()`: 순이익 및 수익률 계산
  - `processOrder()`: 주문 처리 (소싱 자동화)

### crawling.service.ts
- **역할**: 상품 크롤링
- **주요 함수**:
  - `crawlProduct()`: 타오바오/아마존/알리바바 상품 크롤링
  - `extractProductData()`: HTML에서 상품 정보 추출
  - `validateProductData()`: 크롤링 데이터 검증

### translation.service.ts
- **역할**: 번역 처리
- **주요 함수**:
  - `translateProductData()`: 상품 정보 한국어 번역
  - `optimizeForSEO()`: SEO 최적화 제목 생성
  - `detectLanguage()`: 언어 감지

### image-processing.service.ts
- **역할**: 이미지 처리
- **주요 함수**:
  - `processProductImages()`: 이미지 다운로드 및 최적화
  - `removeWatermark()`: 워터마크 제거 (AI 모델 사용)
  - `generateThumbnails()`: 썸네일 생성
  - `uploadToS3()`: AWS S3 업로드

### openmarket.service.ts
- **역할**: 오픈마켓 연동
- **주요 함수**:
  - `registerProduct()`: 오픈마켓 상품 등록
  - `syncOrders()`: 주문 동기화
  - `updateInventory()`: 재고 동기화
  - `handleWebhook()`: 웹훅 처리

### payment.service.ts
- **역할**: 결제 연동
- **주요 함수**:
  - `processPayment()`: 결제 처리
  - `refundPayment()`: 환불 처리
  - `verifyPayment()`: 결제 검증

## 코딩 컨벤션

### 파일 구조
```typescript
// 1. Import 문
import { PrismaClient, Product, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';

// 2. Prisma 클라이언트 초기화
const prisma = new PrismaClient();

// 3. 타입 및 인터페이스 정의
export interface CreateProductInput {
  // ...
}

// 4. Zod 스키마 정의
export const CreateProductSchema = z.object({
  // ...
});

// 5. 에러 클래스 정의
export class ProductNotFoundError extends Error {
  // ...
}

// 6. 공개 서비스 함수
export async function createProduct(data: CreateProductInput): Promise<Product> {
  // ...
}

export async function getProducts(params: GetProductsParams): Promise<ProductListResult> {
  // ...
}

// 7. 비공개 헬퍼 함수
async function calculateSalePrice(costPrice: number, marginRate: number): Promise<number> {
  // ...
}
```

### 네이밍
- **함수명**: camelCase + 동사로 시작 (예: createProduct, getOrderById)
- **인터페이스**: PascalCase (예: CreateProductInput, ProductListResult)
- **에러 클래스**: PascalCase + Error 접미사 (예: NotFoundError, ValidationError)
- **상수**: UPPER_SNAKE_CASE (예: MAX_RETRY_COUNT, API_TIMEOUT)

## 테스트 규칙
- **각 서비스 함수는 단위 테스트 작성 필수**
- **Jest 및 Supertest 사용**
- **Prisma 모킹 또는 테스트 데이터베이스 사용**
```typescript
// product.service.test.ts
import { createProduct, getProductById } from './product.service';
import { prismaMock } from '../lib/prisma.mock';

describe('ProductService', () => {
  describe('createProduct', () => {
    it('상품을 성공적으로 생성해야 합니다', async () => {
      const mockProduct = { id: '1', title: '테스트 상품', status: 'DRAFT' };
      prismaMock.product.create.mockResolvedValue(mockProduct);

      const result = await createProduct({ /* ... */ });

      expect(result).toEqual(mockProduct);
      expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
    });

    it('유효하지 않은 데이터로 호출 시 ValidationError를 던져야 합니다', async () => {
      await expect(createProduct({ /* invalid data */ })).rejects.toThrow(ValidationError);
    });
  });
});
```

## 참고 자료
- **Prisma 문서**: https://www.prisma.io/docs
- **Zod 문서**: https://zod.dev
- **Axios 문서**: https://axios-http.com/docs/intro
