# Auto E-Commerce

자동화형 전자상거래 플랫폼 백엔드 + 프론트엔드 통합 프로젝트
(GraphQL 기반 API + 프론트엔드 + DB 관리 기능 포함)

---

## 🏷️ 목차

- [Auto E-Commerce](#auto-e-commerce)
  - [🏷️ 목차](#️-목차)
  - [소개](#소개)
  - [주요 기능 (Features)](#주요-기능-features)
  - [기술 스택](#기술-스택)
  - [설치 및 실행](#설치-및-실행)
    - [Docker 실행](#docker-실행)
  - [환경 설정](#환경-설정)
  - [프로젝트 구조](#프로젝트-구조)
  - [테스트](#테스트)
  - [기여 가이드 (Contributing)](#기여-가이드-contributing)
  - [로드맵 \& 향후 계획](#로드맵--향후-계획)
  - [라이선스](#라이선스)
  - [문의](#문의)

---

## 소개

`Auto E-Commerce`는 GraphQL 기반의 API와 프론트엔드, 데이터베이스 스키마 유효성 검사 등을 포함한 통합 전자상거래 플랫폼 프로젝트입니다.
현재 기능 개발 초기 단계이며, 테스트 중심 개발 및 스키마 검증 기능을 강화하는 방향으로 발전하고 있습니다.

이 프로젝트는 개인 프로젝트로 시작했지만, 팀 프로젝트로 발전 가능성이 있습니다.

---

## 주요 기능 (Features)

- GraphQL 스키마 정의 및 유효성 검사
- API 서버 (GraphQL + Resolver)
- 프론트엔드 (Next.js 또는 React)
- DB 모델링 및 마이그레이션
- 테스트 자동화 (Unit / Integration)
- Docker / docker-compose 기반 로컬 실행 환경
- 초기 데이터 삽입 (init.sql 등)

---

## 기술 스택

- **언어 / 런타임**: TypeScript / Node.js
- **서버 프레임워크**: GraphQL (Apollo 등)
- **프론트엔드**: Next.js / React
- **DB / ORM / 마이그레이션**: (예: Prisma, PostgreSQL 등)
- **테스트 프레임워크**: Jest
- **버전 관리 / 배포**: Git, Docker, docker-compose
- **코드 스타일 / 린팅**: ESLint, Prettier

---

## 설치 및 실행

```bash
# 1. 레포 클론
git clone https://github.com/drinkwhale/auto-ecommerce.git
cd auto-ecommerce
git checkout feature/T009-graphql-schema-validation-test

# 2. 의존성 설치
npm install
# 또는 yarn install

# 3. 환경 설정
cp .env.example .env
# 필요한 값 수정

# 4. DB 마이그레이션
npm run migrate

# 5. 개발 서버 실행
npm run dev
```

### Docker 실행

```bash
docker-compose up --build
```

---

## 환경 설정

`.env.example` 파일을 참고하여 `.env`를 생성하세요:

| 변수명 | 설명 | 예시 값 |
|---|---|---|
| `DATABASE_URL` | DB 접속 문자열 | `postgresql://user:pass@localhost:5432/db` |
| `GRAPHQL_PORT` | GraphQL 서버 포트 | `4000` |
| `NODE_ENV` | 실행 모드 | `development` / `production` |

---

## 프로젝트 구조

```plaintext
├── prisma/                     # ORM / 마이그레이션 파일
├── src/
│   ├── graphql/                # 스키마, 리졸버
│   ├── modules/                # 도메인별 모듈
│   ├── utils/                  # 공통 유틸
│   └── index.ts                # 서버 진입점
├── tests/                      # 테스트 코드
├── examples/                   # 예제 요청/응답
├── docker-compose.yml
├── init.sql
├── jest.config.js
├── tsconfig.json
└── .env.example
```

---

## 테스트

```bash
npm run test
```

- **단위 / 통합 테스트** 지원
- Jest 기반
- GraphQL 스키마 및 리졸버 검증 포함
- 커버리지 리포트 제공

---

## 기여 가이드 (Contributing)

1. **브랜치 전략**
   - `main` — 안정 버전
   - `develop` — 개발 통합
   - `feature/*` — 기능별 브랜치

2. **커밋 메시지 컨벤션**
   - [Conventional Commits](https://www.conventionalcommits.org/) 사용
   - 예: `feat: Add user authentication`

3. **PR 규칙**
   - 최소 1명 이상의 리뷰 승인 필요
   - 테스트 코드 포함 필수
   - 문서 업데이트 동반 권장

---

## 로드맵 & 향후 계획

- 사용자 인증 / 권한 부여 (JWT, OAuth 등)
- 상품 / 주문 / 결제 모듈 통합
- CI/CD 파이프라인 구축
- 모니터링 & 로깅 시스템
- 다국어 지원

---

## 라이선스

이 프로젝트는 **[CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko)** 라이선스로 배포됩니다.

![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)

> 상업적 이용은 불가능하며, 출처를 표시해야 하고, 동일한 조건으로만 배포할 수 있습니다.

---

## 문의

- Issues를 통해 버그 리포트 및 기능 제안 가능
- 이메일: jackslash@naver.com
