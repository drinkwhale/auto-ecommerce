/**
 * External Client Utilities
 *
 * 외부 API 호출을 위한 유틸리티
 * - 재시도 (Retry) 로직
 * - 백오프 (Backoff) 전략
 * - 타임아웃 관리
 * - 에러 핸들링
 *
 * Phase 3A.3: T221 - 외부 API 재시도·백오프 유틸 추가
 */

/**
 * 재시도 옵션
 */
export interface RetryOptions {
  /**
   * 최대 재시도 횟수 (기본값: 3)
   */
  maxRetries?: number;

  /**
   * 초기 백오프 지연 시간 (밀리초, 기본값: 1000)
   */
  initialDelay?: number;

  /**
   * 백오프 배율 (기본값: 2)
   * 각 재시도마다 delay * backoffMultiplier 만큼 대기
   */
  backoffMultiplier?: number;

  /**
   * 최대 백오프 지연 시간 (밀리초, 기본값: 30000)
   */
  maxDelay?: number;

  /**
   * 타임아웃 시간 (밀리초, 기본값: 10000)
   */
  timeout?: number;

  /**
   * 재시도 가능한 에러 판별 함수
   * true를 반환하면 재시도, false를 반환하면 즉시 실패
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * 재시도 전 호출되는 콜백
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * 백오프 전략
 */
export enum BackoffStrategy {
  /**
   * 지수 백오프 (Exponential Backoff)
   * delay = initialDelay * (backoffMultiplier ^ attempt)
   */
  EXPONENTIAL = 'exponential',

  /**
   * 선형 백오프 (Linear Backoff)
   * delay = initialDelay * attempt
   */
  LINEAR = 'linear',

  /**
   * 고정 백오프 (Fixed Backoff)
   * delay = initialDelay (항상 동일한 지연)
   */
  FIXED = 'fixed',

  /**
   * 랜덤 지터 백오프 (Random Jitter)
   * delay = random(0, initialDelay * backoffMultiplier ^ attempt)
   */
  RANDOM_JITTER = 'random_jitter',
}

/**
 * 재시도 결과
 */
export interface RetryResult<T> {
  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 결과 데이터 (성공 시)
   */
  data?: T;

  /**
   * 에러 (실패 시)
   */
  error?: Error;

  /**
   * 총 시도 횟수
   */
  attempts: number;

  /**
   * 총 소요 시간 (밀리초)
   */
  totalTime: number;
}

/**
 * 재시도 통계
 */
export interface RetryStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalRetries: number;
  averageAttempts: number;
}

/**
 * 재시도 가능한 외부 API 클라이언트
 */
export class ExternalClient {
  private stats: RetryStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalRetries: 0,
    averageAttempts: 0,
  };

  /**
   * 재시도 로직이 적용된 함수 실행
   */
  async executeWithRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      backoffMultiplier = 2,
      maxDelay = 30000,
      timeout = 10000,
      shouldRetry = this.defaultShouldRetry,
      onRetry,
    } = options || {};

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    this.stats.totalCalls++;

    while (attempt <= maxRetries) {
      try {
        // 타임아웃 적용
        const result = await this.executeWithTimeout(fn, timeout);

        // 성공
        this.stats.successfulCalls++;
        if (attempt > 0) {
          this.stats.totalRetries += attempt;
        }
        this.updateAverageAttempts(attempt + 1);

        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 재시도 가능 여부 확인
        if (attempt >= maxRetries || !shouldRetry(lastError)) {
          break;
        }

        // 백오프 지연 계산
        const delay = this.calculateDelay(attempt, initialDelay, backoffMultiplier, maxDelay);

        // 재시도 콜백 호출
        if (onRetry) {
          onRetry(lastError, attempt + 1, delay);
        }

        // 지연 후 재시도
        await this.sleep(delay);
        attempt++;
      }
    }

    // 실패
    this.stats.failedCalls++;
    if (attempt > 0) {
      this.stats.totalRetries += attempt;
    }
    this.updateAverageAttempts(attempt + 1);

    return {
      success: false,
      error: lastError || new Error('알 수 없는 오류'),
      attempts: attempt + 1,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * 타임아웃이 적용된 함수 실행
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`타임아웃: ${timeout}ms 초과`)), timeout)
      ),
    ]);
  }

  /**
   * 백오프 지연 시간 계산
   */
  private calculateDelay(
    attempt: number,
    initialDelay: number,
    backoffMultiplier: number,
    maxDelay: number,
    strategy: BackoffStrategy = BackoffStrategy.EXPONENTIAL
  ): number {
    let delay: number;

    switch (strategy) {
      case BackoffStrategy.EXPONENTIAL:
        delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        break;

      case BackoffStrategy.LINEAR:
        delay = initialDelay * (attempt + 1);
        break;

      case BackoffStrategy.FIXED:
        delay = initialDelay;
        break;

      case BackoffStrategy.RANDOM_JITTER:
        const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
        delay = Math.random() * exponentialDelay;
        break;

      default:
        delay = initialDelay * Math.pow(backoffMultiplier, attempt);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * 기본 재시도 판별 함수
   * 네트워크 에러, 타임아웃, 5xx 서버 에러는 재시도
   */
  private defaultShouldRetry(error: Error): boolean {
    // 타임아웃 에러
    if (error.message.includes('타임아웃')) {
      return true;
    }

    // 네트워크 에러
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      return true;
    }

    // Axios 에러 (5xx 서버 에러)
    if ('response' in error) {
      const response = (error as any).response;
      if (response && response.status >= 500 && response.status < 600) {
        return true;
      }
    }

    // 레이트 리미트 (429 Too Many Requests)
    if ('response' in error) {
      const response = (error as any).response;
      if (response && response.status === 429) {
        return true;
      }
    }

    return false;
  }

  /**
   * 지연 (Sleep)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 평균 시도 횟수 업데이트
   */
  private updateAverageAttempts(attempts: number): void {
    const totalAttempts = this.stats.averageAttempts * (this.stats.totalCalls - 1) + attempts;
    this.stats.averageAttempts = totalAttempts / this.stats.totalCalls;
  }

  /**
   * 통계 조회
   */
  getStats(): RetryStats {
    return { ...this.stats };
  }

  /**
   * 통계 초기화
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalRetries: 0,
      averageAttempts: 0,
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const externalClient = new ExternalClient();

/**
 * 헬퍼 함수: 재시도 로직으로 함수 래핑
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const result = await externalClient.executeWithRetry(fn, options);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

/**
 * 데코레이터: 클래스 메서드에 재시도 로직 적용
 */
export function Retry(options?: RetryOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
