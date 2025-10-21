/**
 * External Client 단위 테스트
 *
 * Phase 3A.3: T221 - 외부 API 재시도·백오프 유틸 테스트
 */

import { ExternalClient, withRetry, BackoffStrategy, RetryOptions } from '../../src/lib/external-client';

describe('ExternalClient 재시도 로직', () => {
  let client: ExternalClient;

  beforeEach(() => {
    client = new ExternalClient();
    client.resetStats();
  });

  describe('기본 재시도 동작', () => {
    test('성공하는 함수는 재시도 없이 즉시 반환', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await client.executeWithRetry(mockFn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('첫 번째 시도에서 실패하고 두 번째 시도에서 성공', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('첫 번째 실패'))
        .mockResolvedValueOnce('두 번째 성공');

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('두 번째 성공');
      expect(result.attempts).toBe(2);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('최대 재시도 횟수 초과 시 실패', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('계속 실패'));

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 2,
        initialDelay: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('계속 실패');
      expect(result.attempts).toBe(3); // 초기 시도 + 2번 재시도
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('백오프 전략', () => {
    test('지수 백오프 (Exponential Backoff)', async () => {
      const delays: number[] = [];
      const mockFn = jest.fn().mockRejectedValue(new Error('실패'));

      await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        onRetry: (_error, _attempt, delay) => {
          delays.push(delay);
        },
      });

      // 100, 200, 400 (지수 증가)
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });

    test('최대 지연 시간 제한', async () => {
      const delays: number[] = [];
      const mockFn = jest.fn().mockRejectedValue(new Error('실패'));

      await client.executeWithRetry(mockFn, {
        maxRetries: 5,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 3000,
        onRetry: (_error, _attempt, delay) => {
          delays.push(delay);
        },
      });

      // 1000, 2000, 3000, 3000, 3000 (최대 3000ms로 제한)
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(3000);
      expect(delays[3]).toBe(3000);
      expect(delays[4]).toBe(3000);
    });
  });

  describe('재시도 조건 판별', () => {
    test('네트워크 에러는 재시도', async () => {
      const networkError = new Error('ECONNREFUSED');
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('복구됨');

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('복구됨');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('타임아웃 에러는 재시도', async () => {
      const timeoutError = new Error('타임아웃: 5000ms 초과');
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce('성공');

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 2,
        initialDelay: 50,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    test('커스텀 shouldRetry 함수 사용', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('CUSTOM_ERROR'));

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 50,
        shouldRetry: (error) => error.message === 'CUSTOM_ERROR',
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(4); // 초기 + 3번 재시도
    });

    test('재시도하지 않는 에러는 즉시 실패', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('VALIDATION_ERROR'));

      const result = await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 50,
        shouldRetry: (error) => !error.message.includes('VALIDATION'),
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // 재시도 없이 즉시 실패
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('타임아웃 처리', () => {
    test('타임아웃 시간 내에 완료되면 성공', async () => {
      const mockFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return '성공';
      });

      const result = await client.executeWithRetry(mockFn, {
        timeout: 500,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('성공');
    });

    test('타임아웃 초과 시 에러', async () => {
      const mockFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return '늦음';
      });

      const result = await client.executeWithRetry(mockFn, {
        timeout: 500,
        maxRetries: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('타임아웃');
    });
  });

  describe('통계 추적', () => {
    test('성공한 호출 통계', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      await client.executeWithRetry(mockFn);
      await client.executeWithRetry(mockFn);

      const stats = client.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(0);
      expect(stats.totalRetries).toBe(0);
    });

    test('재시도 통계', async () => {
      const mockFn1 = jest
        .fn()
        .mockRejectedValueOnce(new Error('실패'))
        .mockResolvedValueOnce('성공');

      const mockFn2 = jest
        .fn()
        .mockRejectedValueOnce(new Error('실패'))
        .mockRejectedValueOnce(new Error('실패'))
        .mockResolvedValueOnce('성공');

      await client.executeWithRetry(mockFn1, { maxRetries: 3, initialDelay: 10 });
      await client.executeWithRetry(mockFn2, { maxRetries: 3, initialDelay: 10 });

      const stats = client.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.totalRetries).toBe(3); // 1 + 2
      expect(stats.averageAttempts).toBeCloseTo(2.5, 1); // (2 + 3) / 2
    });

    test('실패한 호출 통계', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('실패'));

      await client.executeWithRetry(mockFn, { maxRetries: 2, initialDelay: 10 });

      const stats = client.getStats();

      expect(stats.totalCalls).toBe(1);
      expect(stats.successfulCalls).toBe(0);
      expect(stats.failedCalls).toBe(1);
      expect(stats.totalRetries).toBe(2);
    });
  });

  describe('onRetry 콜백', () => {
    test('재시도 시 콜백 호출', async () => {
      const onRetryCalls: Array<{ error: Error; attempt: number; delay: number }> = [];
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('첫 실패'))
        .mockRejectedValueOnce(new Error('두 번째 실패'))
        .mockResolvedValueOnce('성공');

      await client.executeWithRetry(mockFn, {
        maxRetries: 3,
        initialDelay: 100,
        onRetry: (error, attempt, delay) => {
          onRetryCalls.push({ error, attempt, delay });
        },
      });

      expect(onRetryCalls).toHaveLength(2);
      expect(onRetryCalls[0].attempt).toBe(1);
      expect(onRetryCalls[0].error.message).toBe('첫 실패');
      expect(onRetryCalls[1].attempt).toBe(2);
      expect(onRetryCalls[1].error.message).toBe('두 번째 실패');
    });
  });
});

describe('withRetry 헬퍼 함수', () => {
  test('성공 시 데이터 반환', async () => {
    const result = await withRetry(async () => 'success', { maxRetries: 3 });

    expect(result).toBe('success');
  });

  test('실패 시 에러 throw', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('실패');
      }, { maxRetries: 1, initialDelay: 10, shouldRetry: () => false })
    ).rejects.toThrow('실패');
  });

  test('재시도 후 성공', async () => {
    let attempt = 0;
    const result = await withRetry(
      async () => {
        attempt++;
        if (attempt < 2) {
          throw new Error('첫 실패');
        }
        return 'success';
      },
      { maxRetries: 3, initialDelay: 50 }
    );

    expect(result).toBe('success');
    expect(attempt).toBe(2);
  });
});

/**
 * 실제 사용 예시 테스트
 */
describe('실제 사용 시나리오', () => {
  test('외부 API 호출 시뮬레이션', async () => {
    let callCount = 0;

    const simulateApiCall = async (): Promise<{ status: string; data: any }> => {
      callCount++;

      // 첫 2번은 실패 (네트워크 오류)
      if (callCount <= 2) {
        throw new Error('ECONNREFUSED');
      }

      // 3번째 시도에서 성공
      return { status: 'success', data: { id: 123, name: 'Product' } };
    };

    const result = await withRetry(simulateApiCall, {
      maxRetries: 5,
      initialDelay: 100,
      backoffMultiplier: 2,
      maxDelay: 5000,
    });

    expect(result.status).toBe('success');
    expect(result.data.id).toBe(123);
    expect(callCount).toBe(3);
  });

  test('레이트 리미트 에러 재시도', async () => {
    let callCount = 0;

    const simulateRateLimitedApi = async () => {
      callCount++;

      if (callCount === 1) {
        const error: any = new Error('Too Many Requests');
        error.response = { status: 429 };
        throw error;
      }

      return { success: true };
    };

    const result = await withRetry(simulateRateLimitedApi, {
      maxRetries: 3,
      initialDelay: 200,
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });
});
