# Prisma 모듈 - 데이터베이스 스키마 및 마이그레이션

## 모듈 역할
- **데이터베이스 스키마 정의**: Prisma Schema Language를 사용하여 데이터 모델을 정의합니다.
- **마이그레이션 관리**: 스키마 변경을 추적하고 데이터베이스에 적용합니다.
- **타입 안정성**: TypeScript 타입을 자동 생성하여 타입 안정성을 확보합니다.

## 디렉토리 구조
```
prisma/
├── schema.prisma          # Prisma 스키마 정의 파일
├── migrations/            # 마이그레이션 파일 (자동 생성)
│   ├── 20240930123456_init/
│   │   └── migration.sql
│   └── migration_lock.toml
└── seed.ts               # 시드 데이터 (선택 사항)
```

## 핵심 규칙

### 규칙 1: 스키마 파일 구조
- **순서**: generator → datasource → enums → models
- **명명 규칙**: 모델은 단수형, PascalCase 사용
  ```prisma
  // ✅ 권장 구조
  // 1. Generator
  generator client {
    provider = "prisma-client-js"
  }

  // 2. Datasource
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  // 3. Enums
  enum UserRole {
    ADMIN
    SELLER
    VIEWER
  }

  // 4. Models
  model User {
    id        String   @id @default(cuid())
    email     String   @unique
    name      String
    role      UserRole @default(SELLER)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@map("users")
  }
  ```

### 규칙 2: 모델 명명 규칙
- **모델명**: 단수형, PascalCase (예: User, Product, Order)
- **필드명**: camelCase (예: userId, createdAt, isActive)
- **테이블명**: 복수형, snake_case - `@@map()` 사용 (예: users, products, orders)
- **열거형**: PascalCase (예: UserRole, ProductStatus)
  ```prisma
  // ✅ 올바른 명명
  model Product {
    id          String        @id @default(cuid())
    userId      String
    productName String
    status      ProductStatus @default(DRAFT)

    @@map("products")
  }

  enum ProductStatus {
    DRAFT
    PROCESSING
    READY
    REGISTERED
  }
  ```

### 규칙 3: 관계 설정
- **일대다(1:N)**: `@relation` 사용
- **다대다(N:M)**: 명시적 중간 테이블 사용 (권장)
- **외래키**: 명시적으로 정의
  ```prisma
  // ✅ 일대다 관계
  model User {
    id       String    @id @default(cuid())
    products Product[]
    orders   Order[]

    @@map("users")
  }

  model Product {
    id     String @id @default(cuid())
    userId String

    user User @relation(fields: [userId], references: [id])

    @@map("products")
  }

  // ✅ 다대다 관계 (명시적 중간 테이블)
  model Product {
    id            String               @id @default(cuid())
    registrations ProductRegistration[]

    @@map("products")
  }

  model ProductRegistration {
    id                String             @id @default(cuid())
    productId         String
    platform          OpenMarketPlatform
    platformProductId String?

    product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

    @@unique([productId, platform])
    @@map("product_registrations")
  }
  ```

### 규칙 4: JSON 타입 활용
- **유연한 데이터 구조는 JSON 타입 사용**
- **변경이 잦은 필드는 JSON으로 관리**
- **TypeScript 타입 정의와 함께 사용**
  ```prisma
  model Product {
    id             String @id @default(cuid())
    sourceInfo     Json   // ProductSourceInfo 타입
    originalData   Json   // ProductOriginalData 타입
    translatedData Json?  // ProductTranslatedData 타입
    salesSettings  Json   // ProductSalesSettings 타입

    @@map("products")
  }
  ```

  ```typescript
  // TypeScript 타입 정의 (src/types/product.ts)
  export interface ProductSourceInfo {
    sourceUrl: string;
    sourcePlatform: 'TAOBAO' | 'AMAZON' | 'ALIBABA';
    sourceProductId: string;
    lastCrawledAt?: Date;
  }

  export interface ProductOriginalData {
    title: string;
    description?: string;
    price: number;
    images: string[];
    specifications?: Record<string, any>;
  }
  ```

### 규칙 5: 기본값 및 자동 생성 필드
- **ID**: `@default(cuid())` 또는 `@default(uuid())` 사용
- **타임스탬프**: `@default(now())` 및 `@updatedAt` 사용
- **기본값**: 가능한 한 명시적으로 설정
  ```prisma
  model User {
    id          String     @id @default(cuid())
    email       String     @unique
    name        String
    role        UserRole   @default(SELLER)
    status      UserStatus @default(ACTIVE)
    createdAt   DateTime   @default(now())
    updatedAt   DateTime   @updatedAt
    lastLoginAt DateTime?

    @@map("users")
  }
  ```

### 규칙 6: 인덱스 및 제약 조건
- **자주 조회되는 필드에 인덱스 추가**
- **유니크 제약**: `@unique` 또는 `@@unique([])` 사용
- **복합 인덱스**: `@@index([])` 사용
  ```prisma
  model User {
    id       String @id @default(cuid())
    email    String @unique // 단일 필드 유니크
    name     String
    status   String
    userId   String
    role     String

    // 복합 인덱스 (자주 조회되는 필드 조합)
    @@index([status, role])
    @@map("users")
  }

  model ProductRegistration {
    id        String @id @default(cuid())
    productId String
    platform  String

    // 복합 유니크 제약 (상품당 플랫폼별로 하나의 등록만 허용)
    @@unique([productId, platform])
    @@map("product_registrations")
  }
  ```

### 규칙 7: onDelete 동작 정의
- **Cascade**: 부모 삭제 시 자식도 함께 삭제
- **SetNull**: 부모 삭제 시 자식의 외래키를 NULL로 설정
- **Restrict**: 부모에 자식이 있으면 삭제 불가
  ```prisma
  model Product {
    id     String         @id @default(cuid())
    images ProductImage[]

    @@map("products")
  }

  model ProductImage {
    id        String @id @default(cuid())
    productId String

    // 상품 삭제 시 이미지도 함께 삭제
    product Product @relation(fields: [productId], references: [id], onDelete: Cascade)

    @@map("product_images")
  }

  model Order {
    id        String @id @default(cuid())
    productId String

    // 상품 삭제 시 주문은 유지하되 외래키를 NULL로 설정
    product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

    @@map("orders")
  }
  ```

### 규칙 8: 소프트 삭제 구현
- **status 필드로 삭제 상태 관리**
- **deletedAt 필드 사용 (선택 사항)**
  ```prisma
  model Product {
    id        String        @id @default(cuid())
    status    ProductStatus @default(DRAFT)
    deletedAt DateTime?
    createdAt DateTime      @default(now())
    updatedAt DateTime      @updatedAt

    @@map("products")
  }

  enum ProductStatus {
    DRAFT
    PROCESSING
    READY
    REGISTERED
    ERROR
    ARCHIVED // 소프트 삭제 상태
  }
  ```

### 규칙 9: 열거형(Enum) 사용
- **상태 필드는 열거형으로 정의**
- **가능한 값이 제한적일 때 사용**
  ```prisma
  enum UserRole {
    ADMIN
    SELLER
    VIEWER
  }

  enum ProductStatus {
    DRAFT
    PROCESSING
    READY
    REGISTERED
    ERROR
    ARCHIVED
  }

  enum OrderStatus {
    RECEIVED
    CONFIRMED
    PURCHASING
    PURCHASED
    SHIPPING
    DELIVERED
    CANCELLED
    REFUNDED
  }

  model User {
    id   String   @id @default(cuid())
    role UserRole @default(SELLER)

    @@map("users")
  }
  ```

### 규칙 10: 마이그레이션 관리
- **스키마 변경 후 마이그레이션 생성**
- **의미 있는 마이그레이션 이름 사용**
- **프로덕션 배포 전 마이그레이션 검증**
  ```bash
  # ✅ 마이그레이션 생성 (개발 환경)
  npx prisma migrate dev --name add_product_status_field

  # ✅ 마이그레이션 적용 (프로덕션 환경)
  npx prisma migrate deploy

  # ✅ 마이그레이션 상태 확인
  npx prisma migrate status

  # ✅ 스키마와 데이터베이스 동기화 (개발 환경만)
  npx prisma db push
  ```

## 주요 명령어

### 개발 환경
```bash
# Prisma 클라이언트 생성 (스키마 변경 후 필수)
npx prisma generate

# 마이그레이션 생성 및 적용
npx prisma migrate dev --name migration_name

# 스키마를 데이터베이스에 강제 동기화 (마이그레이션 없이)
npx prisma db push

# 데이터베이스 초기화 (모든 데이터 삭제)
npx prisma migrate reset

# Prisma Studio 실행 (데이터베이스 GUI)
npx prisma studio
```

### 프로덕션 환경
```bash
# 마이그레이션 적용 (프로덕션)
npx prisma migrate deploy

# 마이그레이션 상태 확인
npx prisma migrate status
```

## 스키마 예시

### 완전한 User 모델
```prisma
model User {
  id          String     @id @default(cuid())
  email       String     @unique
  name        String
  password    String
  role        UserRole   @default(SELLER)
  status      UserStatus @default(ACTIVE)
  profile     Json?      // UserProfile 타입
  preferences Json?      // UserPreferences 타입
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  lastLoginAt DateTime?

  // 관계
  orders       Order[]
  products     Product[]
  activityLogs ActivityLog[]

  @@map("users")
}

enum UserRole {
  ADMIN
  SELLER
  VIEWER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

### 완전한 Product 모델
```prisma
model Product {
  id     String @id @default(cuid())
  userId String

  // JSON 필드
  sourceInfo     Json  // ProductSourceInfo
  originalData   Json  // ProductOriginalData
  translatedData Json? // ProductTranslatedData
  salesSettings  Json  // ProductSalesSettings
  monitoring     Json? // ProductMonitoring
  statistics     Json? // ProductStatistics

  // 상태
  status ProductStatus @default(DRAFT)

  // 타임스탬프
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 관계
  user            User                 @relation(fields: [userId], references: [id])
  orders          Order[]
  images          ProductImage[]
  registrations   ProductRegistration[]
  categoryMapping CategoryMapping[]

  @@map("products")
}

enum ProductStatus {
  DRAFT
  PROCESSING
  READY
  REGISTERED
  ERROR
  ARCHIVED
}
```

### 완전한 Order 모델
```prisma
model Order {
  id        String @id @default(cuid())
  productId String
  userId    String

  // JSON 필드
  marketOrder    Json  // MarketOrderInfo
  sourcePurchase Json? // SourcePurchaseInfo
  customer       Json  // CustomerInfo
  shipping       Json  // ShippingInfo
  payment        Json  // PaymentInfo

  // 상태
  status OrderStatus @default(RECEIVED)

  // 타임스탬프
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  completedAt DateTime?

  // 관계
  user       User        @relation(fields: [userId], references: [id])
  product    Product     @relation(fields: [productId], references: [id])
  orderItems OrderItem[]

  @@map("orders")
}

enum OrderStatus {
  RECEIVED
  CONFIRMED
  PURCHASING
  PURCHASED
  SHIPPING
  DELIVERED
  CANCELLED
  REFUNDED
}
```

## 베스트 프랙티스

### 1. 스키마 변경 시 순서
1. `schema.prisma` 파일 수정
2. `npx prisma format` (스키마 포맷팅)
3. `npx prisma migrate dev --name migration_name` (마이그레이션 생성)
4. `npx prisma generate` (Prisma Client 업데이트)
5. TypeScript 코드 업데이트

### 2. JSON 필드 사용 시 주의사항
- **장점**: 유연한 데이터 구조, 스키마 변경 불필요
- **단점**: 쿼리 성능 저하 가능, 타입 안정성 부족
- **권장**: 자주 변경되는 필드, 구조화되지 않은 데이터에만 사용

### 3. 외래키 인덱스
- Prisma는 외래키에 자동으로 인덱스 생성
- 추가 인덱스가 필요한 경우 `@@index([])` 사용

### 4. 마이그레이션 충돌 방지
- **팀 작업 시**: 마이그레이션을 Git에 커밋하여 공유
- **충돌 발생 시**: `npx prisma migrate reset` 후 재생성

## 참고 자료
- **Prisma 문서**: https://www.prisma.io/docs
- **Prisma Schema Reference**: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
- **Prisma Migrate**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **Prisma Client API**: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference
