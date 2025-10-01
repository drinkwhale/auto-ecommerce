/**
 * CrawlingService - 상품 크롤링 비즈니스 로직
 *
 * 이 서비스는 외부 이커머스 플랫폼에서 상품 정보를 수집하는 핵심 로직을 담당합니다.
 * - 타오바오, 아마존, 알리바바 등 다양한 플랫폼 지원
 * - HTML 파싱 및 데이터 추출
 * - 에러 처리 및 재시도 로직
 * - Rate limiting 및 프록시 관리
 *
 * Phase 3.4: 서비스 계층 구현 - T026
 */

import { PrismaClient, SourcePlatform, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as cheerio from 'cheerio';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 크롤링 요청 입력 타입
 */
export interface CrawlRequestInput {
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  userId: string;
  options?: CrawlOptions;
}

/**
 * 크롤링 옵션
 */
export interface CrawlOptions {
  useProxy?: boolean;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  waitTime?: number; // Rate limiting을 위한 대기 시간 (ms)
}

/**
 * 크롤링 결과 타입
 */
export interface CrawlResult {
  success: boolean;
  data?: CrawledProductData;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    crawledAt: Date;
    platform: SourcePlatform;
    sourceUrl: string;
    responseTime: number; // ms
    retryCount: number;
  };
}

/**
 * 크롤링된 상품 데이터
 */
export interface CrawledProductData {
  title: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
    originalAmount?: number;
  };
  images?: string[];
  specifications?: Record<string, any>;
  category?: string;
  brand?: string;
  model?: string;
  tags?: string[];
  stock?: {
    available: boolean;
    quantity?: number;
  };
  seller?: {
    id?: string;
    name?: string;
    rating?: number;
  };
  ratings?: {
    average?: number;
    count?: number;
  };
}

/**
 * 플랫폼별 셀렉터 설정
 */
interface PlatformSelectors {
  title: string;
  price: string;
  description: string;
  images: string;
  category?: string;
  brand?: string;
  specifications?: string;
}

/**
 * 크롤링 요청 검증 스키마
 */
export const CrawlRequestSchema = z.object({
  sourceUrl: z.string().url('유효한 URL을 입력해주세요'),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  userId: z.string().min(1, '사용자 ID는 필수입니다'),
  options: z.object({
    useProxy: z.boolean().optional(),
    timeout: z.number().min(1000).max(60000).optional(),
    retries: z.number().min(0).max(5).optional(),
    headers: z.record(z.string()).optional(),
    waitTime: z.number().min(0).max(10000).optional(),
  }).optional(),
});

/**
 * 배치 크롤링 요청 입력
 */
export interface BatchCrawlInput {
  requests: CrawlRequestInput[];
  parallel?: boolean;
  maxConcurrent?: number;
}

/**
 * 배치 크롤링 결과
 */
export interface BatchCrawlResult {
  total: number;
  successful: number;
  failed: number;
  results: CrawlResult[];
  duration: number; // ms
}

/**
 * CrawlingService 클래스
 */
class CrawlingService {
  private axiosInstance: AxiosInstance;
  private readonly defaultTimeout = 30000; // 30초
  private readonly defaultRetries = 3;
  private readonly defaultWaitTime = 1000; // 1초

  // 플랫폼별 셀렉터 맵
  private platformSelectors: Record<SourcePlatform, PlatformSelectors> = {
    [SourcePlatform.TAOBAO]: {
      title: '.tb-main-title',
      price: '.tb-rmb-num',
      description: '#description',
      images: '#J_ImgBooth img',
      category: '.breadcrumb a',
      brand: '.tm-brand a',
      specifications: '.tb-property-type',
    },
    [SourcePlatform.AMAZON]: {
      title: '#productTitle',
      price: '.a-price-whole',
      description: '#productDescription',
      images: '#altImages img',
      category: '#wayfinding-breadcrumbs_container a',
      brand: '#bylineInfo',
      specifications: '#productDetails_detailBullets_sections1',
    },
    [SourcePlatform.ALIBABA]: {
      title: '.product-title',
      price: '.price',
      description: '.product-description',
      images: '.product-image img',
      category: '.breadcrumb a',
      brand: '.supplier-name',
      specifications: '.product-specs',
    },
    [SourcePlatform.COUPANG]: {
      title: '.prod-buy-header__title',
      price: '.total-price strong',
      description: '.prod-description',
      images: '.prod-image__detail img',
      category: '.breadcrumb a',
      brand: '.prod-brand-name',
      specifications: '.prod-attr-item',
    },
    [SourcePlatform.GMARKET]: {
      title: '.itemtit',
      price: '.price_innerwrap strong',
      description: '.item_desc',
      images: '.thumb_img img',
      category: '.breadcrumb a',
      brand: '.item_brandname',
      specifications: '.item_spec',
    },
    [SourcePlatform.STREET11]: {
      title: '.c_prd_name',
      price: '.sale_price',
      description: '.c_prd_info',
      images: '.prd_img img',
      category: '.location a',
      brand: '.c_prd_brand',
      specifications: '.c_prd_spec',
    },
    [SourcePlatform.OTHER]: {
      title: 'h1',
      price: '.price',
      description: '.description',
      images: 'img',
    },
  };

  constructor() {
    this.axiosInstance = axios.create({
      timeout: this.defaultTimeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
  }

  /**
   * 단일 URL 크롤링
   */
  async crawlUrl(input: CrawlRequestInput): Promise<CrawlResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = input.options?.retries ?? this.defaultRetries;

    // 입력 검증
    const validatedInput = CrawlRequestSchema.parse(input);

    while (retryCount <= maxRetries) {
      try {
        // Rate limiting
        if (validatedInput.options?.waitTime) {
          await this.sleep(validatedInput.options.waitTime);
        }

        // HTTP 요청
        const response = await this.fetchUrl(
          validatedInput.sourceUrl,
          validatedInput.options
        );

        // HTML 파싱
        const productData = await this.parseHtml(
          response.data,
          validatedInput.sourcePlatform,
          validatedInput.sourceUrl
        );

        const responseTime = Date.now() - startTime;

        return {
          success: true,
          data: productData,
          metadata: {
            crawledAt: new Date(),
            platform: validatedInput.sourcePlatform,
            sourceUrl: validatedInput.sourceUrl,
            responseTime,
            retryCount,
          },
        };
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          const responseTime = Date.now() - startTime;
          return this.handleError(error, {
            crawledAt: new Date(),
            platform: validatedInput.sourcePlatform,
            sourceUrl: validatedInput.sourceUrl,
            responseTime,
            retryCount: retryCount - 1,
          });
        }

        // 재시도 전 대기
        await this.sleep(1000 * retryCount);
      }
    }

    // 이 코드에 도달하지 않아야 하지만 타입 안정성을 위해 추가
    throw new Error('크롤링 실패: 최대 재시도 횟수 초과');
  }

  /**
   * 배치 크롤링
   */
  async crawlBatch(input: BatchCrawlInput): Promise<BatchCrawlResult> {
    const startTime = Date.now();
    let results: CrawlResult[] = [];

    if (input.parallel) {
      // 병렬 처리
      const maxConcurrent = input.maxConcurrent ?? 5;
      const chunks = this.chunkArray(input.requests, maxConcurrent);

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((request) => this.crawlUrl(request))
        );
        results = results.concat(chunkResults);
      }
    } else {
      // 순차 처리
      for (const request of input.requests) {
        const result = await this.crawlUrl(request);
        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    return {
      total: results.length,
      successful,
      failed,
      results,
      duration,
    };
  }

  /**
   * 크롤링 후 상품 자동 생성
   */
  async crawlAndCreateProduct(input: CrawlRequestInput & {
    salesSettings: {
      marginRate: number;
      targetMarkets: any[];
      autoUpdate: boolean;
    };
  }) {
    // 크롤링 실행
    const crawlResult = await this.crawlUrl(input);

    if (!crawlResult.success || !crawlResult.data) {
      throw new Error(`크롤링 실패: ${crawlResult.error?.message}`);
    }

    // 상품 데이터 생성
    const productData = crawlResult.data;
    const originalPrice = productData.price.amount;
    const marginRate = input.salesSettings.marginRate;
    const salePrice = originalPrice * (1 + marginRate);

    // Product 생성
    const product = await prisma.product.create({
      data: {
        userId: input.userId,
        sourceInfo: {
          sourceUrl: input.sourceUrl,
          sourcePlatform: input.sourcePlatform,
          sourceProductId: this.extractProductId(input.sourceUrl, input.sourcePlatform),
          lastCrawledAt: new Date(),
        } as any,
        originalData: {
          title: productData.title,
          description: productData.description,
          price: productData.price,
          images: productData.images?.map((url) => ({
            originalUrl: url,
            status: 'pending',
          })),
          specifications: productData.specifications,
          category: productData.category,
          brand: productData.brand,
          model: productData.model,
          tags: productData.tags,
        } as any,
        salesSettings: {
          marginRate: input.salesSettings.marginRate,
          salePrice,
          minPrice: originalPrice * 0.9,
          maxPrice: originalPrice * 2.0,
          targetMarkets: input.salesSettings.targetMarkets,
          autoUpdate: input.salesSettings.autoUpdate,
        } as any,
        status: ProductStatus.PROCESSING,
      },
    });

    return {
      product,
      crawlResult,
    };
  }

  /**
   * 기존 상품 재크롤링 (가격 업데이트 등)
   */
  async recrawlProduct(productId: string) {
    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    const sourceInfo = product.sourceInfo as any;

    // 재크롤링
    const crawlResult = await this.crawlUrl({
      sourceUrl: sourceInfo.sourceUrl,
      sourcePlatform: sourceInfo.sourcePlatform,
      userId: product.userId,
    });

    if (!crawlResult.success || !crawlResult.data) {
      throw new Error(`재크롤링 실패: ${crawlResult.error?.message}`);
    }

    // 가격 변동 확인
    const originalData = product.originalData as any;
    const oldPrice = originalData.price.amount;
    const newPrice = crawlResult.data.price.amount;
    const priceChanged = oldPrice !== newPrice;

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        sourceInfo: {
          ...sourceInfo,
          lastCrawledAt: new Date(),
        } as any,
        originalData: {
          ...originalData,
          price: crawlResult.data.price,
          title: crawlResult.data.title,
          description: crawlResult.data.description,
          images: crawlResult.data.images?.map((url) => ({
            originalUrl: url,
            status: 'pending',
          })),
        } as any,
        // 가격이 변경되고 autoUpdate가 활성화된 경우 판매가도 업데이트
        ...(priceChanged && (product.salesSettings as any).autoUpdate && {
          salesSettings: {
            ...(product.salesSettings as any),
            salePrice: newPrice * (1 + (product.salesSettings as any).marginRate),
          } as any,
        }),
      },
    });

    return {
      product: updatedProduct,
      crawlResult,
      priceChanged,
      oldPrice,
      newPrice,
    };
  }

  /**
   * 여러 상품 재크롤링 (배치)
   */
  async recrawlProducts(productIds: string[]) {
    const results = [];

    for (const productId of productIds) {
      try {
        const result = await this.recrawlProduct(productId);
        results.push({
          productId,
          success: true,
          ...result,
        });
      } catch (error) {
        results.push({
          productId,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        });
      }
    }

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * URL에서 상품 정보 미리보기 (상품 생성 전)
   */
  async previewProduct(sourceUrl: string, sourcePlatform: SourcePlatform) {
    const crawlResult = await this.crawlUrl({
      sourceUrl,
      sourcePlatform,
      userId: 'preview', // 미리보기는 임시 사용자
    });

    return crawlResult;
  }

  /**
   * HTTP 요청 실행
   */
  private async fetchUrl(url: string, options?: CrawlOptions) {
    const config: any = {
      timeout: options?.timeout ?? this.defaultTimeout,
      headers: options?.headers ?? {},
    };

    // 프록시 설정 (옵션)
    if (options?.useProxy) {
      // 실제 프록시 설정은 환경 변수나 설정 파일에서 가져와야 함
      // config.proxy = { host: 'proxy.example.com', port: 8080 };
    }

    return await this.axiosInstance.get(url, config);
  }

  /**
   * HTML 파싱
   */
  private async parseHtml(
    html: string,
    platform: SourcePlatform,
    sourceUrl: string
  ): Promise<CrawledProductData> {
    const $ = cheerio.load(html);
    const selectors = this.platformSelectors[platform];

    // 기본 정보 추출
    const title = this.extractText($, selectors.title);
    const priceText = this.extractText($, selectors.price);
    const description = this.extractText($, selectors.description);

    // 이미지 추출
    const images = this.extractImages($, selectors.images);

    // 카테고리 추출
    const category = selectors.category
      ? this.extractText($, selectors.category)
      : undefined;

    // 브랜드 추출
    const brand = selectors.brand
      ? this.extractText($, selectors.brand)
      : undefined;

    // 가격 파싱
    const price = this.parsePrice(priceText, platform);

    // 스펙 추출 (플랫폼별 로직)
    const specifications = selectors.specifications
      ? this.extractSpecifications($, selectors.specifications, platform)
      : undefined;

    return {
      title: title || 'Unknown Product',
      description,
      price: {
        amount: price,
        currency: this.getCurrency(platform),
      },
      images,
      category,
      brand,
      specifications,
      tags: this.extractTags(title, description),
    };
  }

  /**
   * 텍스트 추출
   */
  private extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).first().text().trim();
  }

  /**
   * 이미지 URL 추출
   */
  private extractImages($: cheerio.CheerioAPI, selector: string): string[] {
    const images: string[] = [];
    $(selector).each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src) {
        images.push(src.startsWith('http') ? src : `https:${src}`);
      }
    });
    return images;
  }

  /**
   * 스펙 정보 추출
   */
  private extractSpecifications(
    $: cheerio.CheerioAPI,
    selector: string,
    platform: SourcePlatform
  ): Record<string, any> {
    const specs: Record<string, any> = {};

    $(selector).each((_, elem) => {
      const key = $(elem).find('.spec-key').text().trim();
      const value = $(elem).find('.spec-value').text().trim();
      if (key && value) {
        specs[key] = value;
      }
    });

    return specs;
  }

  /**
   * 가격 파싱
   */
  private parsePrice(priceText: string, platform: SourcePlatform): number {
    // 숫자만 추출
    const numericString = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(numericString);

    if (isNaN(price)) {
      return 0;
    }

    return price;
  }

  /**
   * 플랫폼별 통화 반환
   */
  private getCurrency(platform: SourcePlatform): string {
    const currencyMap: Record<SourcePlatform, string> = {
      [SourcePlatform.TAOBAO]: 'CNY',
      [SourcePlatform.AMAZON]: 'USD',
      [SourcePlatform.ALIBABA]: 'USD',
      [SourcePlatform.COUPANG]: 'KRW',
      [SourcePlatform.GMARKET]: 'KRW',
      [SourcePlatform.STREET11]: 'KRW',
      [SourcePlatform.OTHER]: 'USD',
    };

    return currencyMap[platform];
  }

  /**
   * URL에서 상품 ID 추출
   */
  private extractProductId(url: string, platform: SourcePlatform): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const searchParams = urlObj.searchParams;

      switch (platform) {
        case SourcePlatform.TAOBAO:
          return searchParams.get('id') || pathname.split('/').pop() || 'unknown';
        case SourcePlatform.AMAZON:
          const match = pathname.match(/\/dp\/([A-Z0-9]+)/);
          return match ? match[1] : 'unknown';
        case SourcePlatform.ALIBABA:
          return pathname.split('/').pop() || 'unknown';
        default:
          return pathname.split('/').pop() || 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  /**
   * 태그 추출 (제목과 설명에서)
   */
  private extractTags(title?: string, description?: string): string[] {
    const tags: string[] = [];
    const text = `${title} ${description}`.toLowerCase();

    // 간단한 키워드 추출 로직
    const keywords = ['new', 'sale', 'hot', 'best', 'premium', 'limited'];
    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return tags;
  }

  /**
   * 에러 처리
   */
  private handleError(
    error: unknown,
    metadata: CrawlResult['metadata']
  ): CrawlResult {
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = '알 수 없는 오류가 발생했습니다';
    let errorDetails: any = undefined;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      errorCode = axiosError.code || 'HTTP_ERROR';
      errorMessage = axiosError.message;
      errorDetails = {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
      };
    } else if (error instanceof Error) {
      errorCode = 'PARSING_ERROR';
      errorMessage = error.message;
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
      },
      metadata,
    };
  }

  /**
   * Sleep 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 배열 청크 분할
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 크롤링 통계 조회
   */
  async getCrawlingStatistics(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const products = await prisma.product.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        sourceInfo: true,
        createdAt: true,
        status: true,
      },
    });

    // 플랫폼별 통계
    const byPlatform: Record<string, number> = {};
    products.forEach((product) => {
      const sourceInfo = product.sourceInfo as any;
      const platform = sourceInfo.sourcePlatform;
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    });

    // 상태별 통계
    const byStatus: Record<string, number> = {};
    products.forEach((product) => {
      byStatus[product.status] = (byStatus[product.status] || 0) + 1;
    });

    return {
      total: products.length,
      period: `${days}일`,
      byPlatform,
      byStatus,
    };
  }

  /**
   * 상품 검색 (플랫폼별)
   * 실제 구현에서는 각 플랫폼의 검색 API를 사용해야 하지만,
   * 현재는 시뮬레이션 데이터를 반환합니다.
   */
  async searchProducts(input: {
    query: string;
    platform: SourcePlatform;
    page?: number;
    limit?: number;
    sortBy?: 'relevance' | 'sales' | 'price_asc' | 'price_desc';
  }) {
    const { query, platform, page = 1, limit = 20, sortBy = 'sales' } = input;

    // 실제 구현에서는 플랫폼별 API 호출
    // 여기서는 시뮬레이션 데이터 생성
    const mockResults = this.generateMockSearchResults(query, platform, page, limit, sortBy);

    return mockResults;
  }

  /**
   * 목 검색 결과 생성 (개발용)
   * 실제 배포 시에는 각 플랫폼의 실제 API로 교체
   */
  private generateMockSearchResults(
    query: string,
    platform: SourcePlatform,
    page: number,
    limit: number,
    sortBy: string
  ) {
    // 시뮬레이션 상품 데이터
    const mockProducts = [];
    const totalResults = 100; // 가상 전체 결과 수

    for (let i = 0; i < limit; i++) {
      const productIndex = (page - 1) * limit + i + 1;
      if (productIndex > totalResults) break;

      const basePrice = Math.floor(Math.random() * 100000) + 10000;
      const salesCount = Math.floor(Math.random() * 10000);
      const rating = (Math.random() * 2 + 3).toFixed(1); // 3.0 ~ 5.0

      mockProducts.push({
        id: `${platform.toLowerCase()}_${productIndex}`,
        title: `${query} - 상품 ${productIndex}`,
        price: {
          amount: basePrice,
          currency: this.getCurrency(platform),
        },
        imageUrl: this.generateMockImage(query, productIndex),
        sourceUrl: this.generateMockUrl(platform, productIndex),
        salesCount,
        rating: parseFloat(rating),
        reviewCount: Math.floor(salesCount * 0.1),
        seller: {
          name: `판매자 ${productIndex % 10 + 1}`,
          rating: parseFloat((Math.random() * 0.5 + 4.5).toFixed(1)),
        },
        shipping: {
          isFree: Math.random() > 0.3,
          estimatedDays: Math.floor(Math.random() * 5) + 3,
        },
      });
    }

    // 정렬 적용
    if (sortBy === 'sales') {
      mockProducts.sort((a, b) => b.salesCount - a.salesCount);
    } else if (sortBy === 'price_asc') {
      mockProducts.sort((a, b) => a.price.amount - b.price.amount);
    } else if (sortBy === 'price_desc') {
      mockProducts.sort((a, b) => b.price.amount - a.price.amount);
    }

    return {
      query,
      platform,
      results: mockProducts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        pageSize: limit,
      },
      sortBy,
    };
  }

  /**
   * 플랫폼별 목 URL 생성
   */
  private generateMockUrl(platform: SourcePlatform, productId: number): string {
    const urlMap: Record<SourcePlatform, string> = {
      [SourcePlatform.TAOBAO]: `https://item.taobao.com/item.htm?id=${productId}`,
      [SourcePlatform.AMAZON]: `https://www.amazon.com/dp/B${String(productId).padStart(9, '0')}`,
      [SourcePlatform.ALIBABA]: `https://www.alibaba.com/product-detail/${productId}.html`,
      [SourcePlatform.COUPANG]: `https://www.coupang.com/vp/products/${productId}`,
      [SourcePlatform.GMARKET]: `https://item.gmarket.co.kr/Item?goodscode=${productId}`,
      [SourcePlatform.STREET11]: `https://www.11st.co.kr/products/${productId}`,
      [SourcePlatform.OTHER]: `https://example.com/product/${productId}`,
    };

    return urlMap[platform];
  }
}

// 싱글톤 인스턴스 내보내기
export const crawlingService = new CrawlingService();