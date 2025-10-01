# API 모듈 - API 엔드포인트 작성 규칙

## 모듈 역할
- **API 계층**: HTTP 요청을 받아 서비스 계층을 호출하고 응답을 반환합니다.
- **Next.js 14 App Router 기반**: `src/app/api/` 디렉토리의 Route Handlers를 사용합니다.
- **REST + GraphQL 지원**: RESTful API와 GraphQL API를 모두 제공합니다.

## 디렉토리 구조
```
src/app/api/
├── auth/                           # 인증 관련 API
│   ├── [...nextauth]/
│   │   └── route.ts               # NextAuth.js 인증 엔드포인트
│   └── register/
│       └── route.ts               # 회원가입 API
├── v1/                            # REST API v1
│   ├── products/
│   │   ├── route.ts              # GET /api/v1/products, POST /api/v1/products
│   │   ├── [id]/
│   │   │   └── route.ts          # GET/PATCH/DELETE /api/v1/products/:id
│   │   └── crawl/
│   │       └── route.ts          # POST /api/v1/products/crawl
│   ├── orders/
│   │   ├── route.ts              # GET /api/v1/orders
│   │   └── [id]/
│   │       └── route.ts          # GET/PATCH /api/v1/orders/:id
│   └── analytics/
│       └── dashboard/
│           └── route.ts          # GET /api/v1/analytics/dashboard
├── graphql/
│   └── route.ts                  # POST /api/graphql
└── health/
    └── route.ts                  # GET /api/health
```

## 핵심 규칙

### 규칙 1: Next.js 14 Route Handler 패턴 사용
- **각 HTTP 메서드는 별도 함수로 export**
- **함수명은 HTTP 메서드와 동일** (GET, POST, PATCH, DELETE 등)
  ```typescript
  // ✅ 좋은 예시 - src/app/api/v1/products/route.ts
  import { NextRequest, NextResponse } from 'next/server';
  import { getProducts, createProduct } from '@/services/product.service';

  // GET /api/v1/products
  export async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '10');

      const result = await getProducts({ page, limit });

      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '상품 목록 조회 실패' },
        { status: 500 }
      );
    }
  }

  // POST /api/v1/products
  export async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      const product = await createProduct(body);

      return NextResponse.json(
        { success: true, data: product },
        { status: 201 }
      );
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '상품 생성 실패' },
        { status: 500 }
      );
    }
  }
  ```

### 규칙 2: 일관된 응답 형식 사용
- **성공 응답**: `{ success: true, data: {...} }`
- **실패 응답**: `{ success: false, error: { message: "...", code: "..." } }`
- **HTTP 상태 코드 명시**
  ```typescript
  // ✅ 성공 응답 (200 OK)
  return NextResponse.json({
    success: true,
    data: {
      products: [...],
      pagination: { page: 1, limit: 10, total: 100 }
    }
  });

  // ✅ 생성 성공 응답 (201 Created)
  return NextResponse.json(
    { success: true, data: newProduct },
    { status: 201 }
  );

  // ✅ 에러 응답 (400 Bad Request)
  return NextResponse.json(
    {
      success: false,
      error: {
        message: '유효하지 않은 요청입니다.',
        code: 'INVALID_INPUT',
        details: validationErrors
      }
    },
    { status: 400 }
  );

  // ✅ 에러 응답 (404 Not Found)
  return NextResponse.json(
    { success: false, error: { message: '상품을 찾을 수 없습니다.', code: 'NOT_FOUND' } },
    { status: 404 }
  );

  // ✅ 에러 응답 (500 Internal Server Error)
  return NextResponse.json(
    { success: false, error: { message: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' } },
    { status: 500 }
  );
  ```

### 규칙 3: 서비스 계층만 호출 (비즈니스 로직 분리)
- **API 엔드포인트는 서비스 함수를 호출만 수행**
- **데이터베이스 접근, 비즈니스 로직은 서비스 계층에 위임**
  ```typescript
  // ✅ 좋은 예시 - API는 서비스만 호출
  import { getProductById, updateProduct } from '@/services/product.service';

  export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      const body = await request.json();
      const updatedProduct = await updateProduct(params.id, body);

      return NextResponse.json({ success: true, data: updatedProduct });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '상품 수정 실패' },
        { status: 500 }
      );
    }
  }

  // ❌ 나쁜 예시 - API에서 직접 데이터베이스 접근
  export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    const body = await request.json();
    const product = await prisma.product.update({ // ❌ 직접 Prisma 호출 금지
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json({ success: true, data: product });
  }
  ```

### 규칙 4: 인증 및 권한 확인
- **보호된 엔드포인트는 NextAuth.js 세션 검증 필수**
- **권한 확인은 서비스 계층에서 수행**
  ```typescript
  import { getServerSession } from 'next-auth/next';
  import { authOptions } from '@/lib/auth';

  // ✅ 인증 확인
  export async function POST(request: NextRequest) {
    // 1. 세션 확인
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: { message: '인증이 필요합니다.', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // 2. 요청 처리
    try {
      const body = await request.json();
      const product = await createProduct({
        ...body,
        userId: session.user.id, // 세션에서 사용자 ID 추출
      });

      return NextResponse.json({ success: true, data: product }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '상품 생성 실패' },
        { status: 500 }
      );
    }
  }
  ```

### 규칙 5: 입력 검증 (Validation)
- **요청 데이터는 반드시 검증**
- **Zod 스키마를 사용하여 타입 안정성 확보**
  ```typescript
  import { z } from 'zod';

  const CreateProductSchema = z.object({
    title: z.string().min(1).max(500),
    price: z.number().positive(),
    description: z.string().optional(),
    images: z.array(z.string().url()).min(1),
  });

  export async function POST(request: NextRequest) {
    try {
      const body = await request.json();

      // 입력 검증
      const validatedData = CreateProductSchema.parse(body);

      // 서비스 호출
      const product = await createProduct(validatedData);

      return NextResponse.json({ success: true, data: product }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: '유효하지 않은 입력입니다.',
              code: 'VALIDATION_ERROR',
              details: error.errors,
            }
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: '상품 생성 실패' },
        { status: 500 }
      );
    }
  }
  ```

### 규칙 6: 에러 처리
- **모든 에러는 적절한 HTTP 상태 코드와 함께 반환**
- **에러 타입별로 다른 응답 제공**
  ```typescript
  import { NotFoundError, ValidationError } from '@/services/errors';

  export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      const product = await getProductById(params.id);
      return NextResponse.json({ success: true, data: product });
    } catch (error) {
      // NotFoundError 처리
      if (error instanceof NotFoundError) {
        return NextResponse.json(
          { success: false, error: { message: error.message, code: 'NOT_FOUND' } },
          { status: 404 }
        );
      }

      // ValidationError 처리
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { success: false, error: { message: error.message, code: 'VALIDATION_ERROR' } },
          { status: 400 }
        );
      }

      // 기타 에러 처리
      console.error('[API Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '서버 오류가 발생했습니다.', code: 'INTERNAL_ERROR' } },
        { status: 500 }
      );
    }
  }
  ```

### 규칙 7: 쿼리 파라미터 및 동적 라우트 처리
- **쿼리 파라미터는 `request.nextUrl.searchParams`로 접근**
- **동적 라우트 파라미터는 `params`로 접근**
  ```typescript
  // ✅ 쿼리 파라미터 처리
  export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as ProductStatus | null;
    const search = searchParams.get('search') || '';

    const result = await getProducts({
      page,
      limit,
      ...(status && { status }),
      ...(search && { search }),
    });

    return NextResponse.json({ success: true, data: result });
  }

  // ✅ 동적 라우트 파라미터 처리 - src/app/api/v1/products/[id]/route.ts
  export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    const product = await getProductById(params.id);
    return NextResponse.json({ success: true, data: product });
  }
  ```

### 규칙 8: CORS 및 헤더 설정
- **필요 시 CORS 헤더 추가**
- **보안 헤더 설정**
  ```typescript
  // ✅ CORS 헤더 추가
  export async function GET(request: NextRequest) {
    const data = await getPublicData();

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }

  // OPTIONS 메서드 처리 (CORS Preflight)
  export async function OPTIONS() {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  ```

### 규칙 9: 페이지네이션 및 정렬
- **페이지네이션은 표준 형식 사용**
- **정렬 옵션 제공**
  ```typescript
  export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const result = await getProducts({
      page,
      limit,
      sortBy,
      order,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.products,
        pagination: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNext: result.pagination.page < result.pagination.totalPages,
          hasPrev: result.pagination.page > 1,
        },
      },
    });
  }
  ```

### 규칙 10: 로깅
- **중요한 요청은 로그 기록**
- **에러 발생 시 상세 로그 남기기**
  ```typescript
  export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    console.log('[API] POST /api/v1/products', {
      userId: session?.user?.id,
      timestamp: new Date().toISOString(),
    });

    try {
      const body = await request.json();
      const product = await createProduct(body);

      console.log('[API] 상품 생성 성공', { productId: product.id });

      return NextResponse.json({ success: true, data: product }, { status: 201 });
    } catch (error) {
      console.error('[API] 상품 생성 실패', {
        error,
        userId: session?.user?.id,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { success: false, error: '상품 생성 실패' },
        { status: 500 }
      );
    }
  }
  ```

## HTTP 상태 코드 가이드

### 성공 응답
- **200 OK**: 조회, 수정 성공
- **201 Created**: 생성 성공
- **204 No Content**: 삭제 성공 (응답 본문 없음)

### 클라이언트 에러
- **400 Bad Request**: 잘못된 요청 (유효성 검증 실패)
- **401 Unauthorized**: 인증 필요
- **403 Forbidden**: 권한 없음
- **404 Not Found**: 리소스를 찾을 수 없음
- **409 Conflict**: 충돌 (예: 중복된 이메일)

### 서버 에러
- **500 Internal Server Error**: 서버 내부 오류
- **503 Service Unavailable**: 서비스 일시적으로 사용 불가

## API 문서화
- **각 엔드포인트는 주석으로 설명 추가**
  ```typescript
  /**
   * 상품 목록 조회 API
   * GET /api/v1/products
   *
   * Query Parameters:
   * - page: 페이지 번호 (기본값: 1)
   * - limit: 페이지당 항목 수 (기본값: 10)
   * - status: 상품 상태 필터 (DRAFT, READY, REGISTERED 등)
   * - search: 검색어 (제목으로 검색)
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     items: Product[],
   *     pagination: { page, limit, total, totalPages, hasNext, hasPrev }
   *   }
   * }
   */
  export async function GET(request: NextRequest) {
    // ...
  }
  ```

## GraphQL API (선택 사항)
- **GraphQL 엔드포인트는 별도 파일로 관리**
- **src/app/api/graphql/route.ts**에서 처리
  ```typescript
  import { createSchema, createYoga } from 'graphql-yoga';
  import { resolvers } from '@/lib/graphql/resolvers';
  import { typeDefs } from '@/lib/graphql/schema';

  const yoga = createYoga({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/api/graphql',
    fetchAPI: { Response },
  });

  export async function POST(request: Request) {
    return yoga.handle(request);
  }

  export async function GET(request: Request) {
    return yoga.handle(request);
  }
  ```

## 테스트 규칙
- **각 API 엔드포인트는 통합 테스트 작성 필수**
- **Supertest 사용**
  ```typescript
  // products.api.test.ts
  import { createMocks } from 'node-mocks-http';
  import { GET, POST } from '@/app/api/v1/products/route';

  describe('GET /api/v1/products', () => {
    it('상품 목록을 성공적으로 조회해야 합니다', async () => {
      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toBeInstanceOf(Array);
    });
  });
  ```

## 참고 자료
- **Next.js Route Handlers**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **NextAuth.js**: https://next-auth.js.org
- **HTTP 상태 코드**: https://developer.mozilla.org/ko/docs/Web/HTTP/Status
