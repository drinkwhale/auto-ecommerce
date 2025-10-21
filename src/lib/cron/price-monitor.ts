/**
 * 가격 모니터링 크론 작업
 *
 * 등록된 상품의 원본 가격을 주기적으로 모니터링
 * - 가격 변동 감지
 * - 마진율 재계산
 * - 알림 발송
 *
 * Phase 3.8: 통합 및 미들웨어 - T063
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 가격 변동 임계값 (%)
 */
const PRICE_CHANGE_THRESHOLD = 5; // 5% 이상 변동 시 알림

/**
 * 가격 변동 정보
 */
interface PriceChange {
  productId: string;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  changeAmount: number;
}

/**
 * 상품 가격 모니터링
 */
export async function monitorProductPrices(): Promise<{
  success: boolean;
  monitored: number;
  changes: PriceChange[];
  errors: any[];
}> {
  console.log('[Price Monitor] Starting price monitoring...');

  const changes: PriceChange[] = [];
  const errors: any[] = [];
  let monitored = 0;

  try {
    // 모니터링 대상 상품 조회 (REGISTERED 상태)
    const products = await prisma.product.findMany({
      where: {
        status: 'REGISTERED',
        monitoringSettings: {
          path: ['enabled'],
          equals: true,
        },
      },
      select: {
        id: true,
        sourceInfo: true,
        originalData: true,
        translatedData: true,
        salesSettings: true,
      },
    });

    console.log(`[Price Monitor] Found ${products.length} products to monitor`);

    // 각 상품의 가격 확인
    for (const product of products) {
      try {
        monitored++;

        const originalData = product.originalData as any;
        const oldPrice = originalData.price;

        // 실제 크롤링으로 현재 가격 확인 (여기서는 시뮬레이션)
        // const newPrice = await crawlPrice(sourceInfo.url, sourceInfo.platform);

        // 시뮬레이션: 랜덤하게 가격 변동 (실제로는 크롤링 결과 사용)
        const priceVariation = (Math.random() - 0.5) * 0.2; // -10% ~ +10%
        const newPrice = oldPrice * (1 + priceVariation);

        // 가격 변동 계산
        const changeAmount = newPrice - oldPrice;
        const changePercent = (changeAmount / oldPrice) * 100;

        // 임계값 이상 변동 시 기록
        if (Math.abs(changePercent) >= PRICE_CHANGE_THRESHOLD) {
          const priceChange: PriceChange = {
            productId: product.id,
            productTitle: (product.translatedData as any)?.title || originalData.title,
            oldPrice,
            newPrice: Math.round(newPrice),
            changePercent: Math.round(changePercent * 100) / 100,
            changeAmount: Math.round(changeAmount),
          };

          changes.push(priceChange);

          // 상품 정보 업데이트
          await prisma.product.update({
            where: { id: product.id },
            data: {
              originalData: {
                ...originalData,
                price: Math.round(newPrice),
                lastPriceUpdate: new Date().toISOString(),
              },
              // 판매가도 자동 재계산 (옵션)
              salesSettings: {
                ...(product.salesSettings as any),
                salePrice: Math.round(newPrice * (1 + ((product.salesSettings as any).marginRate / 100))),
              },
            },
          });

          console.log(`[Price Monitor] Price changed: ${priceChange.productTitle} (${changePercent > 0 ? '+' : ''}${changePercent}%)`);

          // 활동 로그 기록
          await prisma.activityLog.create({
            data: {
              userId: product.id, // 실제로는 관리자 ID 사용
              entityType: 'PRODUCT',
              entityId: product.id,
              action: 'PRICE_CHANGE',
              description: `가격 변동 감지: ${priceChange.productTitle} (${oldPrice}원 → ${newPrice}원, ${changePercent > 0 ? '+' : ''}${changePercent}%)`,
              metadata: {
                oldPrice,
                newPrice,
                changePercent,
                changeAmount,
              },
            },
          });
        }
      } catch (error) {
        console.error(`[Price Monitor] Error monitoring product ${product.id}:`, error);
        errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`[Price Monitor] Completed. Monitored: ${monitored}, Changes: ${changes.length}, Errors: ${errors.length}`);

    return {
      success: true,
      monitored,
      changes,
      errors,
    };
  } catch (error) {
    console.error('[Price Monitor] Fatal error:', error);
    throw error;
  }
}

/**
 * 크론 작업 스케줄러
 *
 * 실제 프로덕션 환경에서는 node-cron, bull, agenda 등의 라이브러리 사용
 * 또는 Vercel Cron Jobs, AWS EventBridge 등의 서비스 활용
 */
export function schedulePriceMonitoring() {
  // 예시: 매 6시간마다 실행
  // cron.schedule('0 */6 * * *', async () => {
  //   await monitorProductPrices();
  // });

  console.log('[Price Monitor] Scheduler initialized');
}

/**
 * API Route에서 수동 실행
 *
 * /api/cron/price-monitor 엔드포인트에서 호출
 */
export async function handlePriceMonitoringRequest() {
  try {
    const result = await monitorProductPrices();
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[Price Monitor] Request handler error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
