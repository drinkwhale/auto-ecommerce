# Configuration Guide

이 문서는 Auto E-Commerce 프로젝트에서 사용하는 환경 변수와 비밀키 운영 방식을 정리한 가이드입니다. `.env.example`을 복사해 `.env` 파일을 생성한 뒤, 아래 지침에 따라 값을 채워 넣으세요.

---

## Quick Reference

| 카테고리 | 변수 | 설명 | 필수 | 기본값/예시 |
| --- | --- | --- | --- | --- |
| Core | `NODE_ENV` | 런타임 모드 (`development`/`production`) | ✅ | `development` |
| Core | `NEXT_PUBLIC_APP_URL` | 브라우저에서 사용하는 앱 URL | ✅ | `http://localhost:3000` |
| Core | `NEXTAUTH_URL` | NextAuth 콜백 및 쿠키 도메인 | ✅ | `http://localhost:3000` |
| Core | `NEXTAUTH_SECRET` | NextAuth 세션 암호화 키 (32자 이상) | ✅ | `change-me-min-32-characters` |
| Database | `DATABASE_URL` | PostgreSQL 접속 문자열 | ✅ | `postgresql://postgres:password@localhost:5432/auto_ecommerce?schema=public` |
| Logging | `LOG_LEVEL` | 로깅 레벨 (`error`/`warn`/`info`/`debug`/`trace`) | ⛔️ | `info` |
| Logging | `LOG_PRETTY` | 개발 모드에서 콘솔 출력 포맷 제어 (`true`/`false`) | ⛔️ | `false` |
| Queue | `REDIS_URL` | BullMQ·캐시용 Redis URL | ⛔️ | `redis://localhost:6379` |
| Storage | `AWS_REGION` | AWS 리전 | ⛔️ | `ap-northeast-2` |
| Storage | `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` | S3 업로드 자격 증명 | ⛔️ | `AKIA...` |
| Storage | `AWS_S3_BUCKET` | S3 버킷 이름 | ⛔️ | `auto-ecommerce-assets` |
| Storage | `CLOUDINARY_CLOUD_NAME` | Cloudinary 업로드용 계정 | ⛔️ |  |
| Translation | `GOOGLE_TRANSLATE_API_KEY` | Google Translate API 키 | ⛔️ |  |
| Translation | `DEEPL_API_KEY` | DeepL API 키 | ⛔️ |  |
| Translation | `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET` | Papago 번역 자격 증명 | ⛔️ |  |
| Translation | `OPENAI_API_KEY` | OpenAI 번역/요약 키 | ⛔️ |  |
| Payment | `TOSS_SECRET_KEY`/`TOSS_WEBHOOK_SECRET` | 토스페이먼츠 연동 | ⛔️ |  |
| Payment | `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` | Stripe 연동 | ⛔️ |  |
| Marketplace | `ELEVENST_API_KEY`/`ELEVENST_API_SECRET` | 11번가 API 자격 증명 | ⛔️ |  |
| Marketplace | `ELEVENST_BASE_URL` | 11번가 API 엔드포인트 | ⛔️ | `https://openapi.11st.co.kr` |
| Marketplace | `COUPANG_ACCESS_KEY`/`COUPANG_SECRET_KEY`/`COUPANG_VENDOR_ID` | 쿠팡 오픈 API 자격 증명 | ⛔️ |  |
| Marketplace | `COUPANG_BASE_URL` | 쿠팡 오픈 API 엔드포인트 | ⛔️ | `https://api-gateway.coupang.com` |
| Defaults | `DEFAULT_MARGIN_RATE` | 상품 기본 마진율 (0~1) | ⛔️ | `0.2` |
| Misc | `CUSTOM_KEY` | Next.js 런타임에서 참조하는 커스텀 키 | ⛔️ |  |

> ⛔️ 표시된 항목은 기능 활성화 시 필요하지만, 기본 실행에는 없어도 됩니다.

---

## Secret Management Principles

- `.env` 파일은 **절대 커밋하지 마세요**. Git은 `.env`를 무시하도록 설정되어 있습니다.
- 팀 협업 시에는 1Password/Bitwarden, Doppler, Vault 등 중앙화된 비밀 저장소를 사용하여 값을 공유하십시오.
- 로컬 개발에서 여러 환경을 전환하려면 `direnv`, `dotenv-vault`, `doppler run --`과 같은 툴을 활용합니다.
- 공개 리포지토리라면 GitHub Codespaces/Actions 시크릿을 통해 주입하고, 파이프라인에서는 `dotenv` 대신 런타임 환경 변수를 직접 설정하세요.
- **회전 정책**: 외부 API 키는 분기/릴리스마다 재발급하거나 사용량 초과, 노출 사고 시 즉시 폐기합니다.
- **로그 주의**: 민감한 값은 로깅하지 말고, `LOG_LEVEL=debug` 이상일 때도 토큰/키가 기록되지 않도록 서비스를 구현하세요.

---

## Local Workflow

1. `.env.example`을 복사하여 `.env`를 만든 뒤 필수 항목을 갱신합니다.
2. 로컬에서 PostgreSQL/Redis를 직접 띄우지 않는다면 `docker-compose up -d postgres redis`로 실습 환경을 마련합니다.
3. 데이터베이스 URL을 바꾼 후에는 `npx prisma migrate dev` 및 `npx prisma generate`를 다시 실행해야 합니다.
4. 테스트나 스크립트에서 다른 설정이 필요할 경우, `.env.test`와 같이 별도 파일을 두고 Jest/Playwright 실행 시 `env-cmd` 또는 `cross-env`로 주입하세요.

---

## Environment-specific Overrides

- **개발**: `.env` + 로컬 데이터베이스. 필요 시 `LOG_PRETTY=true`로 가독성을 높입니다.
- **테스트**: CI에서는 GitHub Actions 시크릿을 환경 변수로 주입합니다. ID/비밀번호 대신 토큰 기반 계정을 권장합니다.
- **스테이징/프로덕션**: 인프라 제공자의 시크릿 매니저(AWS SSM, GCP Secret Manager 등)를 사용하고, `.env` 파일 대신 런타임 환경 변수를 주입합니다.

환경 변수 변경 시에는 관련 문서를 업데이트하고, 리뷰 시 검증을 위해 `.env.example`과 이 문서의 값이 일치하는지 확인해주세요.
