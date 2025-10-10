/**
 * TaobaoCrawlerService - 타오바오 로그인 세션 기반 크롤링 서비스
 *
 * Playwright를 활용하여 실제 브라우저 세션을 유지하면서
 * 타오바오 로그인 상태로 상품 검색 및 크롤링을 수행합니다.
 *
 * 주요 기능:
 * - 로그인 세션 생성 및 저장
 * - 세션 복원 및 유지
 * - 로그인 상태에서 상품 검색
 * - 상품 상세 정보 크롤링
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import {
  TaobaoSearchParams,
  TaobaoSearchResult,
  TaobaoSearchItem,
  TaobaoProductDetail,
  TaobaoSessionStatus,
  TaobaoLoginResponse,
  BrowserSessionData,
  TaobaoCrawlerConfig,
  CrawlerStatus,
} from '@/types/taobao.types';

/**
 * TaobaoCrawlerService 클래스
 */
export class TaobaoCrawlerService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private status: CrawlerStatus = CrawlerStatus.IDLE;
  private sessionPath: string;
  private config: Required<TaobaoCrawlerConfig>;

  // 기본 설정
  private readonly DEFAULT_CONFIG: Required<TaobaoCrawlerConfig> = {
    headless: false, // 로그인 시에는 headless: false 권장
    timeout: 30000,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    viewport: {
      width: 1920,
      height: 1080,
    },
  };

  constructor(config?: Partial<TaobaoCrawlerConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.sessionPath = path.join(
      process.cwd(),
      'data',
      'sessions',
      'taobao-session.json'
    );
  }

  /**
   * 브라우저 초기화
   * 저장된 세션이 있으면 복원, 없으면 새로운 컨텍스트 생성
   */
  async initialize(): Promise<void> {
    if (this.status === CrawlerStatus.READY) {
      console.log('[TaobaoCrawler] Already initialized');
      return;
    }

    try {
      this.status = CrawlerStatus.INITIALIZING;
      console.log('[TaobaoCrawler] Initializing browser...');

      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      // 저장된 세션이 있으면 복원
      if (await this.hasSession()) {
        console.log('[TaobaoCrawler] Restoring session from file...');
        const sessionData = await this.loadSession();
        this.context = await this.browser.newContext({
          storageState: sessionData,
          userAgent: this.config.userAgent,
          locale: this.config.locale,
          viewport: this.config.viewport,
        });
      } else {
        console.log('[TaobaoCrawler] Creating new context...');
        this.context = await this.browser.newContext({
          userAgent: this.config.userAgent,
          locale: this.config.locale,
          viewport: this.config.viewport,
        });
      }

      this.status = CrawlerStatus.READY;
      console.log('[TaobaoCrawler] Initialization completed');
    } catch (error) {
      this.status = CrawlerStatus.ERROR;
      console.error('[TaobaoCrawler] Initialization failed:', error);
      throw new Error(
        `브라우저 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    }
  }

  /**
   * 타오바오 로그인 세션 생성
   * 사용자가 수동으로 로그인할 수 있도록 브라우저를 열어줍니다.
   *
   * @param waitForLogin 로그인 완료를 대기할 시간 (초), 기본 120초
   */
  async createLoginSession(
    waitForLogin: number = 120
  ): Promise<TaobaoLoginResponse> {
    if (!this.context) {
      await this.initialize();
    }

    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    try {
      console.log('[TaobaoCrawler] Opening Taobao login page...');

      // 타오바오 로그인 페이지로 이동
      await page.goto('https://login.taobao.com', {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      console.log(
        `[TaobaoCrawler] Please login manually. Waiting for ${waitForLogin} seconds...`
      );
      console.log(
        '[TaobaoCrawler] After login, the session will be saved automatically.'
      );

      // 로그인 완료를 대기 (메인 페이지 또는 마이페이지로 리다이렉트 확인)
      try {
        await page.waitForURL(
          (url) =>
            url.hostname.includes('taobao.com') &&
            !url.pathname.includes('login'),
          { timeout: waitForLogin * 1000 }
        );

        console.log('[TaobaoCrawler] Login detected! Saving session...');

        // 세션 저장
        await this.saveSession();

        // 사용자 정보 추출 (옵션)
        const username = await this.extractUsername(page);

        await page.close();

        return {
          success: true,
          message: '로그인 세션이 성공적으로 생성되었습니다.',
          session: {
            id: 'taobao-session',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일
            username,
          },
        };
      } catch (timeoutError) {
        await page.close();
        return {
          success: false,
          message: '로그인 대기 시간이 초과되었습니다.',
          error: {
            code: 'LOGIN_TIMEOUT',
            message: `${waitForLogin}초 동안 로그인이 완료되지 않았습니다.`,
          },
        };
      }
    } catch (error) {
      await page.close();
      console.error('[TaobaoCrawler] Login session creation failed:', error);
      return {
        success: false,
        message: '로그인 세션 생성 중 오류가 발생했습니다.',
        error: {
          code: 'LOGIN_ERROR',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        },
      };
    }
  }

  /**
   * 세션 상태 확인
   */
  async getSessionStatus(): Promise<TaobaoSessionStatus> {
    const hasSession = await this.hasSession();

    if (!hasSession) {
      return {
        isActive: false,
        isLoggedIn: false,
        lastUpdated: new Date(),
      };
    }

    // 세션 파일이 있으면 검증
    try {
      if (!this.context) {
        await this.initialize();
      }

      const isLoggedIn = await this.verifyLogin();

      return {
        isActive: true,
        isLoggedIn,
        lastUpdated: await this.getSessionFileModifiedDate(),
      };
    } catch (error) {
      return {
        isActive: false,
        isLoggedIn: false,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * 타오바오 상품 검색
   *
   * @param params 검색 파라미터
   */
  async searchProducts(
    params: TaobaoSearchParams
  ): Promise<TaobaoSearchResult> {
    const startTime = Date.now();

    if (!this.context) {
      await this.initialize();
    }

    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    try {
      this.status = CrawlerStatus.CRAWLING;
      console.log(`[TaobaoCrawler] Searching for: ${params.keyword}`);

      // 타오바오 검색 URL 생성
      const searchUrl = this.buildSearchUrl(params);

      // 검색 페이지로 이동
      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // 로그인이 필요한 경우 감지
      if (page.url().includes('login')) {
        await page.close();
        throw new Error(
          '로그인이 필요합니다. /api/v1/crawling/taobao/login을 먼저 호출해주세요.'
        );
      }

      // 상품 목록이 로드될 때까지 대기
      await page.waitForSelector('.item', { timeout: 10000 });

      // 상품 목록 추출
      const items = await page.evaluate(() => {
        const itemElements = Array.from(document.querySelectorAll('.item'));
        return itemElements.map((item) => {
          const titleEl = item.querySelector('.title');
          const priceEl = item.querySelector('.price');
          const imgEl = item.querySelector('img');
          const linkEl = item.querySelector('a');
          const shopEl = item.querySelector('.shop');
          const salesEl = item.querySelector('.deal-cnt');
          const locationEl = item.querySelector('.location');

          return {
            title: titleEl?.textContent?.trim() || '',
            price: priceEl?.textContent?.trim() || '',
            imageUrl: imgEl?.src || '',
            productUrl: linkEl?.href || '',
            shopName: shopEl?.textContent?.trim(),
            sales: salesEl?.textContent?.trim(),
            location: locationEl?.textContent?.trim(),
          };
        });
      });

      // 페이지네이션 정보 추출
      const totalItems = await page.evaluate(() => {
        const totalEl = document.querySelector('.total');
        const totalText = totalEl?.textContent || '0';
        const match = totalText.match(/\d+/);
        return match ? parseInt(match[0], 10) : items.length;
      });

      const pageSize = params.pageSize || 44; // 타오바오 기본 페이지 크기
      const currentPage = params.page || 1;
      const totalPages = Math.ceil(totalItems / pageSize);

      await page.close();
      this.status = CrawlerStatus.READY;

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        items: items as TaobaoSearchItem[],
        pagination: {
          currentPage,
          pageSize,
          totalItems,
          totalPages,
        },
        metadata: {
          searchedAt: new Date(),
          keyword: params.keyword,
          responseTime,
        },
      };
    } catch (error) {
      await page.close();
      this.status = CrawlerStatus.READY;
      console.error('[TaobaoCrawler] Search failed:', error);

      const responseTime = Date.now() - startTime;

      return {
        success: false,
        items: [],
        pagination: {
          currentPage: params.page || 1,
          pageSize: params.pageSize || 44,
          totalItems: 0,
          totalPages: 0,
        },
        metadata: {
          searchedAt: new Date(),
          keyword: params.keyword,
          responseTime,
        },
        error: {
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        },
      };
    }
  }

  /**
   * 상품 상세 정보 크롤링
   *
   * @param productUrl 타오바오 상품 URL
   */
  async getProductDetail(productUrl: string): Promise<TaobaoProductDetail> {
    if (!this.context) {
      await this.initialize();
    }

    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    try {
      console.log(`[TaobaoCrawler] Fetching product detail: ${productUrl}`);

      await page.goto(productUrl, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // 상품 상세 정보 추출
      const productDetail = await page.evaluate(() => {
        // 제목
        const title =
          document.querySelector('.tb-main-title')?.textContent?.trim() || '';

        // 가격
        const priceText =
          document.querySelector('.tb-rmb-num')?.textContent?.trim() || '0';
        const currentPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));

        // 이미지
        const images = Array.from(
          document.querySelectorAll('#J_ImgBooth img')
        ).map((img) => (img as HTMLImageElement).src);

        // 판매자 정보
        const sellerName =
          document.querySelector('.tb-seller-name')?.textContent?.trim() || '';

        // 판매량
        const salesText =
          document.querySelector('.tb-sell-counter')?.textContent?.trim() ||
          '0';
        const sales = parseInt(salesText.replace(/[^0-9]/g, ''), 10);

        return {
          title,
          price: {
            current: currentPrice,
            currency: 'CNY',
          },
          images,
          seller: {
            name: sellerName,
          },
          sales,
        };
      });

      await page.close();

      return productDetail as TaobaoProductDetail;
    } catch (error) {
      await page.close();
      console.error('[TaobaoCrawler] Product detail fetch failed:', error);
      throw new Error(
        `상품 상세 정보 크롤링 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      );
    }
  }

  /**
   * 세션 저장
   */
  async saveSession(): Promise<void> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    const sessionData = await this.context.storageState();
    await fs.mkdir(path.dirname(this.sessionPath), { recursive: true });
    await fs.writeFile(this.sessionPath, JSON.stringify(sessionData, null, 2));
    console.log(`[TaobaoCrawler] Session saved to ${this.sessionPath}`);
  }

  /**
   * 세션 불러오기
   */
  async loadSession(): Promise<BrowserSessionData> {
    const data = await fs.readFile(this.sessionPath, 'utf-8');
    return JSON.parse(data) as BrowserSessionData;
  }

  /**
   * 세션 존재 여부 확인
   */
  async hasSession(): Promise<boolean> {
    try {
      await fs.access(this.sessionPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 세션 삭제
   */
  async clearSession(): Promise<void> {
    try {
      await fs.unlink(this.sessionPath);
      console.log('[TaobaoCrawler] Session cleared');
    } catch (error) {
      // 파일이 없으면 무시
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 로그인 상태 검증
   */
  private async verifyLogin(): Promise<boolean> {
    if (!this.context) return false;

    const page = await this.context.newPage();

    try {
      await page.goto('https://www.taobao.com', {
        waitUntil: 'networkidle',
        timeout: 10000,
      });

      // 로그인 상태 확인 (예: 사용자명이 표시되는지)
      const isLoggedIn = await page.evaluate(() => {
        const loginElement = document.querySelector('.site-nav-login');
        return loginElement === null; // 로그인 링크가 없으면 로그인된 상태
      });

      await page.close();
      return isLoggedIn;
    } catch (error) {
      await page.close();
      return false;
    }
  }

  /**
   * 사용자명 추출
   */
  private async extractUsername(page: Page): Promise<string | undefined> {
    try {
      const username = await page.evaluate(() => {
        const usernameEl = document.querySelector('.site-nav-user');
        return usernameEl?.textContent?.trim();
      });
      return username || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 세션 파일 수정 날짜 가져오기
   */
  private async getSessionFileModifiedDate(): Promise<Date> {
    try {
      const stats = await fs.stat(this.sessionPath);
      return stats.mtime;
    } catch {
      return new Date();
    }
  }

  /**
   * 검색 URL 생성
   */
  private buildSearchUrl(params: TaobaoSearchParams): string {
    const baseUrl = 'https://s.taobao.com/search';
    const queryParams = new URLSearchParams();

    queryParams.append('q', params.keyword);

    if (params.page && params.page > 1) {
      queryParams.append('s', ((params.page - 1) * 44).toString());
    }

    if (params.sortBy) {
      const sortMap = {
        default: '',
        price_asc: 'price-asc',
        price_desc: 'price-desc',
        sales: 'sale-desc',
        newest: 'new-desc',
      };
      const sort = sortMap[params.sortBy];
      if (sort) {
        queryParams.append('sort', sort);
      }
    }

    if (params.filters) {
      if (params.filters.minPrice) {
        queryParams.append('startPrice', params.filters.minPrice.toString());
      }
      if (params.filters.maxPrice) {
        queryParams.append('endPrice', params.filters.maxPrice.toString());
      }
      if (params.filters.freeShipping) {
        queryParams.append('free_shipping', '1');
      }
    }

    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * 리소스 정리
   */
  async close(): Promise<void> {
    console.log('[TaobaoCrawler] Closing browser...');

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.status = CrawlerStatus.CLOSED;
    console.log('[TaobaoCrawler] Browser closed');
  }

  /**
   * 현재 상태 반환
   */
  getStatus(): CrawlerStatus {
    return this.status;
  }
}

// 싱글톤 인스턴스 내보내기
export const taobaoCrawlerService = new TaobaoCrawlerService();
