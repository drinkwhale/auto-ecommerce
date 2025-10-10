# 타오바오 로그인 세션 기반 크롤러

## 개요

타오바오에서 실제 로그인 세션을 유지하면서 상품 검색 및 상세 정보를 크롤링할 수 있는 기능입니다.

Playwright를 활용하여 실제 브라우저 환경에서 동작하므로:
- JavaScript 렌더링 지원
- 로그인 세션 유지 가능
- 쿠키 및 로컬스토리지 관리
- 반자동 로그인 (최초 1회 수동 로그인 후 세션 저장)

## 아키텍처

```
┌─────────────────────────────────────┐
│   API Endpoints                      │
│   - POST /api/v1/crawling/taobao/login    │
│   - GET  /api/v1/crawling/taobao/session  │
│   - POST /api/v1/crawling/taobao/search   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   TaobaoCrawlerService               │
│   - createLoginSession()             │
│   - getSessionStatus()               │
│   - searchProducts()                 │
│   - getProductDetail()               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Playwright Browser                 │
│   - 세션 유지 (쿠키, 로컬스토리지)    │
│   - 반자동 로그인                     │
│   - 실제 브라우저 렌더링              │
└─────────────────────────────────────┘
```

## 사용 방법

### 1. 로그인 세션 생성

최초 1회, 타오바오에 로그인하여 세션을 저장합니다.

**요청:**
```bash
POST /api/v1/crawling/taobao/login
Content-Type: application/json

{
  "waitForLogin": 120  # 로그인 대기 시간 (초), 기본값 120초
}
```

**동작:**
1. 브라우저가 열리고 타오바오 로그인 페이지로 이동합니다.
2. 사용자가 수동으로 로그인합니다 (QR 코드 또는 계정/비밀번호).
3. 로그인 완료 후 자동으로 세션이 저장됩니다.

**응답:**
```json
{
  "success": true,
  "data": {
    "id": "taobao-session",
    "expiresAt": "2025-11-09T12:00:00.000Z",
    "username": "your_username"
  },
  "message": "로그인 세션이 성공적으로 생성되었습니다."
}
```

### 2. 세션 상태 확인

저장된 세션의 유효성과 로그인 상태를 확인합니다.

**요청:**
```bash
GET /api/v1/crawling/taobao/session
```

**응답:**
```json
{
  "success": true,
  "data": {
    "isActive": true,
    "isLoggedIn": true,
    "lastUpdated": "2025-10-10T12:00:00.000Z",
    "username": "your_username"
  }
}
```

### 3. 상품 검색

로그인된 세션으로 타오바오 상품을 검색합니다.

**요청:**
```bash
POST /api/v1/crawling/taobao/search
Content-Type: application/json

{
  "keyword": "折叠伞",
  "page": 1,
  "pageSize": 44,
  "sortBy": "sales",
  "filters": {
    "minPrice": 10,
    "maxPrice": 100,
    "freeShipping": true
  }
}
```

**파라미터:**
- `keyword` (필수): 검색 키워드
- `page`: 페이지 번호 (기본값: 1)
- `pageSize`: 페이지 크기 (기본값: 44)
- `sortBy`: 정렬 기준
  - `default`: 기본 정렬
  - `price_asc`: 가격 낮은 순
  - `price_desc`: 가격 높은 순
  - `sales`: 판매량 순
  - `newest`: 최신순
- `filters`: 필터 옵션
  - `minPrice`: 최소 가격
  - `maxPrice`: 최대 가격
  - `location`: 지역
  - `freeShipping`: 무료배송 여부

**응답:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "title": "全自动雨伞男女折叠大号双人三折防晒防紫外线遮阳伞晴雨两用",
        "price": "¥29.90",
        "imageUrl": "https://img.alicdn.com/...",
        "productUrl": "https://item.taobao.com/item.htm?id=...",
        "shopName": "开心淘家居优品",
        "sales": "月销1000+",
        "location": "浙江 杭州"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 44,
      "totalItems": 1280,
      "totalPages": 30
    }
  },
  "metadata": {
    "searchedAt": "2025-10-10T12:00:00.000Z",
    "keyword": "折叠伞",
    "responseTime": 3542
  }
}
```

### 4. 세션 삭제 (선택)

저장된 세션을 삭제합니다.

**요청:**
```bash
DELETE /api/v1/crawling/taobao/session
```

**응답:**
```json
{
  "success": true,
  "message": "세션이 삭제되었습니다."
}
```

## 기존 CrawlingService와의 관계

**중요:** `TaobaoCrawlerService`는 **독립적인 기능**입니다.

- 기존 `CrawlingService`는 **Mock 데이터**를 반환합니다 (변경 없음)
- `TaobaoCrawlerService`는 **실제 크롤링**을 수행합니다 (신규 기능)
- 두 서비스는 **별도로 동작**하며, 상호 독립적입니다

```typescript
// 방법 1: 기존 CrawlingService (Mock 데이터)
const mockResult = await crawlingService.crawlUrl({
  sourceUrl: 'https://item.taobao.com/item.htm?id=123456',
  sourcePlatform: SourcePlatform.TAOBAO,
  userId: 'user-id',
});
// 결과: Mock 데이터 반환 (빠르지만 가짜)

// 방법 2: TaobaoCrawlerService (실제 크롤링)
const realResult = await taobaoCrawlerService.getProductDetail(
  'https://item.taobao.com/item.htm?id=123456'
);
// 결과: 실제 크롤링 데이터 반환 (느리지만 진짜)
```

**사용 시나리오:**
- **개발/테스트**: `CrawlingService` 사용 (빠른 Mock 데이터)
- **실제 운영**: 새로운 타오바오 API 사용 (실제 상품 정보)

## 세션 파일 위치

세션 데이터는 다음 경로에 저장됩니다:
```
<project-root>/data/sessions/taobao-session.json
```

## 주의사항

1. **보안**: 세션 파일에는 로그인 쿠키가 포함되어 있으므로 `.gitignore`에 추가해야 합니다.
   ```
   # .gitignore
   data/sessions/
   ```

2. **세션 만료**: 타오바오 세션은 약 30일 후 만료될 수 있습니다. 만료 시 다시 로그인해야 합니다.

3. **브라우저 자동화**: 개발 환경에서는 `headless: false`로 설정하여 로그인 과정을 확인할 수 있습니다.

4. **Rate Limiting**: 과도한 크롤링은 타오바오의 Rate Limit에 걸릴 수 있으므로 적절한 지연 시간을 두어야 합니다.

## 설정

`TaobaoCrawlerService` 생성 시 설정을 커스터마이즈할 수 있습니다:

```typescript
import { TaobaoCrawlerService } from '@/services/taobao-crawler.service';

const crawler = new TaobaoCrawlerService({
  headless: true,     // 헤드리스 모드 (기본값: false)
  timeout: 60000,     // 타임아웃 (기본값: 30000ms)
  locale: 'zh-CN',    // 로케일 (기본값: 'zh-CN')
  viewport: {
    width: 1920,
    height: 1080,
  },
});
```

## 트러블슈팅

### 로그인 실패
- 브라우저가 열리는지 확인
- VPN 또는 프록시 설정 확인
- 타오바오 로그인 방식 변경 (QR 코드 → 계정/비밀번호)

### 세션이 유효하지 않음
```bash
# 세션 삭제 후 다시 로그인
DELETE /api/v1/crawling/taobao/session
POST /api/v1/crawling/taobao/login
```

### Playwright 설치 오류
```bash
# Playwright 브라우저 재설치
npx playwright install chromium
```

## 라이선스

MIT License
