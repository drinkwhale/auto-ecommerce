# Auto E-commerce Project - CLAUDE.md

## 1. 프로젝트 한 줄 요약
- **완전한 자동화 이커머스 플랫폼**: 상품 관리부터 주문 처리, 결제, 배송까지 통합된 온라인 쇼핑몰 시스템

## 2. 현재 최우선 목표 (Current Goal)
- **이커머스 핵심 기능 개발**: 상품 관리, 사용자 인증, 장바구니, 주문 처리 시스템 구현
- **MVP(Minimum Viable Product) 완성**: 기본적인 온라인 쇼핑 기능이 동작하는 프로토타입 개발

## 3. 기술 스택 (Tech Stack)
- **언어:** JavaScript/TypeScript
- **프론트엔드:** React.js, Next.js (SSR/SSG 지원)
- **백엔드:** Node.js, Express.js
- **데이터베이스:** PostgreSQL (주 데이터베이스), Redis (캐싱/세션)
- **상태 관리:** Redux Toolkit 또는 Context API
- **결제 시스템:** Stripe API 또는 토스페이먼츠 API
- **파일 저장:** AWS S3 (상품 이미지)
- **배포:** Docker, AWS EC2/ECS
- **테스트:** Jest, React Testing Library, Supertest
- **패키지 매니저:** npm 또는 yarn

## 4. 핵심 디렉토리 구조 (Core Directory Structure)
```
src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── common/         # 공통 컴포넌트 (Header, Footer, Button 등)
│   ├── product/        # 상품 관련 컴포넌트
│   ├── cart/           # 장바구니 관련 컴포넌트
│   └── order/          # 주문 관련 컴포넌트
├── pages/              # Next.js 페이지 컴포넌트
│   ├── api/            # API 라우트 (백엔드 엔드포인트)
│   ├── admin/          # 관리자 페이지
│   └── auth/           # 인증 관련 페이지
├── services/           # 비즈니스 로직 및 API 호출
│   ├── productService.js    # 상품 관련 비즈니스 로직
│   ├── userService.js       # 사용자 관련 비즈니스 로직
│   ├── orderService.js      # 주문 관련 비즈니스 로직
│   └── paymentService.js    # 결제 관련 비즈니스 로직
├── models/             # 데이터베이스 모델 (Prisma 또는 Sequelize)
├── utils/              # 공통 유틸리티 함수
├── middleware/         # Express 미들웨어 (인증, 로깅 등)
└── config/             # 환경 설정 파일
```

## 5. 주요 로직 및 파일 (Key Logic & Files)

### 핵심 비즈니스 로직
- **`src/services/productService.js`**: 상품 CRUD 및 검색 기능
  - `createProduct()`: 새 상품 등록
  - `getProducts()`: 상품 목록 조회 (필터링, 정렬 포함)
  - `updateStock()`: 재고 관리

- **`src/services/orderService.js`**: 주문 처리 핵심 로직
  - `createOrder()`: 주문 생성 및 재고 차감
  - `processPayment()`: 결제 처리 연동
  - `updateOrderStatus()`: 주문 상태 업데이트

- **`src/services/userService.js`**: 사용자 관리 및 인증
  - `registerUser()`: 사용자 등록
  - `authenticateUser()`: 로그인 인증
  - `getUserProfile()`: 사용자 프로필 조회

### 핵심 API 엔드포인트
- **`pages/api/products/`**: 상품 관련 API
- **`pages/api/orders/`**: 주문 관련 API
- **`pages/api/auth/`**: 인증 관련 API
- **`pages/api/payments/`**: 결제 관련 API

### 중요 설정 파일
- **`config/database.js`**: 데이터베이스 연결 설정
- **`config/payment.js`**: 결제 게이트웨이 설정
- **`middleware/auth.js`**: JWT 기반 인증 미들웨어

## 6. 로컬 실행 및 테스트 방법 (How to Run & Test)

### 개발 환경 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local

# 데이터베이스 설정 (PostgreSQL)
npm run db:setup

# 개발 서버 실행
npm run dev
```

### 테스트 실행
```bash
# 전체 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test services/productService.test.js

# 테스트 커버리지 확인
npm run test:coverage
```

### 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 7. 중요 규칙 및 제약사항 (Rules & Constraints)

### 개발 규칙
- **API 응답 형식**: 모든 API는 `utils/response.js`의 표준 형식을 따라야 함
- **에러 처리**: 모든 비동기 함수는 try-catch 블록으로 에러 처리 필수
- **데이터 검증**: 모든 사용자 입력은 유효성 검사 후 처리
- **보안**: 사용자 비밀번호는 bcrypt로 해싱, JWT 토큰 사용

### 데이터베이스 규칙
- **트랜잭션**: 주문 생성 시 재고 차감은 반드시 트랜잭션으로 처리
- **인덱스**: 검색 성능을 위해 상품명, 카테고리에 인덱스 설정
- **제약 조건**: 외래키 제약조건을 통한 데이터 무결성 보장

### 코딩 컨벤션
- **파일명**: camelCase 사용 (예: productService.js)
- **함수명**: 동사로 시작하는 camelCase (예: createProduct)
- **상수**: UPPER_SNAKE_CASE 사용 (예: MAX_CART_ITEMS)

## 8. 모듈별 가이드 (claude.md 중첩 사용 규칙)

### 중요 지시사항
**특정 서브디렉토리의 파일을 작업할 때는 해당 디렉토리 내 `claude.md` 파일을 먼저 확인하고 그 컨텍스트를 최우선으로 적용할 것.**

### 예상되는 서브 모듈별 claude.md
- **`src/components/claude.md`**: UI 컴포넌트 작성 규칙 및 디자인 시스템
- **`src/services/claude.md`**: 비즈니스 로직 작성 규칙 및 API 호출 패턴
- **`src/pages/api/claude.md`**: API 엔드포인트 작성 규칙 및 응답 형식
- **`src/models/claude.md`**: 데이터베이스 스키마 정의 및 관계 설정 규칙

### 컨텍스트 적용 예시
```markdown
# 예시: src/services/claude.md
## 모듈: 비즈니스 로직 서비스
- **역할**: 데이터 처리 및 외부 API 연동을 담당하는 서비스 계층
- **규칙 1**: 모든 서비스 함수는 async/await 패턴 사용
- **규칙 2**: 에러는 커스텀 Error 클래스로 throw
- **규칙 3**: 외부 API 호출 시 재시도 로직 포함
```

## 9. 개발 우선순위 (Development Priority)

### Phase 1: 기본 기능 (MVP)
1. 사용자 인증 시스템
2. 상품 관리 (CRUD)
3. 장바구니 기능
4. 기본 주문 처리

### Phase 2: 핵심 기능 확장
1. 결제 시스템 연동
2. 주문 상태 관리
3. 재고 관리 자동화
4. 기본 관리자 패널

### Phase 3: 고급 기능
1. 상품 검색 및 필터링
2. 리뷰 및 평점 시스템
3. 쿠폰 및 할인 기능
4. 주문 통계 및 분석

## 10. 참고 문서 및 리소스
- **API 문서**: `/docs/api/` 디렉토리 내 Swagger 문서
- **데이터베이스 스키마**: `/docs/database/schema.md`
- **UI/UX 가이드**: `/docs/design/style-guide.md`
- **배포 가이드**: `/docs/deployment/production.md`