const Redis = require('redis');
const { Fail } = require('../utils/response');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: process.env.LOG_FILE_PATH || './logs/app.log' })
  ]
});

/**
 * Rate Limiting 미들웨어
 * Redis를 사용한 슬라이딩 윈도우 방식으로 API 호출 제한
 */
class RateLimitMiddleware {
  constructor() {
    this.redis = null;
    this.fallbackStore = new Map(); // Redis 연결 실패 시 메모리 저장소
    this.initializeRedis();

    // 기본 설정
    this.defaultConfig = {
      windowMs: 60000, // 1분
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator
    };
  }

  /**
   * Redis 클라이언트를 초기화합니다
   */
  async initializeRedis() {
    try {
      this.redis = Redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (err) => {
        logger.warn('Redis Client Error (falling back to memory store):', err);
        this.redis = null; // Redis 사용 불가시 null로 설정
      });

      this.redis.on('connect', () => {
        logger.info('Rate Limit Redis Client Connected');
      });

      await this.redis.connect();
    } catch (error) {
      logger.warn('Failed to connect to Redis, using memory store:', error);
      this.redis = null;
    }
  }

  /**
   * 기본 키 생성기
   * @param {Object} req - Express 요청 객체
   * @param {string} prefix - 키 접두사
   * @returns {string} 생성된 키
   */
  defaultKeyGenerator(req, prefix) {
    const clientId = req.headers['x-client-id'] ||
                    req.headers['authorization']?.split(' ')[1] ||
                    req.ip ||
                    'anonymous';
    return `ratelimit:${prefix}:${clientId}`;
  }

  /**
   * 슬라이딩 윈도우 방식으로 Rate Limit을 확인합니다
   * @param {string} key - 제한 키
   * @param {number} windowMs - 윈도우 시간 (밀리초)
   * @param {number} maxRequests - 최대 요청 수
   * @returns {Promise<Object>} Rate Limit 결과
   */
  async checkRateLimit(key, windowMs, maxRequests) {
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      if (this.redis) {
        return await this.checkWithRedis(key, now, windowStart, maxRequests);
      } else {
        return await this.checkWithMemory(key, now, windowStart, maxRequests);
      }
    } catch (error) {
      logger.error('Rate limit check error:', error);
      // 에러 발생 시 요청을 허용하되 로그를 남김
      return {
        allowed: true,
        totalHits: 0,
        remainingRequests: maxRequests,
        resetTime: now + windowMs,
        error: 'Rate limiter unavailable'
      };
    }
  }

  /**
   * Redis를 사용한 Rate Limit 확인
   */
  async checkWithRedis(key, now, windowStart, maxRequests) {
    const multi = this.redis.multi();

    // 1. 현재 요청을 윈도우에 추가
    multi.zAdd(key, { score: now, value: now.toString() });

    // 2. 윈도우 밖의 오래된 요청들 제거
    multi.zRemRangeByScore(key, '-inf', windowStart);

    // 3. 현재 윈도우의 요청 수 카운트
    multi.zCard(key);

    // 4. 키의 TTL 설정
    multi.expire(key, Math.ceil((now - windowStart + 60000) / 1000)); // 여유분 1분 추가

    const results = await multi.exec();
    const totalHits = results[2][1]; // zCard 결과

    const allowed = totalHits <= maxRequests;
    const resetTime = windowStart + (Math.ceil(now / 60000) * 60000);

    return {
      allowed,
      totalHits,
      remainingRequests: Math.max(0, maxRequests - totalHits),
      resetTime,
      retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000)
    };
  }

  /**
   * 메모리를 사용한 Rate Limit 확인 (fallback)
   */
  async checkWithMemory(key, now, windowStart, maxRequests) {
    if (!this.fallbackStore.has(key)) {
      this.fallbackStore.set(key, []);
    }

    const requests = this.fallbackStore.get(key);

    // 오래된 요청들 제거
    const validRequests = requests.filter(timestamp => timestamp > windowStart);

    // 현재 요청 추가
    validRequests.push(now);

    // 업데이트
    this.fallbackStore.set(key, validRequests);

    const totalHits = validRequests.length;
    const allowed = totalHits <= maxRequests;
    const resetTime = windowStart + 60000; // 1분 후 리셋

    // 메모리 사용량 관리: 큰 키들 정리
    this.cleanupMemoryStore();

    return {
      allowed,
      totalHits,
      remainingRequests: Math.max(0, maxRequests - totalHits),
      resetTime,
      retryAfter: allowed ? 0 : Math.ceil((resetTime - now) / 1000)
    };
  }

  /**
   * 메모리 저장소를 정리합니다
   */
  cleanupMemoryStore() {
    if (this.fallbackStore.size > 1000) {
      const now = Date.now();
      const cutoffTime = now - (10 * 60 * 1000); // 10분

      for (const [key, requests] of this.fallbackStore.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > cutoffTime);

        if (validRequests.length === 0) {
          this.fallbackStore.delete(key);
        } else {
          this.fallbackStore.set(key, validRequests);
        }
      }
    }
  }

  /**
   * Rate Limit 미들웨어 팩토리 함수
   * @param {string} prefix - 키 접두사
   * @param {number} maxRequests - 최대 요청 수
   * @param {number} windowMs - 윈도우 시간 (밀리초)
   * @param {Object} options - 추가 옵션
   * @returns {Function} Express 미들웨어 함수
   */
  createMiddleware(prefix, maxRequests, windowMs, options = {}) {
    const config = { ...this.defaultConfig, ...options, maxRequests, windowMs };

    return async (req, res, next) => {
      try {
        const key = config.keyGenerator(req, prefix);

        const result = await this.checkRateLimit(key, config.windowMs, config.maxRequests);

        // 응답 헤더 설정
        res.set({
          'X-RateLimit-Limit': config.maxRequests,
          'X-RateLimit-Remaining': result.remainingRequests,
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Window': config.windowMs
        });

        if (!result.allowed) {
          // Rate Limit 초과
          logger.warn('Rate limit exceeded', {
            key,
            totalHits: result.totalHits,
            limit: config.maxRequests,
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });

          res.set('Retry-After', result.retryAfter.toString());

          return res.status(429).json(
            Fail(
              `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${Math.floor(config.windowMs / 1000)} seconds.`,
              {
                limit: config.maxRequests,
                remaining: result.remainingRequests,
                resetTime: result.resetTime,
                retryAfter: result.retryAfter
              },
              429
            )
          );
        }

        // Rate Limit 통과시 요청 정보 로깅
        if (result.totalHits > config.maxRequests * 0.8) { // 80% 도달시 경고
          logger.warn('Rate limit warning - nearing limit', {
            key,
            totalHits: result.totalHits,
            limit: config.maxRequests,
            remaining: result.remainingRequests
          });
        }

        next();

      } catch (error) {
        logger.error('Rate limit middleware error:', error);
        // 에러 발생 시 요청을 허용하되 로그를 남김
        next();
      }
    };
  }

  /**
   * 특정 키의 Rate Limit을 초기화합니다
   * @param {string} key - 초기화할 키
   */
  async resetRateLimit(key) {
    try {
      if (this.redis) {
        await this.redis.del(key);
      } else {
        this.fallbackStore.delete(key);
      }
      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
    }
  }

  /**
   * 모든 Rate Limit을 초기화합니다
   */
  async resetAllRateLimits() {
    try {
      if (this.redis) {
        const keys = await this.redis.keys('ratelimit:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      } else {
        this.fallbackStore.clear();
      }
      logger.info('All rate limits reset');
    } catch (error) {
      logger.error('Failed to reset all rate limits:', error);
    }
  }

  /**
   * Rate Limit 통계를 조회합니다
   * @param {string} prefix - 키 접두사 (옵션)
   * @returns {Object} 통계 정보
   */
  async getRateLimitStats(prefix = null) {
    try {
      const stats = {
        totalKeys: 0,
        activeKeys: 0,
        topUsers: [],
        timestamp: new Date().toISOString()
      };

      if (this.redis) {
        const pattern = prefix ? `ratelimit:${prefix}:*` : 'ratelimit:*';
        const keys = await this.redis.keys(pattern);
        stats.totalKeys = keys.length;

        // 활성 키 계산 (최근 1분 내 활동)
        const now = Date.now();
        const recentThreshold = now - 60000;

        for (const key of keys.slice(0, 100)) { // 성능을 위해 최대 100개만 확인
          const count = await this.redis.zCount(key, recentThreshold, '+inf');
          if (count > 0) {
            stats.activeKeys++;
            stats.topUsers.push({
              key: key.replace('ratelimit:', ''),
              recentRequests: count
            });
          }
        }

        // 상위 사용자 정렬
        stats.topUsers.sort((a, b) => b.recentRequests - a.recentRequests);
        stats.topUsers = stats.topUsers.slice(0, 10);

      } else {
        stats.totalKeys = this.fallbackStore.size;
        stats.activeKeys = this.fallbackStore.size; // 메모리 저장소의 경우 모든 키가 활성

        // 메모리 저장소 상위 사용자
        const now = Date.now();
        const recentThreshold = now - 60000;

        for (const [key, requests] of this.fallbackStore.entries()) {
          const recentRequests = requests.filter(timestamp => timestamp > recentThreshold).length;
          if (recentRequests > 0) {
            stats.topUsers.push({
              key: key.replace('ratelimit:', ''),
              recentRequests
            });
          }
        }

        stats.topUsers.sort((a, b) => b.recentRequests - a.recentRequests);
        stats.topUsers = stats.topUsers.slice(0, 10);
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get rate limit stats:', error);
      return {
        error: 'Unable to retrieve stats',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 싱글톤 인스턴스 생성
const rateLimitMiddleware = new RateLimitMiddleware();

/**
 * Rate Limit 미들웨어를 생성하는 헬퍼 함수
 * @param {string} prefix - 키 접두사
 * @param {number} maxRequests - 최대 요청 수
 * @param {number} windowMs - 윈도우 시간 (밀리초)
 * @param {Object} options - 추가 옵션
 * @returns {Function} Express 미들웨어
 */
const createRateLimitMiddleware = (prefix, maxRequests, windowMs, options) => {
  return rateLimitMiddleware.createMiddleware(prefix, maxRequests, windowMs, options);
};

module.exports = createRateLimitMiddleware;
module.exports.RateLimitMiddleware = rateLimitMiddleware;