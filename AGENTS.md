# 저장소 가이드라인
Auto E-Commerce 프로젝트는 Next.js 프런트엔드와 GraphQL 기반 서비스를 함께 사용합니다. 아래 지침을 따라 기여를 일관되고 예측 가능하게 유지해 주세요.

## 프로젝트 구조 및 모듈 구성
- `src/app`: Next.js 라우트 및 API 핸들러; 서버 로직은 해당 라우트 폴더와 함께 배치합니다.
- `src/components`: 재사용 가능한 UI 컴포넌트; 모듈별 스타일을 함께 둡니다.
- `src/services`, `src/lib`, `src/types`: 도메인 오케스트레이션, 공용 유틸리티, TypeScript 타입 정의를 관리합니다.
- `prisma/`: 스키마와 마이그레이션; 새로운 클라이언트를 생성하기 전에 `schema.prisma`를 먼저 수정합니다.
- `tests/`: Jest 테스트가 모듈 이름과 동일하게 배치됩니다; 스냅샷 자산은 테스트 파일과 나란히 둡니다.
- `docs/`, `examples/`, `specs/`: 워크플로 및 외부 연동을 위한 참고 문서를 보관합니다.

## 빌드·테스트·개발 명령
- `npm run dev`: Next.js 개발 서버를 실행하고 핫 리로드를 사용합니다.
- `npm run build`: 프로덕션 번들을 컴파일합니다. 릴리스를 준비하기 전 반드시 실행합니다.
- `npm run start`: 빌드된 앱을 서비스합니다. 프로덕션 동작과 동일합니다.
- `npm run lint`: Next.js 기본 설정으로 ESLint를 실행합니다.
- `npm run test`, `npm run test:watch`, `npm run test:coverage`: Jest 테스트를 단발성, 워치 모드, 커버리지 모드로 실행합니다.
- `docker-compose up --build`: 앱과 데이터베이스를 포함한 전체 스택을 구성하여 통합 테스트를 준비합니다.

## 코딩 스타일 및 네이밍 규칙
- TypeScript 우선 코드베이스이며 `src` 기준의 모듈은 `@/` 별칭을 우선 사용합니다.
- Prettier 기본값(2칸 들여쓰기, 작은따옴표, 가능한 경우 트레일링 콤마)을 유지하며, 에디터 또는 `npx prettier`로 포매팅합니다.
- PR 전 ESLint 경고를 해결하고, 문서화되지 않은 `any` 타입 사용은 피합니다.
- 변수/함수는 `camelCase`, React 컴포넌트와 클래스는 `PascalCase`, 상수는 `SCREAMING_SNAKE_CASE`를 사용합니다.

## 테스트 지침
- 테스트 파일은 `tests/<feature>.test.ts[x]` 위치에 두고 모듈 명명 규칙을 맞춥니다. 예: `tests/services/order.service.test.ts`.
- UI 동작은 Jest + Testing Library(`jest.setup.js` 참고)를 사용하고, HTTP 호출은 `supertest` 또는 수동 목으로 처리합니다.
- `npm run test:coverage`로 커버리지를 추적하며 핵심 경로는 최소 80% 이상을 유지하고, 예외가 있다면 문서화합니다.
- `data/` 폴더 또는 인라인 팩토리에 결정적 픽스처를 구성하고, 외부 서비스 실시간 호출은 피합니다.

## 커밋 및 PR 지침
- 커밋 메시지와 PR 제목/본문은 기본적으로 한국어로 작성합니다. 필요한 경우 괄호 등을 사용해 영어를 병기할 수 있습니다.
- 커밋은 기존 기록과 동일하게 Conventional Commit 패턴(`fix:`, `refactor:`, `feat:` 등)을 따릅니다. 예: `fix: Taobao 세션 폴백 처리`.
- 커밋 메시지는 간결하게 유지하고, 추가 맥락이 필요하면 본문에 한국어 주석을 덧붙입니다.
- PR에는 요약, 연관된 티켓/이슈 링크, 검증 결과(`npm run test` 출력) 및 필요한 경우 UI 스크린샷이나 GraphQL 샘플을 포함합니다.
- CI가 통과한 뒤 리뷰를 요청하며, 히스토리를 선형으로 유지하기 위해 머지 커밋보다 리베이스를 선호합니다.

## 보안 및 구성 팁
- `.env.example`을 `.env`로 복사(`cp .env.example .env`)하고 비밀 값은 로컬에만 보관합니다. 자격 증명은 커밋하지 않습니다.
- Prisma 모델을 수정한 뒤에는 `npx prisma migrate dev`와 `npx prisma generate`를 실행해 클라이언트를 갱신합니다.
- 로컬 데이터는 `init.sql` 또는 `data/` 내 전용 스크립트로 시드하고, 로그나 픽스처를 공유할 때는 고객 식별 정보를 제거합니다.
