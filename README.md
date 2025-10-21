# Auto E-Commerce

Next.js 14 기반 글로벌 상품 아웃소싱 플랫폼 MVP입니다. GraphQL API, Prisma ORM, Tailwind UI 컴포넌트, 백그라운드 잡 등을 한 데 모아 오픈마켓 자동화를 빠르게 구축할 수 있도록 설계했습니다.

---

## 개요

- **App Router + GraphQL**: `src/app`에 GraphQL 핸들러와 Next.js 라우트를 함께 배치해 BFF 패턴을 유지합니다.
- **Prisma + PostgreSQL**: 데이터 모델은 `prisma/schema.prisma`에서 정의하며, 마이그레이션은 Prisma CLI로 관리합니다.
- **Tailwind + shadcn/ui**: Tailwind 프리셋과 shadcn/ui 컴포넌트로 일관된 UI 시스템을 구현합니다.
- **Testing Toolkit**: Jest + Testing Library, Playwright를 활용해 단위·통합·E2E 테스트를 수행합니다.

---

## 시작하기

### 사전 준비
- Node.js 20.x, npm 10.x 이상
- PostgreSQL 15 이상 (로컬 설치 혹은 Docker)
- Redis 7 (선택 사항, 큐/캐시 기능 사용 시 필요)

### 빠른 실행
```bash
# 1. 레포지토리 클론
git clone https://github.com/drinkwhale/auto-ecommerce.git
cd auto-ecommerce

# 2. 의존성 설치
npm install

# 3. 환경 변수 초기화
cp .env.example .env
# 로컬 환경에 맞춰 값을 수정하세요

# 4. 인프라 기동 (선택)
docker-compose up -d postgres redis

# 5. Prisma 마이그레이션 & 클라이언트 생성
npx prisma migrate dev
npx prisma generate

# 6. 개발 서버 실행
npm run dev
```

> 프로덕션 번들은 `npm run build`, 실 서비스는 `npm run start`로 실행합니다. 변경 사항 검증은 `npm run lint`, 테스트는 `npm run test` / `npm run test:watch` / `npm run test:coverage`를 사용하세요.

---

## 환경 변수

대표적인 환경 변수 목록입니다. 전체 항목과 보안 지침은 [`docs/configuration.md`](docs/configuration.md)를 참고하세요.

| 변수 | 설명 | 필수 | 예시 |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 | ✅ | `postgresql://postgres:password@localhost:5432/auto_ecommerce?schema=public` |
| `NEXTAUTH_URL` | NextAuth 콜백/리다이렉트 URL | ✅ | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth 세션 암호화 키 | ✅ | `min-32-character-secret` |
| `NEXT_PUBLIC_APP_URL` | 브라우저에서 사용하는 앱 기본 URL | ✅ | `http://localhost:3000` |
| `LOG_LEVEL` | 로거 출력 레벨 (`info` 기본값) | ⛔️ | `debug` |
| `REDIS_URL` | BullMQ/캐시용 Redis URL | ⛔️ | `redis://localhost:6379` |
| `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` | S3 업로드 자격 증명 | ⛔️ | `AKIA...` |
| `COUPANG_ACCESS_KEY`/`COUPANG_SECRET_KEY` | 쿠팡 API 자격 증명 | ⛔️ | `test_key` |

---

## 프로젝트 구조

```text
src/
  app/                  # Next.js App Router 페이지 & API 라우트
  components/           # 재사용 가능한 UI 컴포넌트
  lib/                  # 공통 유틸리티 (Prisma, 로깅, 요청 컨텍스트 등)
  services/             # 도메인 서비스 & 외부 연동 로직
  types/                # 공유 타입 정의
prisma/                 # Prisma 스키마 및 마이그레이션
specs/                  # 제품 명세 및 단계별 태스크 가이드
tests/                  # Jest/Playwright 테스트 스위트
```

Tailwind 설정은 `tailwind.config.js`, 전역 스타일은 `src/app/globals.css`에서 관리합니다.

---

## Prisma 워크플로우

1. 스키마 변경 후 `npx prisma migrate dev --name <change>`로 마이그레이션을 생성합니다.
2. 모델이 바뀌면 `npx prisma generate`로 클라이언트를 재생성합니다.
3. 로컬 데이터를 확인하려면 `npx prisma studio`를 실행해 웹 UI를 띄울 수 있습니다.

---

## 테스트 & 품질

- `npm run lint` — ESLint + Next.js 권장 규칙 실행
- `npm run test` — Jest 단위/통합 테스트
- `npm run test:coverage` — 커버리지 리포트 생성
- `npm run test:watch` — 빠른 피드백을 위한 watch 모드
- `docker-compose up --build` — 앱 + 인프라 통합 실행 (통합/시연 환경)

테스트 더블과 샘플 데이터는 `data/`, `tests/` 폴더에서 관리합니다. 핵심 경로의 커버리지는 80% 이상을 유지하고, 의도적으로 제외한 영역은 문서화하세요.

---

## 기여 가이드

1. 브랜치 전략: `main` (안정) / `develop` (통합) / `feature/*` (기능 단위)
2. 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `chore:` 등)
3. PR 작성 시 기능 요약, 테스트 결과, 스크린샷(또는 GraphQL 샘플)을 함께 남겨주세요.

---

## 라이선스 & 문의

MIT 라이선스를 따릅니다. 이슈/PR 또는 `jackslash@naver.com`을 통해 문의해주세요.
