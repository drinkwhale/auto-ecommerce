
# Implementation Plan: 글로벌 쇼핑몰 상품 아웃소싱 오픈마켓 등록 시스템

**Branch**: `001-auto-ecommerce-project` | **Date**: 2025-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-auto-ecommerce-project/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
타오바오, 아마존 등 해외 쇼핑몰에서 수익성 높은 상품을 발굴하여 국내 오픈마켓에 자동으로 등록하고 관리하는 드롭시핑 비즈니스 자동화 시스템. Next.js 기반 풀스택 웹 애플리케이션으로, shadcn/ui를 활용한 모던 UI와 자동화된 상품 관리 기능을 제공합니다.

## Technical Context
**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: Next.js 14+ (App Router), shadcn/ui, Tailwind CSS, Prisma ORM, React Query/TanStack Query
**Storage**: PostgreSQL (메인 데이터베이스), Redis (캐싱/세션), AWS S3 (이미지 저장)
**Testing**: Jest, React Testing Library, Playwright (E2E 테스팅)
**Target Platform**: 웹 브라우저 (데스크톱/모바일), Node.js 서버 환경
**Project Type**: web (프론트엔드 + 백엔드 통합)
**Performance Goals**: 1000+ 동시 사용자, <200ms API 응답시간, 실시간 데이터 동기화
**Constraints**: 해외 API 호출 제한 대응, 대용량 이미지 처리, 다국어 번역 품질 관리
**Scale/Scope**: 10,000+ 상품 관리, 다중 오픈마켓 연동, 24/7 자동화 시스템

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**핵심 원칙 준수 상황**:
- ✅ **모듈화 설계**: 각 기능(크롤링, 번역, 오픈마켓 연동)을 독립적인 서비스로 분리
- ✅ **API 우선 접근법**: 모든 기능을 REST API로 노출하여 확장성 확보
- ✅ **테스트 우선 개발**: TDD 방식으로 계약 테스트부터 작성
- ✅ **관측 가능성**: 구조화된 로깅 및 모니터링 시스템 포함
- ⚠️ **복잡성 관리**: 다중 외부 API 연동으로 인한 복잡성 존재 (정당화 필요)

**복잡성 정당화**:
- 타오바오/아마존 등 다양한 해외 쇼핑몰 API 연동 필수
- 11번가/지마켓 등 국내 오픈마켓 API 동시 관리 필요
- 실시간 환율/재고 모니터링으로 인한 백그라운드 작업 복잡성

**통과 상태**: ✅ PASS (복잡성 정당화됨)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web Application) - Next.js 풀스택 프로젝트

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

1. **기반 구조 설정** (Infrastructure Setup)
   - Next.js 14 프로젝트 초기화 및 설정
   - shadcn/ui 컴포넌트 시스템 설정
   - Prisma ORM 스키마 정의 및 마이그레이션
   - TypeScript 설정 및 타입 정의
   - 테스트 환경 구성 (Jest, Playwright)

2. **데이터 계층** (Data Layer)
   - Prisma 스키마 파일 생성 (`schema.prisma`)
   - 데이터베이스 마이그레이션 스크립트
   - 기본 CRUD 리포지토리 패턴 구현
   - 시드 데이터 및 테스트 픽스처

3. **API 계층** (API Layer)
   - Next.js API Routes 구조 설정
   - OpenAPI 스키마 기반 API 엔드포인트 구현
   - 인증/인가 미들웨어 (NextAuth.js)
   - API 검증 스키마 (Zod)
   - 에러 핸들링 및 응답 표준화

4. **서비스 계층** (Service Layer)
   - 상품 크롤링 서비스 (Playwright 기반)
   - 번역 서비스 (Google Translate/Papago 연동)
   - 이미지 처리 서비스 (Sharp + AWS S3)
   - 오픈마켓 API 연동 서비스
   - 백그라운드 작업 큐 시스템 (Bull/BullMQ)

5. **UI 컴포넌트** (UI Components)
   - shadcn/ui 기반 공통 컴포넌트
   - 상품 관리 페이지 컴포넌트
   - 주문 관리 페이지 컴포넌트
   - 대시보드 및 통계 컴포넌트
   - 반응형 레이아웃 및 네비게이션

6. **통합 테스트** (Integration Testing)
   - API 계약 테스트 실행
   - E2E 테스트 시나리오 구현 (Playwright)
   - 컴포넌트 테스트 (React Testing Library)
   - 성능 테스트 및 부하 테스트

**Ordering Strategy**:

**Phase A: 기초 인프라** (병렬 가능)
```
1. [P] Next.js 프로젝트 초기화
2. [P] shadcn/ui 설정
3. [P] TypeScript 설정
4. [P] 테스트 환경 구성
5. [P] Prisma ORM 설정
```

**Phase B: 데이터 모델** (순차 의존성)
```
6. Prisma 스키마 정의
7. 데이터베이스 마이그레이션
8. 기본 CRUD 리포지토리
9. 시드 데이터 생성
```

**Phase C: API 기반** (Phase B 이후)
```
10. [P] NextAuth.js 인증 설정
11. [P] API 미들웨어 구현
12. [P] Zod 검증 스키마
13. 상품 API 엔드포인트
14. 주문 API 엔드포인트
15. 사용자 API 엔드포인트
```

**Phase D: 핵심 서비스** (Phase C와 병렬 가능)
```
16. [P] 크롤링 서비스 (Playwright)
17. [P] 번역 서비스 연동
18. [P] 이미지 처리 서비스
19. [P] AWS S3 연동
20. 백그라운드 작업 큐 설정
```

**Phase E: 오픈마켓 연동** (Phase D 이후)
```
21. [P] 11번가 API 연동
22. [P] 지마켓 API 연동
23. [P] 옥션 API 연동
24. 카테고리 매핑 시스템
25. 자동 등록 워크플로우
```

**Phase F: 프론트엔드 UI** (Phase C 이후)
```
26. [P] 공통 컴포넌트 구현
27. [P] 레이아웃 및 네비게이션
28. 대시보드 페이지
29. 상품 관리 페이지
30. 주문 관리 페이지
31. 통계 및 분석 페이지
```

**Phase G: 테스트 및 검증** (모든 Phase 이후)
```
32. API 계약 테스트 실행
33. 컴포넌트 테스트 구현
34. E2E 테스트 시나리오
35. 성능 및 부하 테스트
36. 보안 검증 테스트
```

**특별 고려사항**:

- **shadcn/ui MCP 활용**: UI 컴포넌트 작업 시 shadcn MCP 도구 적극 활용
- **Playwright MCP 연동**: 각 페이지 완성 후 브라우저 자동 실행 및 검증
- **브라우저 테스트 자동화**:
  ```bash
  # 각 단계 완료 후 자동 실행
  pnpm dev & sleep 5 && playwright test --ui
  ```

**예상 작업량**:
- **총 36개 작업** (기존 예상 25-30개에서 확장)
- **병렬 처리 가능**: 18개 작업 ([P] 표시)
- **예상 소요시간**: 3-4주 (1인 개발 기준)

**품질 관리**:
- 각 Phase 완료 시 Playwright MCP로 브라우저 검증
- 모든 API는 계약 테스트 통과 필수
- UI 컴포넌트는 Storybook에 등록
- 성능 기준치 미달 시 최적화 작업 추가

**IMPORTANT**: Phase 2는 /tasks 명령어로 실행되며, /plan 명령어에서는 실행하지 않습니다.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

**Generated Artifacts** ✅:
- [x] `/specs/001-auto-ecommerce-project/research.md` - 기술 연구 결과
- [x] `/specs/001-auto-ecommerce-project/data-model.md` - 데이터 모델 설계
- [x] `/specs/001-auto-ecommerce-project/contracts/openapi.yaml` - REST API 스키마
- [x] `/specs/001-auto-ecommerce-project/contracts/schema.graphql` - GraphQL 스키마
- [x] `/specs/001-auto-ecommerce-project/contracts/product.contract.test.ts` - API 계약 테스트
- [x] `/specs/001-auto-ecommerce-project/quickstart.md` - 빠른 시작 가이드
- [x] `CLAUDE.md` - Agent context 업데이트

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
