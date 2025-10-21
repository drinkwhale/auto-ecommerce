/**
 * Marketplace Adapters Index
 *
 * 마켓플레이스 어댑터를 한 곳에서 관리
 */

export * from './types';
export * from './coupang.adapter';
export * from './elevenst.adapter';

import { OpenMarketPlatform } from '@prisma/client';
import { IMarketplaceAdapter } from './types';
import { createCoupangAdapter } from './coupang.adapter';
import { createElevenstAdapter } from './elevenst.adapter';

/**
 * 마켓플레이스 어댑터 팩토리
 */
export class MarketplaceAdapterFactory {
  private static adapters: Map<OpenMarketPlatform, IMarketplaceAdapter> = new Map();

  /**
   * 플랫폼별 어댑터 생성
   */
  static getAdapter(platform: OpenMarketPlatform, useMock: boolean = true): IMarketplaceAdapter {
    // 이미 생성된 어댑터가 있으면 재사용
    if (this.adapters.has(platform)) {
      return this.adapters.get(platform)!;
    }

    // 플랫폼별 어댑터 생성
    let adapter: IMarketplaceAdapter;

    switch (platform) {
      case OpenMarketPlatform.COUPANG:
        adapter = createCoupangAdapter(useMock);
        break;

      case OpenMarketPlatform.STREET11:
        adapter = createElevenstAdapter(useMock);
        break;

      case OpenMarketPlatform.GMARKET:
      case OpenMarketPlatform.AUCTION:
      case OpenMarketPlatform.NAVER:
        throw new Error(`${platform} 어댑터는 아직 구현되지 않았습니다`);

      default:
        throw new Error(`지원하지 않는 플랫폼입니다: ${platform}`);
    }

    // 캐싱
    this.adapters.set(platform, adapter);

    return adapter;
  }

  /**
   * 어댑터 캐시 초기화
   */
  static clearCache(): void {
    this.adapters.clear();
  }

  /**
   * 모든 지원 플랫폼 목록
   */
  static getSupportedPlatforms(): OpenMarketPlatform[] {
    return [OpenMarketPlatform.COUPANG, OpenMarketPlatform.STREET11];
  }
}
