# 빠른 시작 가이드: 글로벌 쇼핑몰 상품 아웃소싱 시스템

## 🚀 시작하기 전에

### 필수 요구사항
- **Node.js**: 20.0.0 이상
- **pnpm**: 최신 버전 (권장 패키지 매니저)
- **PostgreSQL**: 15.0 이상
- **Redis**: 7.0 이상
- **AWS 계정**: S3, CloudFront 사용

### 외부 서비스 API 키 준비
- **Amazon Product Advertising API** (선택사항)
- **Google Translate API** 또는 **Naver Papago API**
- **11번가**, **지마켓** 등 오픈마켓 API 키
- **AWS S3** 액세스 키

## 📦 설치 및 설정

### 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 클론
git clone https://github.com/your-org/auto-ecommerce.git
cd auto-ecommerce

# 의존성 설치
pnpm install
```

### 2. 환경 변수 설정

```bash
# .env.local 파일 생성
cp .env.example .env.local
```

`.env.local` 파일을 다음과 같이 설정하세요:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/auto_ecommerce"
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Translation APIs
GOOGLE_TRANSLATE_API_KEY="your-google-translate-key"
NAVER_PAPAGO_CLIENT_ID="your-papago-client-id"
NAVER_PAPAGO_CLIENT_SECRET="your-papago-client-secret"

# AWS Configuration
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET_NAME="your-s3-bucket"
AWS_CLOUDFRONT_DOMAIN="your-cloudfront-domain"

# Open Market APIs
ELEVENST_API_KEY="your-11st-api-key"
GMARKET_API_KEY="your-gmarket-api-key"

# Amazon Product Advertising API (Optional)
AMAZON_ACCESS_KEY="your-amazon-access-key"
AMAZON_SECRET_KEY="your-amazon-secret-key"
AMAZON_ASSOCIATE_TAG="your-associate-tag"

# System Configuration
CRAWLING_DELAY_MS=3000
MAX_CONCURRENT_CRAWLS=5
DEFAULT_MARGIN_RATE=30
```

### 3. 데이터베이스 설정

```bash
# PostgreSQL 데이터베이스 생성
createdb auto_ecommerce

# Prisma 마이그레이션 실행
pnpm db:migrate

# 시드 데이터 생성 (선택사항)
pnpm db:seed
```

### 4. Redis 서버 시작

```bash
# macOS (Homebrew)
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

## 🏃‍♂️ 애플리케이션 실행

### 개발 모드 실행

```bash
# 개발 서버 시작
pnpm dev
```

브라우저에서 `http://localhost:3000`으로 접속하세요.

### 백그라운드 워커 실행 (별도 터미널)

```bash
# 크롤링 워커 시작
pnpm worker:crawler

# 이미지 처리 워커 시작
pnpm worker:image-processor

# 번역 워커 시작
pnpm worker:translator
```

## 🎯 첫 번째 상품 등록하기

### 1. 회원가입 및 로그인

1. `http://localhost:3000/auth/register`에서 계정 생성
2. 이메일 인증 완료 (개발 환경에서는 자동 인증)
3. 로그인 후 대시보드 접근

### 2. 해외 상품 크롤링

```typescript
// API 예시: 상품 크롤링
const response = await fetch('/api/v1/products/crawl', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    url: 'https://item.taobao.com/item.htm?id=123456789'
  })
});

const result = await response.json();
console.log('크롤링 결과:', result.data);
```

### 3. 상품 등록

```typescript
// API 예시: 상품 등록
const response = await fetch('/api/v1/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    sourceUrl: 'https://item.taobao.com/item.htm?id=123456789',
    marginRate: 30, // 30% 마진
    targetMarkets: ['ELEVENST', 'GMARKET'],
    autoUpdate: true
  })
});

const result = await response.json();
console.log('상품 등록 완료:', result.data.product);
```

### 4. 웹 UI 사용법

1. **대시보드**: `/dashboard`
   - 전체 통계 및 최근 활동 확인

2. **상품 관리**: `/products`
   - 새 상품 추가 (`+` 버튼 클릭)
   - 상품 URL 입력 후 크롤링 시작
   - 번역 검토 및 마진율 설정
   - 대상 오픈마켓 선택 후 등록

3. **주문 관리**: `/orders`
   - 실시간 주문 알림 확인
   - 주문 상태 업데이트
   - 배송 추적번호 입력

4. **통계**: `/analytics`
   - 매출/수익 분석
   - 플랫폼별 성과 비교
   - 인기 상품 순위

## 🔧 고급 설정

### shadcn/ui 컴포넌트 사용

```bash
# shadcn/ui 초기화 (이미 설정됨)
pnpm dlx shadcn-ui@latest init

# 새 컴포넌트 추가 예시
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add form
pnpm dlx shadcn-ui@latest add table
```

### 커스텀 크롤러 추가

```typescript
// src/services/crawlers/customCrawler.ts
export class CustomCrawler extends BaseCrawler {
  async crawl(url: string): Promise<ProductData> {
    // 커스텀 크롤링 로직 구현
    return {
      title: 'Custom Product Title',
      price: { amount: 29.99, currency: 'USD' },
      images: ['image1.jpg', 'image2.jpg'],
      // ... 기타 데이터
    };
  }
}
```

### 번역 엔진 커스터마이징

```typescript
// src/services/translation/customTranslator.ts
export class CustomTranslator implements TranslationService {
  async translate(text: string, targetLang: string): Promise<string> {
    // 커스텀 번역 로직
    return translatedText;
  }
}
```

## 🧪 테스트 실행

### 단위 테스트

```bash
# 전체 테스트 실행
pnpm test

# 특정 파일 테스트
pnpm test src/services/productService.test.ts

# 커버리지 리포트
pnpm test:coverage
```

### E2E 테스트

```bash
# Playwright E2E 테스트 실행
pnpm test:e2e

# 헤드리스 모드로 실행
pnpm test:e2e --headed
```

### API 테스트

```bash
# API 계약 테스트
pnpm test:api

# 특정 엔드포인트 테스트
pnpm test:api --grep "products"
```

## 🚀 프로덕션 배포

### 1. 빌드

```bash
# 프로덕션 빌드
pnpm build

# 빌드 확인
pnpm start
```

### 2. Docker 배포

```bash
# Docker 이미지 빌드
docker build -t auto-ecommerce .

# Docker 컨테이너 실행
docker run -p 3000:3000 --env-file .env.production auto-ecommerce
```

### 3. Vercel 배포 (프론트엔드)

```bash
# Vercel CLI 설치
pnpm add -g vercel

# 배포
vercel --prod
```

### 4. AWS ECS 배포 (백그라운드 워커)

```bash
# ECS 태스크 정의 업데이트
aws ecs update-service --cluster auto-ecommerce --service worker-cluster
```

## 🔍 문제 해결

### 일반적인 문제들

#### 1. 크롤링이 실패하는 경우

```bash
# 로그 확인
tail -f logs/crawler.log

# Redis 큐 상태 확인
redis-cli
> LLEN crawler:jobs
```

**해결 방법:**
- 크롤링 딜레이 증가 (`CRAWLING_DELAY_MS` 환경변수)
- User-Agent 변경
- 프록시 설정 추가

#### 2. 번역 품질이 낮은 경우

**해결 방법:**
- 다중 번역 엔진 사용
- 전문 용어 사전 추가
- 수동 번역 검토 프로세스 도입

#### 3. 이미지 처리가 느린 경우

**해결 방법:**
- AWS Lambda로 이미지 처리 분리
- 이미지 큐 워커 수 증가
- 이미지 크기 제한 설정

### 로그 확인

```bash
# 애플리케이션 로그
tail -f logs/app.log

# 에러 로그
tail -f logs/error.log

# 크롤링 로그
tail -f logs/crawler.log

# 번역 로그
tail -f logs/translation.log
```

### 성능 모니터링

```bash
# PM2로 프로세스 모니터링
pnpm add -g pm2
pm2 start ecosystem.config.js
pm2 monit
```

## 📚 추가 리소스

### API 문서
- **OpenAPI**: `http://localhost:3000/api-docs`
- **GraphQL Playground**: `http://localhost:3000/graphql`

### 개발 도구
- **Prisma Studio**: `pnpm db:studio`
- **Storybook**: `pnpm storybook`
- **Bundle Analyzer**: `pnpm analyze`

### 유용한 명령어

```bash
# 데이터베이스 리셋
pnpm db:reset

# 프리즈마 스키마 재생성
pnpm db:generate

# 타입 검사
pnpm type-check

# 린팅
pnpm lint

# 포맷팅
pnpm format
```

## 🆘 지원

### 문제 신고
- **GitHub Issues**: [Issues 페이지](https://github.com/your-org/auto-ecommerce/issues)
- **이메일**: support@auto-ecommerce.com

### 문서
- **전체 문서**: `/docs`
- **API 레퍼런스**: `/docs/api`
- **아키텍처 가이드**: `/docs/architecture`

### 커뮤니티
- **Discord**: [커뮤니티 채널](https://discord.gg/auto-ecommerce)
- **블로그**: [기술 블로그](https://blog.auto-ecommerce.com)

---

**🎉 축하합니다!** 이제 글로벌 쇼핑몰 상품 아웃소싱 시스템을 성공적으로 설정하고 실행할 수 있습니다.

첫 번째 상품 등록을 완료한 후, 고급 기능들을 하나씩 탐색해보세요!