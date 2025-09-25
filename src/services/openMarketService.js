const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');
// const RateLimiter = require('../utils/rateLimiter'); // 제거됨 - Next.js에서 사용 시 구현 필요

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: process.env.LOG_FILE_PATH || './logs/app.log' })
  ]
});

/**
 * 오픈마켓 API 통합을 위한 기본 서비스 클래스
 * 모든 오픈마켓 클라이언트가 상속받아 사용
 */
class OpenMarketService {
  constructor(config) {
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      platform: config.platform,
      ...config
    };

    // this.rateLimiter = new RateLimiter(); // 제거됨 - Next.js에서 사용 시 구현 필요
    this.axios = this.createAxiosInstance();
  }

  /**
   * Axios 인스턴스를 생성하고 설정합니다
   */
  createAxiosInstance() {
    const instance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Auto-Ecommerce-Platform/1.0'
      }
    });

    // 요청 인터셉터 - Rate Limiting 및 인증
    instance.interceptors.request.use(
      async (config) => {
        await this.handleRateLimit();
        return await this.addAuthHeaders(config);
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터 - 에러 처리 및 재시도
    instance.interceptors.response.use(
      (response) => {
        logger.info(`API Request Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          platform: this.config.platform
        });
        return response;
      },
      async (error) => {
        return await this.handleResponseError(error);
      }
    );

    return instance;
  }

  /**
   * Rate Limiting을 처리합니다
   */
  async handleRateLimit() {
    const identifier = this.getRequestIdentifier();
    const result = await this.rateLimiter.checkRateLimit(this.config.platform, identifier);

    if (!result.allowed) {
      const error = new Error('Rate limit exceeded');
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.retryAfter = result.retryAfter;
      throw error;
    }

    logger.debug(`Rate limit check passed: ${result.remainingRequests} requests remaining`);
  }

  /**
   * 인증 헤더를 추가합니다 (각 플랫폼별로 오버라이드)
   */
  async addAuthHeaders(config) {
    // 기본 구현 - 서브클래스에서 오버라이드
    return config;
  }

  /**
   * 응답 에러를 처리합니다
   */
  async handleResponseError(error) {
    const originalRequest = error.config;

    logger.error(`API Request Error: ${error.message}`, {
      url: originalRequest?.url,
      status: error.response?.status,
      platform: this.config.platform,
      attempt: originalRequest?._retryCount || 1
    });

    // Rate Limit 에러 처리
    if (error.response?.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
      const retryAfter = error.retryAfter || this.extractRetryAfter(error.response?.headers);

      if (originalRequest && !originalRequest._retryCount) {
        originalRequest._retryCount = 1;

        logger.info(`Rate limited, retrying after ${retryAfter} seconds`);
        await this.delay(retryAfter * 1000);

        return this.axios(originalRequest);
      }
    }

    // 네트워크 에러나 서버 에러에 대한 재시도
    if (this.shouldRetry(error) && originalRequest) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

      if (originalRequest._retryCount <= this.config.maxRetries) {
        const delayMs = this.rateLimiter.calculateBackoffDelay(originalRequest._retryCount);

        logger.info(`Retrying request (${originalRequest._retryCount}/${this.config.maxRetries}) after ${delayMs}ms`);
        await this.delay(delayMs);

        return this.axios(originalRequest);
      }
    }

    return Promise.reject(error);
  }

  /**
   * 재시도 가능한 에러인지 확인합니다
   */
  shouldRetry(error) {
    if (!error.response) {
      // 네트워크 에러
      return ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code);
    }

    const status = error.response.status;
    // 서버 에러 (5xx) 또는 특정 클라이언트 에러에 대해 재시도
    return status >= 500 || status === 408 || status === 429;
  }

  /**
   * Retry-After 헤더에서 대기 시간을 추출합니다
   */
  extractRetryAfter(headers) {
    if (!headers) return 60; // 기본값 60초

    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter);
      return isNaN(seconds) ? 60 : Math.min(seconds, 300); // 최대 5분
    }

    return 60;
  }

  /**
   * 요청 식별자를 생성합니다 (Rate Limiting용)
   */
  getRequestIdentifier() {
    return this.config.apiKey || this.config.clientId || 'default';
  }

  /**
   * 지정된 시간만큼 대기합니다
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * HMAC 서명을 생성합니다
   */
  generateHmacSignature(data, secret, algorithm = 'sha256') {
    return crypto.createHmac(algorithm, secret).update(data).digest('hex');
  }

  /**
   * 상품을 등록합니다 (추상 메서드)
   */
  async registerProduct(productData) {
    throw new Error('registerProduct method must be implemented by subclass');
  }

  /**
   * 상품을 수정합니다 (추상 메서드)
   */
  async updateProduct(productId, productData) {
    throw new Error('updateProduct method must be implemented by subclass');
  }

  /**
   * 상품을 삭제합니다 (추상 메서드)
   */
  async deleteProduct(productId) {
    throw new Error('deleteProduct method must be implemented by subclass');
  }

  /**
   * 상품 목록을 조회합니다 (추상 메서드)
   */
  async getProducts(options = {}) {
    throw new Error('getProducts method must be implemented by subclass');
  }

  /**
   * 주문 목록을 조회합니다 (추상 메서드)
   */
  async getOrders(options = {}) {
    throw new Error('getOrders method must be implemented by subclass');
  }

  /**
   * 카테고리 목록을 조회합니다 (추상 메서드)
   */
  async getCategories() {
    throw new Error('getCategories method must be implemented by subclass');
  }

  /**
   * 이미지를 업로드합니다 (추상 메서드)
   */
  async uploadImage(imageFile) {
    throw new Error('uploadImage method must be implemented by subclass');
  }

  /**
   * 재고를 업데이트합니다 (추상 메서드)
   */
  async updateInventory(productId, quantity) {
    throw new Error('updateInventory method must be implemented by subclass');
  }
}

module.exports = OpenMarketService;