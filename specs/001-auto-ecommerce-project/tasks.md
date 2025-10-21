# Tasks: 글로벌 쇼핑몰 상품 아웃소싱 오픈마켓 등록 시스템 (MVP 중심)

**Input**: Updated design docs in `/specs/001-auto-ecommerce-project/`
**Prerequisites**: research.md, data-model.md, quickstart.md, contracts/

## 기술 스택 요약
- **Runtime**: Next.js 14 (App Router), TypeScript 5, Node.js 20
- **Data**: Prisma ORM (PostgreSQL), Redis 캐시 (옵션), BullMQ/cron
- **UI**: shadcn/ui, Tailwind CSS, React Query
- **Testing**: Jest, Testing Library, Playwright

## Path Conventions
- `src/app/` → GraphQL 핸들러 및 Next.js 라우트
- `src/services/` → 도메인 서비스/어댑터
- `src/lib/` → 유틸리티, 공통 인프라
- `tests/` → `unit/`, `integration/`, `graphql/`, `e2e/`
- `docs/` → 운영/구성 문서

---

## Phase 3.1: 기초 확립 & 운영 준비
- [ ] **T001** 검증: Next.js · Tailwind · Prisma 설정 점검 및 필요한 경우 `README.md` 설치 절차 보완
- [ ] **T002** `.env.example` 강화 및 비밀키 취급 지침 작성 (`docs/configuration.md`)
- [ ] **T003** 구조화 로거/트레이싱 헬퍼 작성 (`src/lib/logger.ts`, `src/lib/request-context.ts`)

## Phase 3.2: Taobao 상품 수집 GraphQL 흐름
- [ ] **T010** GraphQL Mutation 계약/테스트 정의 (`tests/graphql/mutations.test.ts`, `contracts/graphql/product-ingestion.graphql`)
- [ ] **T011** 가격 산식 모듈 구현 및 단위 테스트 (`src/services/pricing.service.ts`, `tests/unit/pricing.service.test.ts`)
- [ ] **T012** Taobao import Mutation 구현 및 Error 핸들링 (`src/app/api/graphql/route.ts`, `src/services/crawling.service.ts`)

## Phase 3.3: 쿠팡 연동 MVP
- [ ] **T020** 쿠팡 어댑터 인터페이스 + mock 구현 (`src/services/marketplace/elevenst.adapter.ts`)
- [ ] **T021** 외부 API 재시도·백오프 유틸 추가 (`src/lib/external-client.ts`, `tests/unit/external-client.test.ts`)
- [ ] **T022** Taobao → 쿠팡 통합 테스트 갱신 (`tests/integration/product-registration.test.ts`)

## Phase 3.4: 백그라운드 동기화 & 관측성
- [ ] **T030** 재고/가격 동기화 잡 스케줄링 (`src/lib/cron/inventory-sync.ts`, `tests/unit/cron/inventory-sync.test.ts`)
- [ ] **T031** 번역 캐시 정책 및 비용 가드 구현 (`src/services/translation.service.ts`, `tests/unit/translation.service.test.ts`)
- [ ] **T032** BullMQ 큐 로깅/메트릭 삽입 (`src/lib/queue/translation-queue.ts`, `docs/runbooks/queues.md`)

## Phase 3.5: UI 사용자 여정
- [ ] **T040** GraphQL Mutation을 `src/app/products/page.tsx`에 연결하고 성공/에러 토스트 제공
- [ ] **T041** `src/components/product/ProductForm.tsx`에 단계별 진행 상태/검증 메시지 추가
- [ ] **T042** Playwright E2E 시나리오로 Taobao → 쿠팡 흐름 검증 (`tests/e2e/product-ingestion.spec.ts`)

## Phase 3.6: 품질 게이트 & 문서화
- [ ] **T050** 운영 런북 작성 (`docs/runbooks/taobao-to-elevenst.md`)
- [ ] **T051** 커버리지 70% 이상 CI 체크 설정 (`package.json`, `.github/workflows/test.yml`)
- [ ] **T052** API 응답/큐 딜레이 스모크 테스트 (`tests/performance/api-smoke.test.ts`)
- [ ] **T053** README · AGENTS · quickstart 갱신으로 MVP 흐름 반영

---

## 의존성 요약
- Phase 3.2 → 완료 후 Phase 3.3, 3.5 진행 가능
- Phase 3.3 산출물(어댑터, 재시도)이 Phase 3.4/3.5 테스트에 필요
- 품질 게이트(Phase 3.6)는 전 단계 결과물에 종속

## 병렬 실행 메모
- [P] 표시 대신, 파일 충돌이 없는 한 Phase 3.1 ↔ 3.2 일부 병렬 가능
- 통합 테스트는 GraphQL Mutation 완료 후 실행

## Backlog (Post-MVP)
- 아마존/알리바바 추가 크롤러
- 자동 주문 처리 & 결제 연동
- 멀티마켓 카테고리 매핑 서비스 확장
- 고급 성능·부하 테스트 (k6, Artillery)
- 고급 번역 품질 개선 (용어집, human-in-the-loop)
