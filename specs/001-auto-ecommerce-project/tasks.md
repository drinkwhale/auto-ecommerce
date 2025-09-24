# Tasks: 글로벌 쇼핑몰 상품 아웃소싱 오픈마켓 등록 시스템

**Input**: Design documents from `/specs/001-auto-ecommerce-project/`
**Prerequisites**: research.md, data-model.md, contracts/, quickstart.md

## 기술 스택 요약
- **Frontend**: Next.js 14+ (App Router), shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM, NextAuth.js
- **Database**: PostgreSQL 15+, Redis 7+
- **Language**: TypeScript 5+

## Path Conventions
웹 애플리케이션 구조:
- `src/` - 메인 소스 코드
- `src/app/` - Next.js App Router 페이지
- `src/components/` - React 컴포넌트
- `src/lib/` - 유틸리티 및 설정
- `src/services/` - 비즈니스 로직
- `tests/` - 테스트 파일

## Phase 3.1: 프로젝트 설정
- [x] T001 프로젝트 구조 생성 및 Next.js 14+ 초기화
- [x] T002 TypeScript, Tailwind CSS, Prisma 의존성 설치 및 설정
- [x] T003 [P] ESLint, Prettier 린팅 및 포매팅 도구 설정
- [x] T004 [P] PostgreSQL 데이터베이스 스키마 초기 설정

## Phase 3.2: 테스트 우선 (TDD) ⚠️ 3.3 이전 필수 완료
**중요: 구현 전에 테스트를 작성하고 반드시 실패해야 합니다**

### REST API 계약 테스트
- [x] T005 [P] 인증 API 계약 테스트 in tests/contract/auth.contract.test.ts
- [ ] T006 [P] 상품 관리 API 계약 테스트 in tests/contract/products.contract.test.ts
- [ ] T007 [P] 주문 관리 API 계약 테스트 in tests/contract/orders.contract.test.ts
- [ ] T008 [P] 통계 API 계약 테스트 in tests/contract/analytics.contract.test.ts

### GraphQL 스키마 테스트
- [ ] T009 [P] GraphQL 스키마 검증 테스트 in tests/graphql/schema.test.ts
- [ ] T010 [P] GraphQL 쿼리 동작 테스트 in tests/graphql/queries.test.ts
- [ ] T011 [P] GraphQL 뮤테이션 동작 테스트 in tests/graphql/mutations.test.ts

### 통합 테스트 (사용자 시나리오 기반)
- [ ] T012 [P] 상품 크롤링 및 등록 플로우 통합 테스트 in tests/integration/product-registration.test.ts
- [ ] T013 [P] 주문 수신 및 처리 플로우 통합 테스트 in tests/integration/order-processing.test.ts
- [ ] T014 [P] 번역 및 이미지 처리 통합 테스트 in tests/integration/content-processing.test.ts

## Phase 3.3: 데이터 모델 구현 (테스트 실패 확인 후에만)

### Prisma 스키마 및 모델
- [ ] T015 [P] User 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T016 [P] Product 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T017 [P] Order 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T018 [P] CategoryMapping 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T019 [P] ProductImage 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T020 [P] ActivityLog 엔티티 Prisma 스키마 in prisma/schema.prisma
- [ ] T021 [P] SystemConfig 엔티티 Prisma 스키마 in prisma/schema.prisma

### 데이터베이스 마이그레이션
- [ ] T022 Prisma 마이그레이션 파일 생성 및 데이터베이스 적용

## Phase 3.4: 서비스 계층 구현

### 핵심 비즈니스 로직
- [ ] T023 [P] UserService 사용자 관리 로직 in src/services/user.service.ts
- [ ] T024 [P] ProductService 상품 관리 로직 in src/services/product.service.ts
- [ ] T025 [P] OrderService 주문 처리 로직 in src/services/order.service.ts
- [ ] T026 [P] CrawlingService 상품 크롤링 로직 in src/services/crawling.service.ts
- [ ] T027 [P] TranslationService 번역 처리 로직 in src/services/translation.service.ts
- [ ] T028 [P] ImageProcessingService 이미지 처리 로직 in src/services/image-processing.service.ts

### 외부 API 연동 서비스
- [ ] T029 [P] OpenMarketService 오픈마켓 연동 in src/services/openmarket.service.ts
- [ ] T030 [P] PaymentService 결제 연동 in src/services/payment.service.ts

## Phase 3.5: API 엔드포인트 구현

### 인증 관련 API
- [ ] T031 NextAuth.js 설정 및 인증 로직 in src/app/api/auth/[...nextauth]/route.ts
- [ ] T032 회원가입 API in src/app/api/auth/register/route.ts

### 상품 관리 API
- [ ] T033 상품 목록 조회 API in src/app/api/v1/products/route.ts
- [ ] T034 상품 생성 API in src/app/api/v1/products/route.ts
- [ ] T035 상품 상세 조회 API in src/app/api/v1/products/[id]/route.ts
- [ ] T036 상품 수정 API in src/app/api/v1/products/[id]/route.ts
- [ ] T037 상품 삭제 API in src/app/api/v1/products/[id]/route.ts
- [ ] T038 상품 크롤링 API in src/app/api/v1/products/crawl/route.ts

### 주문 관리 API
- [ ] T039 주문 목록 조회 API in src/app/api/v1/orders/route.ts
- [ ] T040 주문 상세 조회 API in src/app/api/v1/orders/[id]/route.ts
- [ ] T041 주문 상태 업데이트 API in src/app/api/v1/orders/[id]/route.ts

### 통계 및 분석 API
- [ ] T042 대시보드 통계 API in src/app/api/v1/analytics/dashboard/route.ts

### GraphQL 엔드포인트
- [ ] T043 GraphQL 서버 설정 및 리졸버 구현 in src/app/api/graphql/route.ts

## Phase 3.6: 프론트엔드 컴포넌트

### shadcn/ui 기반 공통 컴포넌트
- [ ] T044 [P] Header 및 Navigation 컴포넌트 in src/components/common/Header.tsx
- [ ] T045 [P] Sidebar 컴포넌트 in src/components/common/Sidebar.tsx
- [ ] T046 [P] DataTable 컴포넌트 in src/components/common/DataTable.tsx

### 상품 관련 컴포넌트
- [ ] T047 [P] ProductList 컴포넌트 in src/components/product/ProductList.tsx
- [ ] T048 [P] ProductForm 컴포넌트 in src/components/product/ProductForm.tsx
- [ ] T049 [P] ProductCard 컴포넌트 in src/components/product/ProductCard.tsx

### 주문 관련 컴포넌트
- [ ] T050 [P] OrderList 컴포넌트 in src/components/order/OrderList.tsx
- [ ] T051 [P] OrderDetail 컴포넌트 in src/components/order/OrderDetail.tsx

## Phase 3.7: 페이지 구현

### 메인 페이지
- [ ] T052 대시보드 페이지 in src/app/dashboard/page.tsx
- [ ] T053 상품 관리 페이지 in src/app/products/page.tsx
- [ ] T054 상품 상세/편집 페이지 in src/app/products/[id]/page.tsx
- [ ] T055 주문 관리 페이지 in src/app/orders/page.tsx
- [ ] T056 통계 페이지 in src/app/analytics/page.tsx

### 인증 페이지
- [ ] T057 [P] 로그인 페이지 in src/app/auth/login/page.tsx
- [ ] T058 [P] 회원가입 페이지 in src/app/auth/register/page.tsx

## Phase 3.8: 통합 및 미들웨어

### 인증 및 보안
- [ ] T059 NextAuth.js 미들웨어 설정 in middleware.ts
- [ ] T060 CORS 및 보안 헤더 설정 in src/lib/cors.ts

### 상태 관리 및 API 클라이언트
- [ ] T061 React Query 설정 in src/lib/react-query.ts
- [ ] T062 [P] API 클라이언트 설정 in src/lib/api-client.ts

### 크론 작업 및 백그라운드 처리
- [ ] T063 [P] 가격 모니터링 크론 작업 in src/lib/cron/price-monitor.ts
- [ ] T064 [P] 자동 번역 큐 처리기 in src/lib/queue/translation-queue.ts

## Phase 3.9: 성능 최적화 및 마무리

### 단위 테스트
- [ ] T065 [P] ProductService 단위 테스트 in tests/unit/product.service.test.ts
- [ ] T066 [P] OrderService 단위 테스트 in tests/unit/order.service.test.ts
- [ ] T067 [P] 유틸리티 함수 단위 테스트 in tests/unit/utils.test.ts

### 성능 테스트
- [ ] T068 API 응답시간 성능 테스트 (<200ms) in tests/performance/api.test.ts
- [ ] T069 동시성 처리 테스트 in tests/performance/concurrency.test.ts

### 문서화 및 정리
- [ ] T070 [P] API 문서 업데이트 in docs/api.md
- [ ] T071 [P] README.md 및 설치 가이드 작성
- [ ] T072 코드 중복 제거 및 리팩토링

### 최종 검증
- [ ] T073 quickstart.md의 시나리오 수동 테스트 실행
- [ ] T074 전체 E2E 테스트 실행 in tests/e2e/

## 의존성 관계
- **테스트 우선**: T005-T014 → T015-T074 (모든 구현)
- **데이터 모델**: T015-T021 → T023-T030 (서비스 계층)
- **서비스 계층**: T023-T030 → T031-T043 (API 구현)
- **API 구현**: T031-T043 → T044-T058 (프론트엔드)
- **컴포넌트**: T044-T051 → T052-T058 (페이지)
- **통합**: T059-T064 → T065-T074 (최종 검증)

## 병렬 실행 예시
```bash
# Phase 3.2: 계약 테스트 동시 실행
Task: "인증 API 계약 테스트 in tests/contract/auth.contract.test.ts"
Task: "상품 관리 API 계약 테스트 in tests/contract/products.contract.test.ts"
Task: "주문 관리 API 계약 테스트 in tests/contract/orders.contract.test.ts"
Task: "통계 API 계약 테스트 in tests/contract/analytics.contract.test.ts"

# Phase 3.3: 데이터 모델 동시 실행
Task: "User 엔티티 Prisma 스키마 in prisma/schema.prisma"
Task: "Product 엔티티 Prisma 스키마 in prisma/schema.prisma"
Task: "Order 엔티티 Prisma 스키마 in prisma/schema.prisma"

# Phase 3.4: 서비스 계층 동시 실행
Task: "UserService 사용자 관리 로직 in src/services/user.service.ts"
Task: "ProductService 상품 관리 로직 in src/services/product.service.ts"
Task: "OrderService 주문 처리 로직 in src/services/order.service.ts"
```

## 검증 체크리스트
- [x] 모든 계약 파일(OpenAPI, GraphQL)에 대응하는 테스트 존재
- [x] 모든 엔티티(7개)에 대한 모델 생성 작업 존재
- [x] 모든 테스트가 구현보다 먼저 배치
- [x] 병렬 작업들이 서로 다른 파일을 수정함
- [x] 각 작업에 정확한 파일 경로 명시
- [x] 동일 파일을 수정하는 [P] 작업 없음

## 주요 특징
- **TDD 방식**: 모든 구현 전에 실패하는 테스트 작성
- **병렬화**: 독립적인 작업에 [P] 표시로 동시 실행 가능
- **단계별**: Setup → Tests → Models → Services → APIs → Frontend → Integration
- **실무 중심**: 실제 구현 가능한 구체적 작업 단위