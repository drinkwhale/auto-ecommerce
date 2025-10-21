
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

- **핵심 원칙 준수 상황**:
  - ✅ **모듈화 설계**: 크롤링, 번역, 오픈마켓 연동을 독립 서비스로 나누어 의존성 최소화
  - ✅ **API 우선 접근법**: GraphQL을 1차 인터페이스로 사용하고, 파트너 연동에 필요한 REST Webhook만 제한적으로 추가
  - ✅ **테스트 우선 개발**: 계약/통합 테스트를 구현 순서보다 앞에 배치
  - ✅ **관측 가능성**: 구조화된 로깅, 메트릭, 경보를 기술 문맥에 포함
  - ⚠️ **복잡성 관리**: 다중 외부 API 연동, 배치/실시간 동기화가 복잡성을 높임 (정당화 필요)

**복잡성 정당화**:
- 최소 기능 범위(MVP)에서도 타오바오 → 11번가 양방향 동기화를 지원해야 함
- 환율 변동, 재고 변화를 따라잡기 위한 주기적 배치/실시간 처리 파이프라인 필요
- 외부 API의 쿼터·차단 위험을 완화할 재시도, 폴백 전략 설계가 필수

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

**Structure Decision**: Option 1 (단일 Next.js 프로젝트) - 현재 저장소 구조(`src/` + `tests/`)와 동일하게 유지하며 API·UI를 App Router에 통합

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

**Task Generation Strategy (실행 우선순위)**:

1. **기초 확립**
   - Next.js + Prisma + Jest 구성을 현행 저장소 기준으로 검증하고 부족한 설정 보완
   - 환경 변수/시크릿 관리 정책 문서화 (`.env.example`, README 반영)
   - 로깅/모니터링에 필요한 최소 헬퍼 정의

2. **핵심 흐름 MVP (Taobao → 11번가)**
   - Taobao 상품 URL을 받아 GraphQL Mutation으로 상품 초안을 생성
   - 가격 산식(환율, 마진) 계산 모듈과 단위 테스트 작성
   - 쿠팡 연동은 mock 어댑터로 시작해 계약/재시도 전략 정의

3. **백그라운드 동기화 & 관측성**
   - 재고/가격 모니터링 작업을 BullMQ(또는 Cron)로 스케줄링하고, 실패 핸들링 로깅 포함
   - 번역 캐싱/비용 관리 정책 수립 및 테스트
   - 핵심 워크플로우에 대한 통합 테스트와 커버리지 목표(>70%) 추적

4. **UI 검증 레이어**
   - 대시보드/상품 관리 화면에서 MVP 흐름을 조작할 최소 UI 컴포넌트
   - React Query 캐싱/에러 상태 처리, 사용자 피드백 제공
   - Playwright 시나리오로 Taobao → 11번가 흐름 검증

5. **확장 준비**
   - 추가 마켓/번역/결제 연동은 MVP 후 Backlog로 남기고, 의존성 정리
   - 성능/부하 테스트는 실제 트래픽 패턴 정의 후 단계적으로 도입

**Ordering Strategy (단계 요약)**:

- Phase A: 인프라 보강 · 환경 설정 (병렬 일부 가능)
- Phase B: MVP GraphQL + 서비스 로직 (순차)
- Phase C: 백그라운드 작업 & 관측성 (Phase B 종속)
- Phase D: UI 및 사용자 여정 마감 (Phase B와 병렬, Phase C 산출 활용)
- Phase E: 확장 Backlog 및 품질 지표 설정

**특별 고려사항**:
- 외부 API 호출은 mock/stub을 우선 사용하고, 실제 키 연동은 별도 보안 검토 후 진행
- 번역·환율 캐시 만료 정책과 비용 상한선을 문서화하여 운영 리스크 관리
- 실패하는 테스트를 반드시 먼저 작성하고, 통합 테스트는 GraphQL 경로를 기준으로 유지

**예상 작업량**:
- MVP 완료까지 약 15~20개의 핵심 작업
- [P] 표시는 병렬 수행 가능하지만 동일 리소스 경합 방지
- 1인 2~3주 분량을 목표로 스코프 축소

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
