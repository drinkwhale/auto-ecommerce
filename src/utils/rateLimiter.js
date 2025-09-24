const Redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

class RateLimiter {
  constructor() {
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    // 기본 Rate Limit 설정
    this.defaultLimits = {
      elevenst: {
        maxRequests: parseInt(process.env.ELEVENST_RATE_LIMIT_MAX_REQUESTS) || 50,
        windowMs: parseInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_MS) || 60000,
      },
      esm: {
        maxRequests: parseInt(process.env.ESM_RATE_LIMIT_MAX_REQUESTS) || 30,
        windowMs: parseInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_MS) || 60000,
      },
      coupang: {
        maxRequests: parseInt(process.env.COUPANG_RATE_LIMIT_MAX_REQUESTS) || 40,
        windowMs: parseInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_MS) || 60000,
      },
      naver: {
        maxRequests: parseInt(process.env.NAVER_RATE_LIMIT_MAX_REQUESTS) || 60,
        windowMs: parseInt(process.env.DEFAULT_RATE_LIMIT_WINDOW_MS) || 60000,
      }
    };
  }

  /**
   * Redis 연결을 초기화합니다
   */
  async connect() {
    try {
      await this.redis.connect();
      logger.info('RateLimiter Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * 토큰 버킷 알고리즘을 사용하여 Rate Limiting을 확인합니다
   * @param {string} platform - 플랫폼 이름 (elevenst, esm, coupang, naver)
   * @param {string} identifier - 요청 식별자 (보통 API 키나 사용자 ID)
   * @returns {Promise<Object>} Rate Limit 결과
   */
  async checkRateLimit(platform, identifier) {
    const config = this.defaultLimits[platform];
    if (!config) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    const key = `ratelimit:${platform}:${identifier}`;
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

    try {
      // 현재 윈도우의 요청 수 확인
      const currentCount = await this.redis.get(`${key}:${windowStart}`);
      const requestCount = parseInt(currentCount) || 0;

      if (requestCount >= config.maxRequests) {
        const resetTime = windowStart + config.windowMs;
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }

      // 요청 수 증가
      await this.redis.multi()
        .incr(`${key}:${windowStart}`)
        .expire(`${key}:${windowStart}`, Math.ceil(config.windowMs / 1000))
        .exec();

      return {
        allowed: true,
        remainingRequests: config.maxRequests - (requestCount + 1),
        resetTime: windowStart + config.windowMs,
        retryAfter: 0
      };

    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Redis 오류 시 요청을 허용하되 로그를 남김
      return {
        allowed: true,
        remainingRequests: config.maxRequests,
        resetTime: now + config.windowMs,
        retryAfter: 0,
        error: 'Redis unavailable'
      };
    }
  }

  /**
   * Exponential Backoff를 사용하여 재시도 지연 시간을 계산합니다
   * @param {number} attempt - 시도 횟수
   * @param {number} baseDelay - 기본 지연 시간 (ms)
   * @param {number} maxDelay - 최대 지연 시간 (ms)
   * @returns {number} 지연 시간 (ms)
   */
  calculateBackoffDelay(attempt, baseDelay = 1000, maxDelay = 30000) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // 지터(jitter) 추가로 thundering herd 방지
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * 플랫폼별 대기열을 관리합니다
   * @param {string} platform - 플랫폼 이름
   * @param {Object} requestData - 요청 데이터
   * @returns {Promise<string>} 대기열 ID
   */
  async addToQueue(platform, requestData) {
    const queueKey = `queue:${platform}`;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queueItem = {
      id: requestId,
      data: requestData,
      timestamp: Date.now(),
      attempts: 0,
      status: 'pending'
    };

    await this.redis.lPush(queueKey, JSON.stringify(queueItem));
    logger.info(`Added request to queue: ${platform}:${requestId}`);

    return requestId;
  }

  /**
   * 대기열에서 다음 요청을 가져옵니다
   * @param {string} platform - 플랫폼 이름
   * @returns {Promise<Object|null>} 다음 요청 또는 null
   */
  async getNextFromQueue(platform) {
    const queueKey = `queue:${platform}`;

    try {
      const item = await this.redis.rPop(queueKey);
      if (!item) return null;

      return JSON.parse(item);
    } catch (error) {
      logger.error('Error getting next from queue:', error);
      return null;
    }
  }

  /**
   * 실패한 요청을 재시도 대기열에 추가합니다
   * @param {string} platform - 플랫폼 이름
   * @param {Object} requestData - 요청 데이터
   * @param {number} retryAfter - 재시도 대기 시간 (초)
   */
  async addToRetryQueue(platform, requestData, retryAfter) {
    const retryQueueKey = `retry:${platform}`;
    const retryTime = Date.now() + (retryAfter * 1000);

    const retryItem = {
      ...requestData,
      retryTime,
      attempts: (requestData.attempts || 0) + 1
    };

    await this.redis.zAdd(retryQueueKey, {
      score: retryTime,
      value: JSON.stringify(retryItem)
    });

    logger.info(`Added request to retry queue: ${platform}, retry at ${new Date(retryTime)}`);
  }

  /**
   * 재시도 준비된 요청들을 가져옵니다
   * @param {string} platform - 플랫폼 이름
   * @returns {Promise<Array>} 재시도 준비된 요청들
   */
  async getReadyRetryRequests(platform) {
    const retryQueueKey = `retry:${platform}`;
    const now = Date.now();

    try {
      const items = await this.redis.zRangeByScore(retryQueueKey, 0, now);
      if (items.length === 0) return [];

      // 가져온 항목들을 대기열에서 제거
      await this.redis.zRemRangeByScore(retryQueueKey, 0, now);

      return items.map(item => JSON.parse(item));
    } catch (error) {
      logger.error('Error getting retry requests:', error);
      return [];
    }
  }

  /**
   * Redis 연결을 종료합니다
   */
  async disconnect() {
    await this.redis.quit();
  }
}

module.exports = RateLimiter;