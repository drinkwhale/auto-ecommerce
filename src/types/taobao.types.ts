/**
 * Taobao Crawler Types
 *
 * 타오바오 크롤링 및 세션 관리 관련 타입 정의
 */

/**
 * 타오바오 상품 검색 결과 아이템
 */
export interface TaobaoSearchItem {
  title: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  shopName?: string;
  sales?: string;
  location?: string;
  rating?: string;
}

/**
 * 타오바오 상품 상세 정보
 */
export interface TaobaoProductDetail {
  title: string;
  price: {
    current: number;
    original?: number;
    currency: string;
  };
  images: string[];
  description?: string;
  specifications?: Record<string, any>;
  seller: {
    id?: string;
    name: string;
    rating?: number;
    location?: string;
  };
  category?: string;
  sales?: number;
  reviews?: {
    count: number;
    averageRating?: number;
  };
  shipping?: {
    fee?: number;
    freeShipping?: boolean;
  };
}

/**
 * 타오바오 세션 상태
 */
export interface TaobaoSessionStatus {
  isActive: boolean;
  isLoggedIn: boolean;
  lastUpdated: Date;
  expiresAt?: Date;
  username?: string;
}

/**
 * 타오바오 로그인 응답
 */
export interface TaobaoLoginResponse {
  success: boolean;
  message: string;
  session?: {
    id: string;
    expiresAt: Date;
    username?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 타오바오 검색 요청 파라미터
 */
export interface TaobaoSearchParams {
  keyword: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'default' | 'price_asc' | 'price_desc' | 'sales' | 'newest';
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    freeShipping?: boolean;
  };
}

/**
 * 타오바오 검색 결과
 */
export interface TaobaoSearchResult {
  success: boolean;
  items: TaobaoSearchItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  metadata: {
    searchedAt: Date;
    keyword: string;
    responseTime: number; // ms
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 브라우저 세션 데이터 (Playwright StorageState)
 */
export interface BrowserSessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

/**
 * 크롤러 설정
 */
export interface TaobaoCrawlerConfig {
  headless?: boolean;
  timeout?: number;
  userAgent?: string;
  locale?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * 크롤러 상태
 */
export enum CrawlerStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  CRAWLING = 'CRAWLING',
  ERROR = 'ERROR',
  CLOSED = 'CLOSED',
}
