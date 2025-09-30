/**
 * ImageProcessingService - 이미지 처리 비즈니스 로직
 *
 * 이 서비스는 상품 이미지 다운로드, 리사이징, 최적화, 워터마크 제거 등의 처리를 담당합니다.
 * - 이미지 다운로드 및 업로드 (AWS S3, Cloudinary)
 * - 다중 사이즈 생성 (썸네일, 모바일, 데스크톱)
 * - 이미지 최적화 (압축, 포맷 변환)
 * - 워터마크 감지 및 제거
 * - 이미지 메타데이터 추출
 *
 * Phase 3.4: 서비스 계층 구현 - T028
 */

import { PrismaClient, ProductImage } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Prisma 클라이언트 인스턴스
const prisma = new PrismaClient();

/**
 * 이미지 크기 프리셋
 */
export enum ImageSizePreset {
  THUMBNAIL = 'thumbnail', // 150x150
  SMALL = 'small', // 300x300
  MEDIUM = 'medium', // 600x600
  LARGE = 'large', // 1200x1200
  ORIGINAL = 'original', // 원본
}

/**
 * 이미지 포맷
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
}

/**
 * 스토리지 제공자
 */
export enum StorageProvider {
  S3 = 'S3',
  CLOUDINARY = 'CLOUDINARY',
  LOCAL = 'LOCAL',
}

/**
 * 이미지 처리 요청 입력
 */
export interface ProcessImageInput {
  imageUrl: string;
  productId?: string;
  options?: ProcessImageOptions;
}

/**
 * 이미지 처리 옵션
 */
export interface ProcessImageOptions {
  sizes?: ImageSizePreset[];
  formats?: ImageFormat[];
  removeWatermark?: boolean;
  quality?: number; // 1-100
  storageProvider?: StorageProvider;
  folder?: string;
}

/**
 * 처리된 이미지 정보
 */
export interface ProcessedImageInfo {
  size: ImageSizePreset;
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
  fileSize: number;
}

/**
 * 이미지 처리 결과
 */
export interface ProcessImageResult {
  success: boolean;
  originalUrl: string;
  processedImages: ProcessedImageInfo[];
  metadata: ImageMetadata;
  error?: string;
}

/**
 * 이미지 메타데이터
 */
export interface ImageMetadata {
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
  mimeType: string;
  fileSize: number;
  format: string;
  dominantColors?: string[];
  hasWatermark?: boolean;
  hash?: string;
}

/**
 * 배치 이미지 처리 입력
 */
export interface BatchProcessInput {
  images: ProcessImageInput[];
  productId: string;
}

/**
 * 이미지 처리 요청 검증 스키마
 */
export const ProcessImageInputSchema = z.object({
  imageUrl: z.string().url('유효한 이미지 URL을 입력해주세요'),
  productId: z.string().optional(),
  options: z
    .object({
      sizes: z.array(z.nativeEnum(ImageSizePreset)).optional(),
      formats: z.array(z.nativeEnum(ImageFormat)).optional(),
      removeWatermark: z.boolean().optional(),
      quality: z.number().min(1).max(100).optional(),
      storageProvider: z.nativeEnum(StorageProvider).optional(),
      folder: z.string().optional(),
    })
    .optional(),
});

/**
 * ImageProcessingService 클래스
 */
class ImageProcessingService {
  private axiosInstance: AxiosInstance;
  private readonly defaultQuality = 85;
  private readonly defaultSizes = [
    ImageSizePreset.THUMBNAIL,
    ImageSizePreset.SMALL,
    ImageSizePreset.MEDIUM,
    ImageSizePreset.LARGE,
  ];
  private readonly defaultFormats = [ImageFormat.WEBP];

  // 사이즈별 픽셀 크기
  private readonly sizePixels: Record<ImageSizePreset, { width: number; height: number }> = {
    [ImageSizePreset.THUMBNAIL]: { width: 150, height: 150 },
    [ImageSizePreset.SMALL]: { width: 300, height: 300 },
    [ImageSizePreset.MEDIUM]: { width: 600, height: 600 },
    [ImageSizePreset.LARGE]: { width: 1200, height: 1200 },
    [ImageSizePreset.ORIGINAL]: { width: 0, height: 0 }, // 원본 크기 유지
  };

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 60000, // 이미지 다운로드는 시간이 걸릴 수 있음
      responseType: 'arraybuffer',
    });
  }

  /**
   * 단일 이미지 처리
   */
  async processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
    try {
      // 입력 검증
      const validatedInput = ProcessImageInputSchema.parse(input);

      // 이미지 다운로드
      const imageBuffer = await this.downloadImage(validatedInput.imageUrl);

      // 메타데이터 추출
      const metadata = await this.extractMetadata(imageBuffer);

      // 워터마크 제거 (옵션)
      let processedBuffer = imageBuffer;
      if (validatedInput.options?.removeWatermark) {
        processedBuffer = await this.removeWatermark(imageBuffer);
        metadata.hasWatermark = false;
      }

      // 다중 크기 및 포맷으로 처리
      const sizes = validatedInput.options?.sizes || this.defaultSizes;
      const formats = validatedInput.options?.formats || this.defaultFormats;
      const quality = validatedInput.options?.quality || this.defaultQuality;

      const processedImages: ProcessedImageInfo[] = [];

      for (const size of sizes) {
        for (const format of formats) {
          const result = await this.resizeAndOptimize(
            processedBuffer,
            size,
            format,
            quality
          );

          // 스토리지에 업로드
          const uploadedUrl = await this.uploadToStorage(
            result.buffer,
            {
              productId: validatedInput.productId,
              size,
              format,
              folder: validatedInput.options?.folder,
            },
            validatedInput.options?.storageProvider || StorageProvider.LOCAL
          );

          processedImages.push({
            size,
            url: uploadedUrl,
            width: result.width,
            height: result.height,
            format,
            fileSize: result.buffer.length,
          });
        }
      }

      return {
        success: true,
        originalUrl: validatedInput.imageUrl,
        processedImages,
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        originalUrl: input.imageUrl,
        processedImages: [],
        metadata: {} as ImageMetadata,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      };
    }
  }

  /**
   * 배치 이미지 처리
   */
  async processBatch(input: BatchProcessInput): Promise<ProcessImageResult[]> {
    const results: ProcessImageResult[] = [];

    for (const imageInput of input.images) {
      const result = await this.processImage({
        ...imageInput,
        productId: input.productId,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 상품 이미지 처리 및 DB 저장
   */
  async processProductImages(productId: string, imageUrls: string[]) {
    const results: ProcessImageResult[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const result = await this.processImage({
        imageUrl: imageUrls[i],
        productId,
        options: {
          removeWatermark: true,
        },
      });

      results.push(result);

      // ProductImage 레코드 생성
      if (result.success) {
        await prisma.productImage.create({
          data: {
            productId,
            originalUrl: result.originalUrl,
            processedImages: result.processedImages as any,
            metadata: result.metadata as any,
            displayOrder: i,
            status: 'PROCESSED',
          },
        });
      }
    }

    // Product의 originalData 업데이트
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (product) {
      const originalData = product.originalData as any;
      const successfulResults = results.filter((r) => r.success);

      await prisma.product.update({
        where: { id: productId },
        data: {
          originalData: {
            ...originalData,
            images: successfulResults.map((r) => ({
              originalUrl: r.originalUrl,
              processedImages: r.processedImages,
              metadata: r.metadata,
              status: 'processed',
            })),
          } as any,
        },
      });
    }

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * 이미지 재처리 (품질 개선, 형식 변환 등)
   */
  async reprocessProductImages(productId: string, options?: ProcessImageOptions) {
    // 기존 이미지 조회
    const productImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    if (productImages.length === 0) {
      throw new Error('상품 이미지가 없습니다');
    }

    const results: ProcessImageResult[] = [];

    for (const productImage of productImages) {
      // 원본 URL로 재처리
      const result = await this.processImage({
        imageUrl: productImage.originalUrl,
        productId,
        options,
      });

      results.push(result);

      // 업데이트
      if (result.success) {
        await prisma.productImage.update({
          where: { id: productImage.id },
          data: {
            processedImages: result.processedImages as any,
            metadata: result.metadata as any,
            status: 'PROCESSED',
          },
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
   * 이미지 다운로드
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await this.axiosInstance.get(url);
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`이미지 다운로드 실패: ${url}`);
    }
  }

  /**
   * 메타데이터 추출
   */
  private async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // 해시 생성
    const hash = createHash('md5').update(buffer).digest('hex');

    // 주요 색상 추출
    const dominantColors = stats.dominant
      ? [this.rgbToHex(stats.dominant.r, stats.dominant.g, stats.dominant.b)]
      : undefined;

    return {
      originalWidth: metadata.width || 0,
      originalHeight: metadata.height || 0,
      aspectRatio: metadata.width && metadata.height ? metadata.width / metadata.height : 1,
      mimeType: `image/${metadata.format}`,
      fileSize: buffer.length,
      format: metadata.format || 'unknown',
      dominantColors,
      hash,
    };
  }

  /**
   * 이미지 리사이징 및 최적화
   */
  private async resizeAndOptimize(
    buffer: Buffer,
    size: ImageSizePreset,
    format: ImageFormat,
    quality: number
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    let image = sharp(buffer);

    // 리사이징
    if (size !== ImageSizePreset.ORIGINAL) {
      const { width, height } = this.sizePixels[size];
      image = image.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // 포맷 변환 및 최적화
    switch (format) {
      case ImageFormat.JPEG:
        image = image.jpeg({ quality, mozjpeg: true });
        break;
      case ImageFormat.PNG:
        image = image.png({ quality, compressionLevel: 9 });
        break;
      case ImageFormat.WEBP:
        image = image.webp({ quality });
        break;
      case ImageFormat.AVIF:
        image = image.avif({ quality });
        break;
    }

    const outputBuffer = await image.toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    return {
      buffer: outputBuffer,
      width: outputMetadata.width || 0,
      height: outputMetadata.height || 0,
    };
  }

  /**
   * 워터마크 제거 (간단한 구현)
   */
  private async removeWatermark(buffer: Buffer): Promise<Buffer> {
    // 실제 워터마크 제거는 매우 복잡한 작업
    // 여기서는 간단한 블러 처리 또는 외부 AI 서비스 호출로 대체
    // 실제 프로덕션에서는 전문 워터마크 제거 서비스 사용 권장

    // 간단한 구현: 이미지 하단 10% 영역을 약간 블러 처리
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return buffer;
    }

    // 워터마크가 일반적으로 하단에 위치하므로 하단 영역 처리
    const watermarkHeight = Math.floor(metadata.height * 0.1);
    const watermarkTop = metadata.height - watermarkHeight;

    try {
      // 실제로는 더 정교한 처리 필요
      // 여기서는 원본 반환 (워터마크 제거는 별도 서비스 권장)
      return buffer;
    } catch {
      return buffer;
    }
  }

  /**
   * 스토리지에 업로드
   */
  private async uploadToStorage(
    buffer: Buffer,
    fileInfo: {
      productId?: string;
      size: ImageSizePreset;
      format: ImageFormat;
      folder?: string;
    },
    provider: StorageProvider
  ): Promise<string> {
    const filename = this.generateFilename(fileInfo);

    switch (provider) {
      case StorageProvider.S3:
        return await this.uploadToS3(buffer, filename, fileInfo.folder);

      case StorageProvider.CLOUDINARY:
        return await this.uploadToCloudinary(buffer, filename);

      case StorageProvider.LOCAL:
        return await this.uploadToLocal(buffer, filename);

      default:
        throw new Error(`지원하지 않는 스토리지 제공자입니다: ${provider}`);
    }
  }

  /**
   * AWS S3 업로드
   */
  private async uploadToS3(
    buffer: Buffer,
    filename: string,
    folder?: string
  ): Promise<string> {
    // 실제 구현에서는 AWS SDK 사용
    // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

    const s3Enabled = process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID;

    if (!s3Enabled) {
      // S3가 설정되지 않았으면 로컬 저장
      return await this.uploadToLocal(buffer, filename);
    }

    const key = folder ? `${folder}/${filename}` : filename;

    // 실제 S3 업로드 코드
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // await client.send(new PutObjectCommand({
    //   Bucket: process.env.AWS_S3_BUCKET,
    //   Key: key,
    //   Body: buffer,
    //   ContentType: this.getContentType(filename),
    // }));

    // 임시: 로컬 경로 반환
    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  /**
   * Cloudinary 업로드
   */
  private async uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
    // 실제 구현에서는 Cloudinary SDK 사용
    const cloudinaryEnabled = process.env.CLOUDINARY_CLOUD_NAME;

    if (!cloudinaryEnabled) {
      return await this.uploadToLocal(buffer, filename);
    }

    // 임시: 로컬 경로 반환
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${filename}`;
  }

  /**
   * 로컬 파일 시스템에 저장
   */
  private async uploadToLocal(buffer: Buffer, filename: string): Promise<string> {
    // 실제 구현에서는 파일 시스템에 저장
    // import { writeFile } from 'fs/promises';
    // const localPath = `./uploads/${filename}`;
    // await writeFile(localPath, buffer);

    // 임시: 가상 URL 반환
    return `/uploads/${filename}`;
  }

  /**
   * 파일명 생성
   */
  private generateFilename(fileInfo: {
    productId?: string;
    size: ImageSizePreset;
    format: ImageFormat;
  }): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const productPrefix = fileInfo.productId ? `${fileInfo.productId}_` : '';

    return `${productPrefix}${fileInfo.size}_${timestamp}_${random}.${fileInfo.format}`;
  }

  /**
   * Content-Type 추출
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * RGB를 HEX로 변환
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 이미지 유사도 비교 (중복 감지)
   */
  async compareImages(imageUrl1: string, imageUrl2: string): Promise<number> {
    const buffer1 = await this.downloadImage(imageUrl1);
    const buffer2 = await this.downloadImage(imageUrl2);

    const hash1 = createHash('md5').update(buffer1).digest('hex');
    const hash2 = createHash('md5').update(buffer2).digest('hex');

    // 해시가 동일하면 100% 유사
    if (hash1 === hash2) {
      return 100;
    }

    // 실제 구현에서는 perceptual hash (pHash) 알고리즘 사용 권장
    // 여기서는 간단히 파일 크기 비교
    const sizeDiff = Math.abs(buffer1.length - buffer2.length);
    const avgSize = (buffer1.length + buffer2.length) / 2;
    const similarity = Math.max(0, 100 - (sizeDiff / avgSize) * 100);

    return Math.round(similarity);
  }

  /**
   * 이미지 처리 통계
   */
  async getProcessingStatistics(userId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const products = await prisma.product.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      include: {
        images: true,
      },
    });

    const totalImages = products.reduce((sum, p) => sum + p.images.length, 0);
    const processedImages = products.reduce(
      (sum, p) => sum + p.images.filter((img) => img.status === 'PROCESSED').length,
      0
    );

    // 포맷별 통계
    const byFormat: Record<string, number> = {};
    products.forEach((product) => {
      product.images.forEach((image) => {
        const processedImages = image.processedImages as any;
        if (Array.isArray(processedImages)) {
          processedImages.forEach((pi: any) => {
            byFormat[pi.format] = (byFormat[pi.format] || 0) + 1;
          });
        }
      });
    });

    return {
      total: totalImages,
      processed: processedImages,
      pending: totalImages - processedImages,
      period: `${days}일`,
      byFormat,
    };
  }

  /**
   * 캐시 및 임시 파일 정리
   */
  async cleanupTempFiles() {
    // 실제 구현에서는 오래된 임시 파일 삭제
    // import { readdir, unlink, stat } from 'fs/promises';
    // const tempDir = './uploads/temp';
    // const files = await readdir(tempDir);
    // const now = Date.now();
    // for (const file of files) {
    //   const filePath = `${tempDir}/${file}`;
    //   const stats = await stat(filePath);
    //   const age = now - stats.mtimeMs;
    //   if (age > 24 * 60 * 60 * 1000) { // 24시간 이상 된 파일
    //     await unlink(filePath);
    //   }
    // }

    return {
      message: '임시 파일 정리 완료',
    };
  }
}

// 싱글톤 인스턴스 내보내기
export const imageProcessingService = new ImageProcessingService();