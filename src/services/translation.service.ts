/**
 * TranslationService - 번역 처리 비즈니스 로직
 *
 * 이 서비스는 상품 정보(제목, 설명, 스펙)를 다국어로 번역하는 핵심 로직을 담당합니다.
 * - 다중 번역 엔진 지원 (Google, DeepL, Papago, GPT)
 * - 번역 품질 평가 및 개선
 * - 배치 번역 및 캐싱
 * - 용어 사전 관리
 *
 * Phase 3.4: 서비스 계층 구현 - T027
 */

import { PrismaClient, ProductStatus } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 번역 엔진 타입
 */
export enum TranslationEngine {
  GOOGLE = 'GOOGLE',
  DEEPL = 'DEEPL',
  PAPAGO = 'PAPAGO',
  GPT = 'GPT',
  MANUAL = 'MANUAL',
}

/**
 * 지원 언어 코드
 */
export enum LanguageCode {
  KO = 'ko', // 한국어
  EN = 'en', // 영어
  ZH = 'zh', // 중국어
  JA = 'ja', // 일본어
  ES = 'es', // 스페인어
  FR = 'fr', // 프랑스어
  DE = 'de', // 독일어
}

/**
 * 번역 요청 입력
 */
export interface TranslateInput {
  text: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  engine?: TranslationEngine;
  options?: TranslateOptions;
}

/**
 * 번역 옵션
 */
export interface TranslateOptions {
  useCache?: boolean;
  useDictionary?: boolean;
  preserveFormatting?: boolean;
  context?: string; // 번역 컨텍스트 (상품 카테고리 등)
}

/**
 * 번역 결과
 */
export interface TranslateResult {
  translatedText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  engine: TranslationEngine;
  qualityScore: number; // 0-100
  metadata: {
    translatedAt: Date;
    charCount: number;
    fromCache: boolean;
    cost?: number; // API 비용
  };
}

/**
 * 상품 번역 입력
 */
export interface TranslateProductInput {
  productId: string;
  targetLang: LanguageCode;
  engine?: TranslationEngine;
  fields?: ('title' | 'description' | 'specifications')[];
}

/**
 * 배치 번역 입력
 */
export interface BatchTranslateInput {
  texts: string[];
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  engine?: TranslationEngine;
}

/**
 * 용어 사전 항목
 */
export interface DictionaryEntry {
  id?: string;
  sourceTerm: string;
  targetTerm: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
  category?: string;
  priority: number; // 높을수록 우선 적용
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 번역 요청 검증 스키마
 */
export const TranslateInputSchema = z.object({
  text: z.string().min(1, '번역할 텍스트는 필수입니다'),
  sourceLang: z.nativeEnum(LanguageCode),
  targetLang: z.nativeEnum(LanguageCode),
  engine: z.nativeEnum(TranslationEngine).optional(),
  options: z.object({
    useCache: z.boolean().optional(),
    useDictionary: z.boolean().optional(),
    preserveFormatting: z.boolean().optional(),
    context: z.string().optional(),
  }).optional(),
});

/**
 * 상품 번역 요청 검증 스키마
 */
export const TranslateProductInputSchema = z.object({
  productId: z.string().min(1, '상품 ID는 필수입니다'),
  targetLang: z.nativeEnum(LanguageCode),
  engine: z.nativeEnum(TranslationEngine).optional(),
  fields: z.array(z.enum(['title', 'description', 'specifications'])).optional(),
});

/**
 * TranslationService 클래스
 */
class TranslationService {
  private axiosInstance: AxiosInstance;
  private translationCache: Map<string, TranslateResult>;
  private dictionary: Map<string, DictionaryEntry[]>;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
    this.translationCache = new Map();
    this.dictionary = new Map();
  }

  /**
   * 단일 텍스트 번역
   */
  async translate(input: TranslateInput): Promise<TranslateResult> {
    // 입력 검증
    const validatedInput = TranslateInputSchema.parse(input);

    // 같은 언어면 바로 반환
    if (validatedInput.sourceLang === validatedInput.targetLang) {
      return {
        translatedText: validatedInput.text,
        sourceLang: validatedInput.sourceLang,
        targetLang: validatedInput.targetLang,
        engine: TranslationEngine.MANUAL,
        qualityScore: 100,
        metadata: {
          translatedAt: new Date(),
          charCount: validatedInput.text.length,
          fromCache: false,
        },
      };
    }

    // 캐시 확인
    const cacheKey = this.getCacheKey(
      validatedInput.text,
      validatedInput.sourceLang,
      validatedInput.targetLang,
      validatedInput.engine || TranslationEngine.GOOGLE
    );

    if (validatedInput.options?.useCache !== false) {
      const cached = this.translationCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            fromCache: true,
          },
        };
      }
    }

    // 번역 엔진 선택
    const engine = validatedInput.engine || this.selectBestEngine(validatedInput);

    // 번역 실행
    let translatedText = '';
    let cost = 0;

    switch (engine) {
      case TranslationEngine.GOOGLE:
        translatedText = await this.translateWithGoogle(
          validatedInput.text,
          validatedInput.sourceLang,
          validatedInput.targetLang
        );
        cost = this.calculateCost(validatedInput.text.length, engine);
        break;

      case TranslationEngine.DEEPL:
        translatedText = await this.translateWithDeepL(
          validatedInput.text,
          validatedInput.sourceLang,
          validatedInput.targetLang
        );
        cost = this.calculateCost(validatedInput.text.length, engine);
        break;

      case TranslationEngine.PAPAGO:
        translatedText = await this.translateWithPapago(
          validatedInput.text,
          validatedInput.sourceLang,
          validatedInput.targetLang
        );
        cost = this.calculateCost(validatedInput.text.length, engine);
        break;

      case TranslationEngine.GPT:
        translatedText = await this.translateWithGPT(
          validatedInput.text,
          validatedInput.sourceLang,
          validatedInput.targetLang,
          validatedInput.options?.context
        );
        cost = this.calculateCost(validatedInput.text.length, engine);
        break;

      default:
        throw new Error(`지원하지 않는 번역 엔진입니다: ${engine}`);
    }

    // 용어 사전 적용
    if (validatedInput.options?.useDictionary !== false) {
      translatedText = await this.applyDictionary(
        translatedText,
        validatedInput.sourceLang,
        validatedInput.targetLang
      );
    }

    // 품질 평가
    const qualityScore = await this.evaluateQuality(
      validatedInput.text,
      translatedText
    );

    const result: TranslateResult = {
      translatedText,
      sourceLang: validatedInput.sourceLang,
      targetLang: validatedInput.targetLang,
      engine,
      qualityScore,
      metadata: {
        translatedAt: new Date(),
        charCount: validatedInput.text.length,
        fromCache: false,
        cost,
      },
    };

    // 캐시 저장
    this.translationCache.set(cacheKey, result);

    return result;
  }

  /**
   * 배치 번역
   */
  async translateBatch(input: BatchTranslateInput): Promise<TranslateResult[]> {
    const results: TranslateResult[] = [];

    for (const text of input.texts) {
      const result = await this.translate({
        text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        engine: input.engine,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 상품 번역
   */
  async translateProduct(input: TranslateProductInput) {
    // 입력 검증
    const validatedInput = TranslateProductInputSchema.parse(input);

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id: validatedInput.productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    const originalData = product.originalData as any;
    const fields = validatedInput.fields || ['title', 'description', 'specifications'];

    // 소스 언어 감지
    const sourceLang = this.detectLanguage(originalData.title);

    // 번역 실행
    const translatedData: any = {};
    const translationResults: TranslateResult[] = [];

    // 제목 번역
    if (fields.includes('title') && originalData.title) {
      const result = await this.translate({
        text: originalData.title,
        sourceLang,
        targetLang: validatedInput.targetLang,
        engine: validatedInput.engine,
        options: {
          useCache: true,
          useDictionary: true,
          context: originalData.category,
        },
      });
      translatedData.title = result.translatedText;
      translationResults.push(result);
    }

    // 설명 번역
    if (fields.includes('description') && originalData.description) {
      const result = await this.translate({
        text: originalData.description,
        sourceLang,
        targetLang: validatedInput.targetLang,
        engine: validatedInput.engine,
        options: {
          useCache: true,
          useDictionary: true,
          context: originalData.category,
        },
      });
      translatedData.description = result.translatedText;
      translationResults.push(result);
    }

    // 스펙 번역
    if (fields.includes('specifications') && originalData.specifications) {
      translatedData.specifications = {};
      for (const [key, value] of Object.entries(originalData.specifications)) {
        if (typeof value === 'string') {
          const result = await this.translate({
            text: value,
            sourceLang,
            targetLang: validatedInput.targetLang,
            engine: validatedInput.engine,
          });
          translatedData.specifications[key] = result.translatedText;
          translationResults.push(result);
        } else {
          translatedData.specifications[key] = value;
        }
      }
    }

    // 평균 품질 점수 계산
    const avgQualityScore =
      translationResults.reduce((sum, r) => sum + r.qualityScore, 0) /
      translationResults.length;

    // 상품 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: validatedInput.productId },
      data: {
        translatedData: {
          ...translatedData,
          translatedAt: new Date(),
          translationEngine: validatedInput.engine || TranslationEngine.GOOGLE,
          qualityScore: avgQualityScore,
        } as any,
        status: ProductStatus.READY,
      },
    });

    return {
      product: updatedProduct,
      translatedData,
      qualityScore: avgQualityScore,
      translationResults,
    };
  }

  /**
   * 여러 상품 번역 (배치)
   */
  async translateProducts(
    productIds: string[],
    targetLang: LanguageCode,
    engine?: TranslationEngine
  ) {
    const results = [];

    for (const productId of productIds) {
      try {
        const result = await this.translateProduct({
          productId,
          targetLang,
          engine,
        });
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
   * 번역 품질 재평가
   */
  async reevaluateTranslation(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('상품을 찾을 수 없습니다');
    }

    const originalData = product.originalData as any;
    const translatedData = product.translatedData as any;

    if (!translatedData) {
      throw new Error('번역 데이터가 없습니다');
    }

    // 제목 품질 평가
    const titleQuality = await this.evaluateQuality(
      originalData.title,
      translatedData.title
    );

    // 설명 품질 평가
    let descQuality = 100;
    if (originalData.description && translatedData.description) {
      descQuality = await this.evaluateQuality(
        originalData.description,
        translatedData.description
      );
    }

    const avgQualityScore = (titleQuality + descQuality) / 2;

    // 업데이트
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        translatedData: {
          ...translatedData,
          qualityScore: avgQualityScore,
        } as any,
      },
    });

    return {
      product: updatedProduct,
      qualityScore: avgQualityScore,
      titleQuality,
      descQuality,
    };
  }

  /**
   * 용어 사전 추가
   */
  async addDictionaryEntry(entry: DictionaryEntry) {
    const key = `${entry.sourceLang}-${entry.targetLang}`;
    const entries = this.dictionary.get(key) || [];
    entries.push({
      ...entry,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // 우선순위 순으로 정렬
    entries.sort((a, b) => b.priority - a.priority);
    this.dictionary.set(key, entries);

    return entry;
  }

  /**
   * 용어 사전 목록 조회
   */
  getDictionaryEntries(sourceLang: LanguageCode, targetLang: LanguageCode) {
    const key = `${sourceLang}-${targetLang}`;
    return this.dictionary.get(key) || [];
  }

  /**
   * 용어 사전 적용
   */
  private async applyDictionary(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ): Promise<string> {
    const entries = this.getDictionaryEntries(sourceLang, targetLang);
    let result = text;

    for (const entry of entries) {
      const regex = new RegExp(entry.sourceTerm, 'gi');
      result = result.replace(regex, entry.targetTerm);
    }

    return result;
  }

  /**
   * Google 번역
   */
  private async translateWithGoogle(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ): Promise<string> {
    // 실제 구현에서는 Google Translate API를 호출
    // 여기서는 시뮬레이션
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      // API 키가 없으면 더미 번역 반환 (개발 환경)
      return `[Google 번역] ${text}`;
    }

    try {
      const response = await this.axiosInstance.post(
        `https://translation.googleapis.com/language/translate/v2`,
        {
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        },
        {
          params: { key: apiKey },
        }
      );

      return response.data.data.translations[0].translatedText;
    } catch (error) {
      throw new Error(`Google 번역 실패: ${error}`);
    }
  }

  /**
   * DeepL 번역
   */
  private async translateWithDeepL(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ): Promise<string> {
    const apiKey = process.env.DEEPL_API_KEY;

    if (!apiKey) {
      return `[DeepL 번역] ${text}`;
    }

    try {
      const response = await this.axiosInstance.post(
        'https://api-free.deepl.com/v2/translate',
        null,
        {
          params: {
            auth_key: apiKey,
            text,
            source_lang: sourceLang.toUpperCase(),
            target_lang: targetLang.toUpperCase(),
          },
        }
      );

      return response.data.translations[0].text;
    } catch (error) {
      throw new Error(`DeepL 번역 실패: ${error}`);
    }
  }

  /**
   * Papago 번역
   */
  private async translateWithPapago(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode
  ): Promise<string> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return `[Papago 번역] ${text}`;
    }

    try {
      const response = await this.axiosInstance.post(
        'https://openapi.naver.com/v1/papago/n2mt',
        {
          source: sourceLang,
          target: targetLang,
          text,
        },
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        }
      );

      return response.data.message.result.translatedText;
    } catch (error) {
      throw new Error(`Papago 번역 실패: ${error}`);
    }
  }

  /**
   * GPT 번역 (ChatGPT API)
   */
  private async translateWithGPT(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode,
    context?: string
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return `[GPT 번역] ${text}`;
    }

    const prompt = context
      ? `Translate the following ${sourceLang} text to ${targetLang}. Context: ${context}\n\nText: ${text}\n\nTranslation:`
      : `Translate the following ${sourceLang} text to ${targetLang}:\n\n${text}`;

    try {
      const response = await this.axiosInstance.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator specializing in e-commerce product descriptions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      throw new Error(`GPT 번역 실패: ${error}`);
    }
  }

  /**
   * 번역 품질 평가
   */
  private async evaluateQuality(
    sourceText: string,
    translatedText: string
  ): Promise<number> {
    // 간단한 휴리스틱 기반 품질 평가
    let score = 100;

    // 길이 비율 확인 (번역된 텍스트가 너무 짧거나 길면 감점)
    const lengthRatio = translatedText.length / sourceText.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      score -= 20;
    }

    // 빈 번역 확인
    if (!translatedText || translatedText.trim().length === 0) {
      score = 0;
    }

    // 원문과 동일 확인 (번역이 안 된 경우)
    if (sourceText === translatedText) {
      score -= 30;
    }

    // 특수 문자만 있는지 확인
    const specialCharOnly = /^[^a-zA-Z0-9가-힣\u4e00-\u9fa5]+$/.test(translatedText);
    if (specialCharOnly) {
      score -= 40;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 언어 감지
   */
  private detectLanguage(text: string): LanguageCode {
    // 간단한 언어 감지 로직
    if (!text) return LanguageCode.EN;

    // 한글 확인
    if (/[가-힣]/.test(text)) {
      return LanguageCode.KO;
    }

    // 중국어 확인
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return LanguageCode.ZH;
    }

    // 일본어 확인
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return LanguageCode.JA;
    }

    // 기본값은 영어
    return LanguageCode.EN;
  }

  /**
   * 최적 번역 엔진 선택
   */
  private selectBestEngine(input: TranslateInput): TranslationEngine {
    // 언어 쌍에 따라 최적 엔진 선택
    if (
      (input.sourceLang === LanguageCode.KO && input.targetLang === LanguageCode.JA) ||
      (input.sourceLang === LanguageCode.JA && input.targetLang === LanguageCode.KO)
    ) {
      return TranslationEngine.PAPAGO;
    }

    if (input.sourceLang === LanguageCode.ZH || input.targetLang === LanguageCode.ZH) {
      return TranslationEngine.GOOGLE;
    }

    // 컨텍스트가 있으면 GPT 사용
    if (input.options?.context) {
      return TranslationEngine.GPT;
    }

    // 기본값은 Google
    return TranslationEngine.GOOGLE;
  }

  /**
   * 비용 계산
   */
  private calculateCost(charCount: number, engine: TranslationEngine): number {
    // 1000자당 비용 (USD)
    const costPer1000: Record<TranslationEngine, number> = {
      [TranslationEngine.GOOGLE]: 0.02,
      [TranslationEngine.DEEPL]: 0.025,
      [TranslationEngine.PAPAGO]: 0.015,
      [TranslationEngine.GPT]: 0.1,
      [TranslationEngine.MANUAL]: 0,
    };

    return (charCount / 1000) * costPer1000[engine];
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(
    text: string,
    sourceLang: LanguageCode,
    targetLang: LanguageCode,
    engine: TranslationEngine
  ): string {
    // 간단한 해시 생성 (실제로는 crypto 모듈 사용 권장)
    const key = `${text}-${sourceLang}-${targetLang}-${engine}`;
    return key;
  }

  /**
   * 캐시 클리어
   */
  clearCache() {
    this.translationCache.clear();
  }

  /**
   * 번역 통계 조회
   */
  async getTranslationStatistics(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.setDate() - days);

    const products = await prisma.product.findMany({
      where: {
        userId,
        translatedData: { not: null },
      },
      select: {
        id: true,
        translatedData: true,
        createdAt: true,
      },
    });

    // 엔진별 통계
    const byEngine: Record<string, number> = {};
    let totalQuality = 0;

    products.forEach((product) => {
      const translatedData = product.translatedData as any;
      if (translatedData) {
        const engine = translatedData.translationEngine || TranslationEngine.GOOGLE;
        byEngine[engine] = (byEngine[engine] || 0) + 1;
        totalQuality += translatedData.qualityScore || 0;
      }
    });

    const avgQuality = products.length > 0 ? totalQuality / products.length : 0;

    return {
      total: products.length,
      period: `${days}일`,
      byEngine,
      averageQuality: avgQuality,
    };
  }
}

// 싱글톤 인스턴스 내보내기
export const translationService = new TranslationService();
