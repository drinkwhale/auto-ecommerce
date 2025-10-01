# Auto E-commerce Project - CLAUDE.md

## 1. 프로젝트 한 줄 요약
- **글로벌 쇼핑몰 상품 아웃소싱 오픈마켓 등록 자동화 시스템**: 타오바오/아마존/알리바바 상품을 크롤링하여 번역/이미지 처리 후 국내 오픈마켓(11번가, 지마켓, 쿠팡 등)에 자동 등록하고 주문을 통합 관리하는 플랫폼

## 2. 현재 최우선 목표 (Current Goal)
- **Phase 3.6 프론트엔드 컴포넌트 개발**: Header, Sidebar, DataTable, Product/Order 컴포넌트 구현 중
- **핵심 기능 통합**: 상품 크롤링 → 번역/이미지 처리 → 오픈마켓 등록 → 주문 처리 전체 플로우 연결
- **TDD 기반 개발**: 모든 기능은 테스트 작성 → 실패 확인 → 구현 → 통과 순서로 진행

## 3. 기술 스택 (Tech Stack)
- **언어:** TypeScript 5+
- **프론트엔드:** Next.js 14+ (App Router), React 18+, shadcn/ui, Tailwind CSS
- **백엔드:** Next.js API Routes (REST + GraphQL)
- **데이터베이스:** PostgreSQL 15+ (Prisma ORM), Redis 7+ (캐싱/세션)
- **인증:** NextAuth.js (JWT 기반)
- **외부 API:** 타오바오/아마존 크롤링, 11번가/지마켓/쿠팡 오픈마켓 API
- **이미지 처리:** Sharp, AWS S3 또는 로컬 스토리지
- **번역:** Google Translate API 또는 Papago API
- **테스트:** Jest, React Testing Library, Supertest
- **패키지 매니저:** npm

## 4. 핵심 디렉토리 구조 (Core Directory Structure)
```
auto-ecommerce/
├── src/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── api/                  # API Routes (백엔드 엔드포인트)
│   │   │   ├── auth/            # 인증 관련 API (NextAuth.js)
│   │   │   ├── v1/              # REST API v1
│   │   │   │   ├── products/    # 상품 관리 API
│   │   │   │   ├── orders/      # 주문 관리 API
│   │   │   │   └── analytics/   # 통계 및 분석 API
│   │   │   ├── graphql/         # GraphQL API
│   │   │   └── health/          # 헬스체크 API
│   │   ├── layout.tsx           # 루트 레이아웃
│   │   └── page.tsx             # 메인 페이지
│   │
│   ├── components/              # React 컴포넌트
│   │   ├── common/             # 공통 컴포넌트 (Header, Sidebar, DataTable)
│   │   ├── product/            # 상품 관련 컴포넌트
│   │   ├── order/              # 주문 관련 컴포넌트
│   │   └── ui/                 # shadcn/ui 기본 컴포넌트
│   │
│   ├── services/               # 비즈니스 로직 서비스 계층
│   │   ├── user.service.ts              # 사용자 관리
│   │   ├── product.service.ts           # 상품 관리
│   │   ├── order.service.ts             # 주문 처리
│   │   ├── crawling.service.ts          # 상품 크롤링
│   │   ├── translation.service.ts       # 번역 처리
│   │   ├── image-processing.service.ts  # 이미지 처리
│   │   ├── openmarket.service.ts        # 오픈마켓 연동
│   │   └── payment.service.ts           # 결제 연동
│   │
│   └── lib/                    # 유틸리티 및 설정
│       ├── prisma.ts          # Prisma 클라이언트
│       ├── auth.ts            # NextAuth 설정
│       ├── utils.ts           # 공통 유틸리티
│       └── graphql/           # GraphQL 스키마 및 리졸버
│
├── prisma/                     # Prisma ORM
│   ├── schema.prisma          # 데이터베이스 스키마
│   └── migrations/            # 마이그레이션 파일
│
├── tests/                      # 테스트 파일 (TDD)
│   ├── contract/              # API 계약 테스트
│   ├── integration/           # 통합 테스트
│   └── graphql/               # GraphQL 테스트
│
└── specs/                      # 설계 문서
    └── 001-auto-ecommerce-project/
        ├── spec.md            # 기능 명세서
        ├── data-model.md      # 데이터 모델
        ├── plan.md            # 구현 계획
        └── tasks.md           # 작업 목록
```

## 5. 주요 로직 및 파일 (Key Logic & Files)

### 핵심 비즈니스 로직 (src/services/)
- **[user.service.ts](src/services/user.service.ts)**: 사용자 관리 및 인증
  - `createUser()`: 사용자 등록
  - `getUserById()`: 사용자 조회
  - `updateUserProfile()`: 프로필 업데이트

- **[product.service.ts](src/services/product.service.ts)**: 상품 CRUD 및 관리
  - `createProduct()`: 상품 생성 (크롤링 데이터 기반)
  - `getProducts()`: 상품 목록 조회 (페이지네이션, 필터링)
  - `updateProductStatus()`: 상품 상태 관리 (DRAFT → PROCESSING → READY → REGISTERED)
  - `calculateSalePrice()`: 마진율 적용 판매가 계산

- **[order.service.ts](src/services/order.service.ts)**: 주문 처리 핵심 로직
  - `createOrder()`: 주문 생성 (오픈마켓 웹훅 수신)
  - `processOrder()`: 주문 처리 (원본 소싱 자동화)
  - `updateOrderStatus()`: 주문 상태 업데이트 (8단계 상태 관리)
  - `calculateProfit()`: 순이익 및 수익률 계산

- **[crawling.service.ts](src/services/crawling.service.ts)**: 상품 크롤링
  - `crawlProduct()`: 타오바오/아마존/알리바바 상품 크롤링
  - `extractProductData()`: 상품 정보 추출 (제목, 가격, 이미지, 스펙)

- **[translation.service.ts](src/services/translation.service.ts)**: 번역 처리
  - `translateProductData()`: 상품 정보 한국어 번역
  - `optimizeForSEO()`: SEO 최적화 제목 생성

- **[image-processing.service.ts](src/services/image-processing.service.ts)**: 이미지 처리
  - `processProductImages()`: 이미지 다운로드 및 최적화
  - `removeWatermark()`: 워터마크 제거
  - `generateThumbnails()`: 썸네일 생성

- **[openmarket.service.ts](src/services/openmarket.service.ts)**: 오픈마켓 연동
  - `registerProduct()`: 오픈마켓 상품 등록
  - `syncOrders()`: 주문 동기화
  - `updateInventory()`: 재고 동기화

### 핵심 API 엔드포인트 (src/app/api/)
- **인증 API**:
  - `POST /api/auth/register`: 회원가입
  - `POST /api/auth/[...nextauth]`: NextAuth.js 로그인/로그아웃

- **상품 관리 API**:
  - `GET /api/v1/products`: 상품 목록 조회
  - `POST /api/v1/products`: 상품 생성
  - `GET /api/v1/products/:id`: 상품 상세 조회
  - `PATCH /api/v1/products/:id`: 상품 수정
  - `DELETE /api/v1/products/:id`: 상품 삭제
  - `POST /api/v1/products/crawl`: 상품 크롤링

- **주문 관리 API**:
  - `GET /api/v1/orders`: 주문 목록 조회
  - `GET /api/v1/orders/:id`: 주문 상세 조회
  - `PATCH /api/v1/orders/:id`: 주문 상태 업데이트

- **통계 API**:
  - `GET /api/v1/analytics/dashboard`: 대시보드 통계

- **GraphQL API**:
  - `POST /api/graphql`: GraphQL 쿼리 및 뮤테이션

### 중요 설정 파일
- **[prisma/schema.prisma](prisma/schema.prisma)**: 데이터베이스 스키마 정의
- **[src/lib/auth.ts](src/lib/auth.ts)**: NextAuth.js 인증 설정
- **[src/lib/prisma.ts](src/lib/prisma.ts)**: Prisma 클라이언트 싱글톤

## 6. 로컬 실행 및 테스트 방법 (How to Run & Test)

### 개발 환경 설정
```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env 파일 생성)
DATABASE_URL="postgresql://user:password@localhost:5432/auto_ecommerce"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# 3. 데이터베이스 마이그레이션
npx prisma migrate dev

# 4. Prisma 클라이언트 생성
npx prisma generate

# 5. 개발 서버 실행
npm run dev
# 서버 실행: http://localhost:3000
```

### 테스트 실행 (TDD)
```bash
# 전체 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test tests/integration/product-registration.test.ts

# 테스트 커버리지 확인
npm run test:coverage

# 테스트 Watch 모드
npm run test:watch
```

### 데이터베이스 관리
```bash
# Prisma Studio 실행 (DB GUI)
npx prisma studio

# 마이그레이션 생성
npx prisma migrate dev --name migration_name

# 데이터베이스 초기화 (주의: 모든 데이터 삭제)
npx prisma migrate reset
```

### 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# TypeScript 타입 체크
npm run lint
```

## 7. 중요 규칙 및 제약사항 (Rules & Constraints)

### 개발 규칙
- **TDD 엄수**: 모든 기능은 테스트 작성 → 실패 확인 → 구현 → 통과 순서로 개발
- **타입 안정성**: 모든 함수와 변수는 명시적 TypeScript 타입 지정
- **에러 처리**: 모든 비동기 함수는 try-catch 블록으로 에러 처리 필수
- **데이터 검증**: 모든 사용자 입력은 Zod 스키마로 유효성 검사
- **API 응답 형식**: 일관된 JSON 응답 구조 사용
  ```typescript
  { success: true, data: {...} }
  { success: false, error: { message: "...", code: "..." } }
  ```

### 데이터베이스 규칙
- **트랜잭션**: 주문 생성 시 재고 차감 등 연관된 작업은 반드시 트랜잭션으로 처리
- **JSON 필드 활용**: 유연한 데이터 구조는 JSON 타입 사용 (예: ProductSourceInfo, CustomerInfo)
- **소프트 삭제**: 중요 데이터는 삭제 대신 status 변경 (ARCHIVED)
- **인덱스**: 검색 성능을 위해 자주 조회되는 필드에 인덱스 설정
- **제약 조건**: 외래키 제약조건을 통한 데이터 무결성 보장

### 코딩 컨벤션
- **파일명**: kebab-case.ts 사용 (예: product.service.ts)
- **컴포넌트**: PascalCase.tsx 사용 (예: ProductCard.tsx)
- **함수명**: camelCase + 동사로 시작 (예: createProduct, getUserById)
- **상수**: UPPER_SNAKE_CASE 사용 (예: MAX_UPLOAD_SIZE)
- **타입/인터페이스**: PascalCase 사용 (예: ProductSourceInfo)

### 보안 규칙
- **인증**: 모든 보호된 API는 NextAuth.js 세션 검증 필수
- **비밀번호**: bcryptjs로 해싱 (최소 10 rounds)
- **환경 변수**: 민감한 정보는 .env에 저장, 절대 코드에 하드코딩 금지
- **입력 검증**: SQL Injection, XSS 방지를 위한 철저한 입력 검증

## 8. 모듈별 가이드 (claude.md 중첩 사용 규칙)

### 중요 지시사항
**특정 서브디렉토리의 파일을 작업할 때는 해당 디렉토리 내 `claude.md` 파일을 먼저 확인하고 그 컨텍스트를 최우선으로 적용할 것.**

### 서브 모듈별 claude.md
- **[src/components/claude.md](src/components/claude.md)**: React 컴포넌트 작성 규칙, shadcn/ui 사용법, Tailwind CSS 스타일링
- **[src/services/claude.md](src/services/claude.md)**: 비즈니스 로직 작성 규칙, Prisma 사용법, 에러 처리 패턴
- **[src/app/api/claude.md](src/app/api/claude.md)**: API 엔드포인트 작성 규칙, 응답 형식, 인증 처리
- **[src/lib/claude.md](src/lib/claude.md)**: 유틸리티 함수 작성 규칙, 설정 파일 관리
- **[prisma/claude.md](prisma/claude.md)**: 데이터베이스 스키마 설계 규칙, 마이그레이션 관리

### 컨텍스트 적용 예시
```markdown
# 예시: src/services/claude.md를 읽고 적용
사용자가 "상품 서비스에 새로운 기능을 추가해줘"라고 요청하면:
1. src/services/claude.md 파일을 먼저 읽음
2. 해당 파일의 규칙(async/await, Prisma 사용, 에러 처리 등)을 확인
3. 규칙에 맞춰 코드 작성
```

## 9. 개발 우선순위 (Development Priority)

### ✅ 완료된 Phase (Phase 3.1 ~ 3.5)
- [x] 프로젝트 설정 및 초기화
- [x] TDD 테스트 작성 (계약 테스트, GraphQL 테스트, 통합 테스트)
- [x] 데이터 모델 구현 (Prisma 스키마 완성)
- [x] 서비스 계층 구현 (8개 핵심 서비스)
- [x] API 엔드포인트 구현 (REST + GraphQL)

### 🔄 진행 중 (Phase 3.6: 프론트엔드 컴포넌트)
- [x] T044: Header 및 Navigation 컴포넌트
- [x] T045: Sidebar 컴포넌트
- [x] T046: DataTable 컴포넌트
- [ ] T047: ProductList 컴포넌트
- [ ] T048: ProductCard 컴포넌트
- [ ] T049: ProductForm 컴포넌트
- [ ] T050: OrderList 컴포넌트
- [ ] T051: OrderDetail 컴포넌트

### 📋 다음 Phase (Phase 3.7 ~ 4.x)
- [ ] 페이지 구현 (대시보드, 상품 관리, 주문 관리)
- [ ] 실시간 기능 (WebSocket, 주문 알림)
- [ ] 배포 및 인프라 (Docker, CI/CD)
- [ ] 성능 최적화 (캐싱, 이미지 최적화)

## 10. Git Workflow (Git 작업 규칙)

### 브랜치 전략
- **main**: 프로덕션 배포 브랜치 (항상 안정적인 상태 유지)
- **develop**: 개발 통합 브랜치 (다음 릴리스 준비)
- **feature/[작업명]**: 기능 개발 브랜치
  - 예: `feature/T047-T051-product-order-components`
  - 예: `feature/product-crawling-service`
- **bugfix/[버그명]**: 버그 수정 브랜치
- **hotfix/[긴급수정명]**: 프로덕션 긴급 수정

### 커밋 메시지 규칙
```
<type>: <subject>

<body>

<footer>
```

**타입 (Type):**
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락 등 (기능 변경 없음)
- `refactor`: 코드 리팩토링 (기능 변경 없음)
- `test`: 테스트 코드 추가/수정
- `chore`: 빌드 프로세스, 라이브러리 업데이트 등

**예시:**
```
feat: T024 ProductService 상품 관리 로직 완성

- 상품 생성, 조회, 수정, 삭제 (CRUD) 기능 구현
- 상품 목록 조회 (페이지네이션, 필터링, 정렬)
- 상품 상태 관리 (DRAFT, PROCESSING, READY, REGISTERED, ERROR, ARCHIVED)
- 가격 계산 로직 (마진율 자동 적용)
- Prisma ORM 통합

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 작업 플로우
```bash
# 1. 최신 코드 가져오기
git checkout develop
git pull origin develop

# 2. 기능 브랜치 생성
git checkout -b feature/T047-product-list-component

# 3. 작업 후 커밋
git add .
git commit -m "feat: T047 ProductList 컴포넌트 구현"

# 4. 원격 저장소에 푸시
git push origin feature/T047-product-list-component

# 5. Pull Request 생성 (GitHub)
# - develop 브랜치로 병합 요청
# - 코드 리뷰 후 승인되면 Squash and Merge

# 6. 병합 후 로컬 브랜치 정리
git checkout develop
git pull origin develop
git branch -d feature/T047-product-list-component
```

### Pull Request 규칙
- **제목**: `[T047] ProductList 컴포넌트 구현`
- **설명**:
  - 작업 내용 요약
  - 변경 사항 상세
  - 테스트 결과
  - 스크린샷 (UI 변경 시)
- **리뷰어**: 최소 1명 이상 승인 필요
- **머지 방식**: Squash and Merge (커밋 히스토리 정리)

### 금지 사항
- ❌ main 브랜치에 직접 커밋 금지
- ❌ develop 브랜치에 직접 커밋 금지 (PR 필수)
- ❌ `git push --force` 사용 금지 (공유 브랜치)
- ❌ 민감한 정보(.env, API 키) 커밋 금지
- ❌ node_modules, .next 등 빌드 파일 커밋 금지 (.gitignore 확인)

## 11. 참고 문서 및 리소스

### 프로젝트 문서
- **[spec.md](specs/001-auto-ecommerce-project/spec.md)**: 기능 명세서 (요구사항, 유스케이스)
- **[data-model.md](specs/001-auto-ecommerce-project/data-model.md)**: 데이터 모델 설계
- **[plan.md](specs/001-auto-ecommerce-project/plan.md)**: 구현 계획 및 아키텍처
- **[tasks.md](specs/001-auto-ecommerce-project/tasks.md)**: 상세 작업 목록 (Phase별)
- **[README.md](README.md)**: 프로젝트 개요 및 시작 가이드

### 기술 문서
- **Prisma**: https://www.prisma.io/docs
- **Next.js 14**: https://nextjs.org/docs
- **NextAuth.js**: https://next-auth.js.org
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com/docs

### 주요 디렉토리별 README (향후 작성 예정)
- `src/services/README.md`: 서비스 계층 설명 및 사용법
- `src/components/README.md`: 컴포넌트 카탈로그
- `tests/README.md`: 테스트 작성 가이드
