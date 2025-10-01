# Lib 모듈 - 유틸리티 및 설정 파일

## 모듈 역할
- **유틸리티 함수**: 프로젝트 전반에서 재사용되는 공통 함수를 제공합니다.
- **설정 파일**: Prisma, NextAuth, GraphQL 등 핵심 라이브러리 설정을 관리합니다.
- **헬퍼 모듈**: 타입 변환, 데이터 포맷팅, 검증 등 보조 기능을 제공합니다.

## 디렉토리 구조
```
src/lib/
├── prisma.ts          # Prisma 클라이언트 싱글톤
├── auth.ts            # NextAuth.js 설정
├── utils.ts           # 공통 유틸리티 함수
└── graphql/           # GraphQL 스키마 및 리졸버
    ├── schema.ts      # GraphQL 타입 정의
    └── resolvers.ts   # GraphQL 리졸버
```

## 핵심 규칙

### 규칙 1: 순수 함수 작성
- **부수 효과(Side Effect) 최소화**
- **입력이 같으면 항상 같은 출력 반환**
- **외부 상태에 의존하지 않음**
  ```typescript
  // ✅ 좋은 예시 - 순수 함수
  export function formatPrice(price: number, currency: string = 'KRW'): string {
    if (currency === 'KRW') {
      return `₩${price.toLocaleString('ko-KR')}`;
    }
    return `$${price.toFixed(2)}`;
  }

  // ❌ 나쁜 예시 - 부수 효과 존재
  let globalCounter = 0;
  export function incrementAndFormat(price: number): string {
    globalCounter++; // ❌ 전역 상태 변경
    return `₩${price.toLocaleString('ko-KR')}`;
  }
  ```

### 규칙 2: 타입 안정성 확보
- **모든 함수는 명시적 타입 정의**
- **제네릭 타입 활용으로 재사용성 향상**
  ```typescript
  // ✅ 명시적 타입 정의
  export function parseQueryParam(
    value: string | null,
    defaultValue: number
  ): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // ✅ 제네릭 타입 활용
  export function groupBy<T, K extends keyof T>(
    array: T[],
    key: K
  ): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }
  ```

### 규칙 3: 단일 책임 원칙 (SRP)
- **하나의 함수는 하나의 작업만 수행**
- **작은 함수를 조합하여 복잡한 로직 구현**
  ```typescript
  // ✅ 단일 책임 함수들
  export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  export function isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    return phoneRegex.test(phone);
  }

  export function validateUserInput(email: string, phone: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!isValidEmail(email)) {
      errors.push('유효하지 않은 이메일 형식입니다.');
    }

    if (!isValidPhoneNumber(phone)) {
      errors.push('유효하지 않은 전화번호 형식입니다.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  ```

### 규칙 4: 에러 처리
- **예상 가능한 에러는 명시적으로 처리**
- **타입 가드를 활용한 안전한 에러 처리**
  ```typescript
  // ✅ 안전한 에러 처리
  export function safeParseJSON<T>(jsonString: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('[safeParseJSON] JSON 파싱 실패:', error);
      return defaultValue;
    }
  }

  // ✅ 타입 가드
  export function isError(error: unknown): error is Error {
    return error instanceof Error;
  }

  export function getErrorMessage(error: unknown): string {
    if (isError(error)) {
      return error.message;
    }
    return String(error);
  }
  ```

### 규칙 5: 환경 변수 및 설정 관리
- **환경 변수 접근은 중앙화**
- **기본값 제공 및 검증**
  ```typescript
  // ✅ 환경 변수 관리 (src/lib/config.ts)
  export const config = {
    database: {
      url: process.env.DATABASE_URL || '',
    },
    auth: {
      secret: process.env.NEXTAUTH_SECRET || '',
      url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    },
    api: {
      openmarket: {
        apiKey: process.env.OPENMARKET_API_KEY || '',
        apiUrl: process.env.OPENMARKET_API_URL || '',
      },
      translation: {
        apiKey: process.env.TRANSLATION_API_KEY || '',
      },
    },
  } as const;

  // 환경 변수 검증
  export function validateConfig(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'OPENMARKET_API_KEY',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }
  }
  ```

## 주요 파일 설명

### prisma.ts - Prisma 클라이언트 싱글톤
- **역할**: Prisma 클라이언트 인스턴스를 전역으로 관리하여 중복 연결 방지
- **패턴**: 싱글톤 패턴 사용
  ```typescript
  import { PrismaClient } from '@prisma/client';

  // 전역 타입 선언
  declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
  }

  // 싱글톤 패턴: 개발 환경에서 Hot Reload 시 재사용
  export const prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
  }

  // 애플리케이션 종료 시 연결 해제
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
  ```

### auth.ts - NextAuth.js 설정
- **역할**: 인증 설정 및 세션 관리
- **Providers**: Credentials 기반 로그인
  ```typescript
  import { NextAuthOptions } from 'next-auth';
  import CredentialsProvider from 'next-auth/providers/credentials';
  import { authenticateUser } from '@/services/user.service';
  import bcrypt from 'bcryptjs';

  export const authOptions: NextAuthOptions = {
    providers: [
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: '이메일', type: 'email' },
          password: { label: '비밀번호', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            throw new Error('이메일과 비밀번호를 입력해주세요.');
          }

          const user = await authenticateUser(
            credentials.email,
            credentials.password
          );

          if (!user) {
            throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        },
      }),
    ],
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30일
    },
    pages: {
      signIn: '/auth/login',
      signOut: '/auth/logout',
      error: '/auth/error',
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.role = user.role;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
        }
        return session;
      },
    },
    secret: process.env.NEXTAUTH_SECRET,
  };
  ```

### utils.ts - 공통 유틸리티 함수
- **역할**: 프로젝트 전반에서 재사용되는 함수 모음
  ```typescript
  import { type ClassValue, clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  /**
   * Tailwind CSS 클래스 병합 유틸리티 (shadcn/ui에서 사용)
   */
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }

  /**
   * 가격 포맷팅
   */
  export function formatPrice(price: number, currency: string = 'KRW'): string {
    if (currency === 'KRW') {
      return `₩${price.toLocaleString('ko-KR')}`;
    }
    return `$${price.toFixed(2)}`;
  }

  /**
   * 날짜 포맷팅
   */
  export function formatDate(date: Date | string, format: 'short' | 'long' = 'short'): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    if (format === 'short') {
      return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }

    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  /**
   * 상대 시간 표시 (예: "3시간 전", "2일 전")
   */
  export function timeAgo(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;

    return formatDate(d, 'short');
  }

  /**
   * 쿼리 파라미터 파싱
   */
  export function parseQueryParam(
    value: string | null,
    defaultValue: number
  ): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 배열을 특정 키로 그룹화
   */
  export function groupBy<T, K extends keyof T>(
    array: T[],
    key: K
  ): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  /**
   * 딥 클론 (Deep Clone)
   */
  export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 디바운스 함수
   */
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * 슬러그 생성 (URL-friendly string)
   */
  export function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * 랜덤 문자열 생성
   */
  export function generateRandomString(length: number = 10): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * 안전한 JSON 파싱
   */
  export function safeParseJSON<T>(jsonString: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('[safeParseJSON] JSON 파싱 실패:', error);
      return defaultValue;
    }
  }

  /**
   * 에러 메시지 추출
   */
  export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
  ```

### graphql/schema.ts - GraphQL 타입 정의
- **역할**: GraphQL 스키마 정의
  ```typescript
  export const typeDefs = `
    type User {
      id: ID!
      email: String!
      name: String!
      role: String!
      createdAt: String!
    }

    type Product {
      id: ID!
      userId: String!
      status: String!
      originalData: JSON!
      createdAt: String!
      updatedAt: String!
    }

    type Query {
      me: User
      products(page: Int, limit: Int): ProductListResult!
      product(id: ID!): Product
    }

    type Mutation {
      createProduct(input: CreateProductInput!): Product!
      updateProduct(id: ID!, input: UpdateProductInput!): Product!
      deleteProduct(id: ID!): Boolean!
    }

    scalar JSON

    type ProductListResult {
      products: [Product!]!
      pagination: Pagination!
    }

    type Pagination {
      page: Int!
      limit: Int!
      total: Int!
      totalPages: Int!
    }

    input CreateProductInput {
      sourceUrl: String!
      sourcePlatform: String!
    }

    input UpdateProductInput {
      status: String
    }
  `;
  ```

### graphql/resolvers.ts - GraphQL 리졸버
- **역할**: GraphQL 쿼리 및 뮤테이션 처리
  ```typescript
  import { getProducts, getProductById, createProduct } from '@/services/product.service';

  export const resolvers = {
    Query: {
      products: async (_: any, { page = 1, limit = 10 }: { page?: number; limit?: number }) => {
        return await getProducts({ page, limit });
      },
      product: async (_: any, { id }: { id: string }) => {
        return await getProductById(id);
      },
    },
    Mutation: {
      createProduct: async (_: any, { input }: { input: any }) => {
        return await createProduct(input);
      },
    },
  };
  ```

## 코딩 컨벤션

### 네이밍
- **함수명**: camelCase + 동사로 시작 (예: formatPrice, parseQueryParam)
- **상수**: UPPER_SNAKE_CASE (예: MAX_RETRY_COUNT)
- **타입/인터페이스**: PascalCase (예: UserConfig, ApiResponse)

### 파일 구조
```typescript
// 1. Import 문
import { PrismaClient } from '@prisma/client';
import { clsx } from 'clsx';

// 2. 타입 정의
export interface Config {
  // ...
}

// 3. 상수 정의
export const MAX_RETRY_COUNT = 3;

// 4. 공개 함수
export function formatPrice(price: number): string {
  // ...
}

// 5. 비공개 헬퍼 함수
function sanitizeInput(input: string): string {
  // ...
}
```

## 테스트 규칙
- **각 유틸리티 함수는 단위 테스트 작성 필수**
- **순수 함수이므로 테스트가 간단함**
  ```typescript
  // utils.test.ts
  import { formatPrice, timeAgo, slugify } from './utils';

  describe('formatPrice', () => {
    it('KRW 통화로 가격을 포맷팅해야 합니다', () => {
      expect(formatPrice(10000)).toBe('₩10,000');
    });

    it('USD 통화로 가격을 포맷팅해야 합니다', () => {
      expect(formatPrice(99.99, 'USD')).toBe('$99.99');
    });
  });

  describe('slugify', () => {
    it('문자열을 URL-friendly 형식으로 변환해야 합니다', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
      expect(slugify('테스트 상품 123')).toBe('123');
    });
  });
  ```

## 참고 자료
- **Prisma**: https://www.prisma.io/docs
- **NextAuth.js**: https://next-auth.js.org
- **GraphQL**: https://graphql.org/learn
- **clsx**: https://github.com/lukeed/clsx
