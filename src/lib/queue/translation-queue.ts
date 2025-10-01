/**
 * 자동 번역 큐 처리기
 *
 * 상품 정보 자동 번역 큐 관리
 * - 번역 작업 큐잉
 * - 백그라운드 처리
 * - 재시도 로직
 *
 * Phase 3.8: 통합 및 미들웨어 - T064
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 번역 작업 상태
 */
export enum TranslationJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * 번역 작업 인터페이스
 */
export interface TranslationJob {
  id: string;
  productId: string;
  sourceLanguage: string;
  targetLanguage: string;
  content: {
    title: string;
    description?: string;
    specifications?: Record<string, any>;
  };
  status: TranslationJobStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

/**
 * 간단한 메모리 기반 큐 (프로덕션에서는 Redis, Bull 등 사용)
 */
class TranslationQueue {
  private queue: TranslationJob[] = [];
  private processing = false;

  /**
   * 번역 작업 추가
   */
  async addJob(productId: string, content: { title: string; description?: string }): Promise<string> {
    const job: TranslationJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId,
      sourceLanguage: 'zh', // 중국어 (타오바오 기본)
      targetLanguage: 'ko', // 한국어
      content,
      status: TranslationJobStatus.PENDING,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };

    this.queue.push(job);

    console.log(`[Translation Queue] Job added: ${job.id} for product ${productId}`);

    // 큐 처리 시작 (이미 처리 중이 아니면)
    if (!this.processing) {
      this.processQueue();
    }

    return job.id;
  }

  /**
   * 큐 처리
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    console.log(`[Translation Queue] Processing queue (${this.queue.length} jobs)`);

    while (this.queue.length > 0) {
      const job = this.queue.shift();

      if (!job) {
        continue;
      }

      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`[Translation Queue] Error processing job ${job.id}:`, error);
      }
    }

    this.processing = false;

    console.log('[Translation Queue] Queue processing completed');
  }

  /**
   * 개별 작업 처리
   */
  private async processJob(job: TranslationJob) {
    console.log(`[Translation Queue] Processing job ${job.id}`);

    job.status = TranslationJobStatus.PROCESSING;

    try {
      // 실제 번역 API 호출 (여기서는 시뮬레이션)
      const translated = await this.translateContent(job.content);

      // 상품 업데이트
      await prisma.product.update({
        where: { id: job.productId },
        data: {
          translatedData: translated,
          status: 'READY', // 번역 완료 후 READY 상태로 변경
        },
      });

      job.status = TranslationJobStatus.COMPLETED;
      job.processedAt = new Date();

      console.log(`[Translation Queue] Job ${job.id} completed successfully`);

      // 활동 로그 기록
      await prisma.activityLog.create({
        data: {
          userId: job.productId, // 실제로는 사용자 ID 사용
          entityType: 'PRODUCT',
          entityId: job.productId,
          action: 'TRANSLATION_COMPLETED',
          description: `자동 번역 완료: ${translated.title}`,
          metadata: {
            jobId: job.id,
            sourceLanguage: job.sourceLanguage,
            targetLanguage: job.targetLanguage,
          },
        },
      });
    } catch (error) {
      console.error(`[Translation Queue] Job ${job.id} failed:`, error);

      job.retryCount++;
      job.error = error instanceof Error ? error.message : 'Unknown error';

      // 재시도 가능 여부 확인
      if (job.retryCount < job.maxRetries) {
        console.log(`[Translation Queue] Retrying job ${job.id} (attempt ${job.retryCount + 1}/${job.maxRetries})`);

        // 재시도 딜레이 (exponential backoff)
        const delay = Math.min(1000 * 2 ** job.retryCount, 30000);
        await new Promise(resolve => setTimeout(resolve, delay));

        // 큐에 다시 추가
        this.queue.push(job);
      } else {
        job.status = TranslationJobStatus.FAILED;

        // 상품 상태를 ERROR로 변경
        await prisma.product.update({
          where: { id: job.productId },
          data: {
            status: 'ERROR',
          },
        });

        console.error(`[Translation Queue] Job ${job.id} failed permanently after ${job.maxRetries} retries`);
      }
    }
  }

  /**
   * 번역 로직 (실제로는 외부 API 호출)
   */
  private async translateContent(content: { title: string; description?: string }): Promise<any> {
    // 시뮬레이션: 실제로는 Google Translate API, Papago API 등 사용
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연

    return {
      title: `[번역됨] ${content.title}`,
      description: content.description ? `[번역됨] ${content.description}` : undefined,
      translatedAt: new Date().toISOString(),
      translationProvider: 'simulation',
    };
  }

  /**
   * 큐 상태 조회
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      jobs: this.queue.map(job => ({
        id: job.id,
        productId: job.productId,
        status: job.status,
        retryCount: job.retryCount,
      })),
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const translationQueue = new TranslationQueue();

/**
 * 상품 번역 요청
 */
export async function requestTranslation(
  productId: string,
  content: { title: string; description?: string }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const jobId = await translationQueue.addJob(productId, content);

    return {
      success: true,
      jobId,
    };
  } catch (error) {
    console.error('[Translation Queue] Error requesting translation:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 큐 상태 조회 API
 */
export function getQueueStatus() {
  return translationQueue.getStatus();
}

/**
 * 대량 번역 처리
 */
export async function batchTranslate(productIds: string[]): Promise<{
  success: boolean;
  jobIds: string[];
  errors: any[];
}> {
  const jobIds: string[] = [];
  const errors: any[] = [];

  for (const productId of productIds) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          originalData: true,
        },
      });

      if (!product) {
        errors.push({ productId, error: 'Product not found' });
        continue;
      }

      const originalData = product.originalData as any;
      const jobId = await translationQueue.addJob(productId, {
        title: originalData.title,
        description: originalData.description,
      });

      jobIds.push(jobId);
    } catch (error) {
      errors.push({
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    success: errors.length === 0,
    jobIds,
    errors,
  };
}
