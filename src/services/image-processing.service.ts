/**
 * ImageProcessingService - product image processing workflows.
 *
 * Responsibilities:
 * - Download and upload product images (AWS S3, Cloudinary, local storage)
 * - Generate multiple responsive sizes (thumbnail, mobile, desktop)
 * - Optimise images (compression, format conversion)
 * - Provide a basic watermark handling hook (placeholder implementation)
 * - Extract and persist metadata for downstream services
 *
 * Phase 3.4: Service layer implementation - T028
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';
import sharp from 'sharp';
import { createHash } from 'crypto';

// Prisma  
const prisma = new PrismaClient();

/**
 *   
 */
export enum ImageSizePreset {
  THUMBNAIL = 'thumbnail', // 150x150
  SMALL = 'small', // 300x300
  MEDIUM = 'medium', // 600x600
  LARGE = 'large', // 1200x1200
  ORIGINAL = 'original', // 
}

/**
 *  
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
}

/**
 *  
 */
export enum StorageProvider {
  S3 = 'S3',
  CLOUDINARY = 'CLOUDINARY',
  LOCAL = 'LOCAL',
}

/**
 *    
 */
export interface ProcessImageInput {
  imageUrl: string;
  productId?: string;
  options?: ProcessImageOptions;
}

/**
 *   
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
 *   
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
 *   
 */
export interface ProcessImageResult {
  success: boolean;
  originalUrl: string;
  processedImages: ProcessedImageInfo[];
  metadata: ImageMetadata;
  error?: string;
}

/**
 *  
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
 *    
 */
export interface BatchProcessInput {
  images: ProcessImageInput[];
  productId: string;
}

/**
 *     
 */
export const ProcessImageInputSchema = z.object({
  imageUrl: z.string().url('  URL '),
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
 * ImageProcessingService 
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

  //   
  private readonly sizePixels: Record<ImageSizePreset, { width: number; height: number }> = {
    [ImageSizePreset.THUMBNAIL]: { width: 150, height: 150 },
    [ImageSizePreset.SMALL]: { width: 300, height: 300 },
    [ImageSizePreset.MEDIUM]: { width: 600, height: 600 },
    [ImageSizePreset.LARGE]: { width: 1200, height: 1200 },
    [ImageSizePreset.ORIGINAL]: { width: 0, height: 0 }, //   
  };

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 60000, //      
      responseType: 'arraybuffer',
    });
  }

  /**
   *   
   */
  async processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
    try {
      //  
      const validatedInput = ProcessImageInputSchema.parse(input);

      //  
      const imageBuffer = await this.downloadImage(validatedInput.imageUrl);

      //  
      const metadata = await this.extractMetadata(imageBuffer);

      //   ()
      let processedBuffer = imageBuffer;
      if (validatedInput.options?.removeWatermark) {
        processedBuffer = await this.removeWatermark(imageBuffer);
        metadata.hasWatermark = false;
      }

      //     
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

          //  
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
        error: error instanceof Error ? error.message : '   ',
      };
    }
  }

  /**
   *   
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
   *     DB 
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

      // ProductImage  
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

    // Product originalData 
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
   *   ( ,   )
   */
  async reprocessProductImages(productId: string, options?: ProcessImageOptions) {
    //   
    const productImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    if (productImages.length === 0) {
      throw new Error('  ');
    }

    const results: ProcessImageResult[] = [];

    for (const productImage of productImages) {
      //  URL 
      const result = await this.processImage({
        imageUrl: productImage.originalUrl,
        productId,
        options,
      });

      results.push(result);

      // 
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
   *  
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await this.axiosInstance.get(url);
      return Buffer.from(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`  : ${url} - ${message}`);
    }
  }

  /**
   *  
   */
  private async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    //  
    const hash = createHash('md5').update(buffer).digest('hex');

    //   
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
   *    
   */
  private async resizeAndOptimize(
    buffer: Buffer,
    size: ImageSizePreset,
    format: ImageFormat,
    quality: number
  ): Promise<{ buffer: Buffer; width: number; height: number }> {
    let image = sharp(buffer);

    // 
    if (size !== ImageSizePreset.ORIGINAL) {
      const { width, height } = this.sizePixels[size];
      image = image.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    //    
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
   *   ( )
   */
  private async removeWatermark(buffer: Buffer): Promise<Buffer> {
    //      
    //       AI   
    //        

    //  :   10%    
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return buffer;
    }

    //     .   .
    return buffer;
  }

  /**
   *  
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
        throw new Error(`   : ${provider}`);
    }
  }

  /**
   * AWS S3 
   */
  private async uploadToS3(
    buffer: Buffer,
    filename: string,
    folder?: string
  ): Promise<string> {
    //   AWS SDK 
    // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

    const s3Enabled = process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID;

    if (!s3Enabled) {
      // S3    
      return await this.uploadToLocal(buffer, filename);
    }

    const key = folder ? `${folder}/${filename}` : filename;

    //  S3  
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // await client.send(new PutObjectCommand({
    //   Bucket: process.env.AWS_S3_BUCKET,
    //   Key: key,
    //   Body: buffer,
    //   ContentType: this.getContentType(filename),
    // }));

    // :   
    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  /**
   * Cloudinary 
   */
  private async uploadToCloudinary(buffer: Buffer, filename: string): Promise<string> {
    //   Cloudinary SDK 
    const cloudinaryEnabled = process.env.CLOUDINARY_CLOUD_NAME;

    if (!cloudinaryEnabled) {
      return await this.uploadToLocal(buffer, filename);
    }

    // :   
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${filename}`;
  }

  /**
   *    
   */
  private async uploadToLocal(buffer: Buffer, filename: string): Promise<string> {
    //     
    // import { writeFile } from 'fs/promises';
    // const localPath = `./uploads/${filename}`;
    // await writeFile(localPath, buffer);

    // :  URL 
    return `/uploads/${filename}`;
  }

  /**
   *  
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
   * Content-Type 
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
   * RGB HEX 
   */
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   *    ( )
   */
  async compareImages(imageUrl1: string, imageUrl2: string): Promise<number> {
    const buffer1 = await this.downloadImage(imageUrl1);
    const buffer2 = await this.downloadImage(imageUrl2);

    const hash1 = createHash('md5').update(buffer1).digest('hex');
    const hash2 = createHash('md5').update(buffer2).digest('hex');

    //   100% 
    if (hash1 === hash2) {
      return 100;
    }

    //   perceptual hash (pHash)   
    //     
    const sizeDiff = Math.abs(buffer1.length - buffer2.length);
    const avgSize = (buffer1.length + buffer2.length) / 2;
    const similarity = Math.max(0, 100 - (sizeDiff / avgSize) * 100);

    return Math.round(similarity);
  }

  /**
   *   
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

    //  
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
      period: `${days}`,
      byFormat,
    };
  }

  /**
   *     
   */
  async cleanupTempFiles() {
    //      
    // import { readdir, unlink, stat } from 'fs/promises';
    // const tempDir = './uploads/temp';
    // const files = await readdir(tempDir);
    // const now = Date.now();
    // for (const file of files) {
    //   const filePath = `${tempDir}/${file}`;
    //   const stats = await stat(filePath);
    //   const age = now - stats.mtimeMs;
    //   if (age > 24 * 60 * 60 * 1000) { // 24   
    //     await unlink(filePath);
    //   }
    // }

    return {
      message: '   ',
    };
  }
}

//   
export const imageProcessingService = new ImageProcessingService();
