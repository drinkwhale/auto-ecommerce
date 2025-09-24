const AWS = require('aws-sdk');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: process.env.LOG_FILE_PATH || './logs/app.log' })
  ]
});

/**
 * 상품 이미지 업로드 및 관리 서비스
 * AWS S3를 사용한 이미지 저장 및 최적화 기능 제공
 */
class ImageManagementService {
  constructor() {
    // AWS S3 설정
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.bucketName = process.env.S3_BUCKET_NAME || 'auto-ecommerce-images';
    this.cdnUrl = process.env.CDN_URL || `https://${this.bucketName}.s3.amazonaws.com`;

    // 이미지 설정
    this.config = {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
      allowedTypes: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(','),
      resizeWidth: parseInt(process.env.IMAGE_RESIZE_WIDTH) || 1200,
      resizeHeight: parseInt(process.env.IMAGE_RESIZE_HEIGHT) || 1200,
      quality: 85,
      thumbnailSize: 300,
    };

    // 로컬 임시 저장소
    this.tempDir = path.join(process.cwd(), 'temp', 'images');
    this.ensureTempDirectory();
  }

  /**
   * 임시 디렉토리를 생성합니다
   */
  async ensureTempDirectory() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * S3 버킷이 존재하는지 확인하고 생성합니다
   */
  async ensureBucketExists() {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      logger.info(`S3 bucket ${this.bucketName} exists`);
    } catch (error) {
      if (error.statusCode === 404) {
        // 버킷이 없으면 생성
        await this.s3.createBucket({
          Bucket: this.bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: process.env.AWS_REGION || 'ap-northeast-2'
          }
        }).promise();

        // 공개 읽기 권한 설정
        await this.s3.putBucketAcl({
          Bucket: this.bucketName,
          ACL: 'public-read'
        }).promise();

        logger.info(`S3 bucket ${this.bucketName} created`);
      } else {
        logger.error('Error checking S3 bucket:', error);
        throw error;
      }
    }
  }

  /**
   * 이미지 파일을 검증합니다
   * @param {Buffer} buffer - 이미지 버퍼
   * @param {string} mimetype - MIME 타입
   * @param {number} size - 파일 크기
   * @returns {Object} 검증 결과
   */
  validateImage(buffer, mimetype, size) {
    const errors = [];

    // 파일 크기 검증
    if (size > this.config.maxFileSize) {
      errors.push(`File size too large. Max size: ${this.config.maxFileSize / (1024 * 1024)}MB`);
    }

    // MIME 타입 검증
    if (!this.config.allowedTypes.includes(mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${this.config.allowedTypes.join(', ')}`);
    }

    // 이미지 헤더 검증 (실제 이미지인지 확인)
    const isValidImage = this.isValidImageBuffer(buffer);
    if (!isValidImage) {
      errors.push('Invalid image file');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 버퍼가 유효한 이미지인지 확인합니다
   * @param {Buffer} buffer - 이미지 버퍼
   * @returns {boolean} 유효성 여부
   */
  isValidImageBuffer(buffer) {
    // 이미지 파일 시그니처 확인
    const signatures = [
      [0xFF, 0xD8, 0xFF], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
      [0x47, 0x49, 0x46], // GIF
    ];

    return signatures.some(signature => {
      return signature.every((byte, index) => buffer[index] === byte);
    });
  }

  /**
   * 이미지를 최적화합니다
   * @param {Buffer} buffer - 원본 이미지 버퍼
   * @param {Object} options - 최적화 옵션
   * @returns {Object} 최적화된 이미지 정보
   */
  async optimizeImage(buffer, options = {}) {
    try {
      const {
        width = this.config.resizeWidth,
        height = this.config.resizeHeight,
        quality = this.config.quality,
        format = 'jpeg'
      } = options;

      // 이미지 메타데이터 조회
      const metadata = await sharp(buffer).metadata();

      // 이미지 처리 파이프라인
      let sharpInstance = sharp(buffer)
        .rotate() // EXIF 회전 정보 적용
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });

      // 포맷에 따른 최적화
      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ compressionLevel: 6 });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      const optimizedBuffer = await sharpInstance.toBuffer();

      // 썸네일 생성
      const thumbnailBuffer = await sharp(buffer)
        .rotate()
        .resize(this.config.thumbnailSize, this.config.thumbnailSize, {
          fit: 'cover'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      return {
        original: {
          buffer,
          size: buffer.length,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        },
        optimized: {
          buffer: optimizedBuffer,
          size: optimizedBuffer.length,
          format: format
        },
        thumbnail: {
          buffer: thumbnailBuffer,
          size: thumbnailBuffer.length,
          width: this.config.thumbnailSize,
          height: this.config.thumbnailSize,
          format: 'jpeg'
        }
      };
    } catch (error) {
      logger.error('Error optimizing image:', error);
      throw new Error('Failed to optimize image');
    }
  }

  /**
   * 이미지를 S3에 업로드합니다
   * @param {Buffer} buffer - 이미지 버퍼
   * @param {string} key - S3 키 (파일 경로)
   * @param {string} contentType - Content-Type
   * @param {Object} metadata - 메타데이터
   * @returns {Promise<string>} 업로드된 이미지 URL
   */
  async uploadToS3(buffer, key, contentType, metadata = {}) {
    try {
      await this.ensureBucketExists();

      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
        Metadata: {
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      };

      const result = await this.s3.upload(params).promise();
      logger.info(`Image uploaded to S3: ${result.Location}`);

      return result.Location;
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw new Error('Failed to upload image to S3');
    }
  }

  /**
   * 상품 이미지를 업로드하고 처리합니다
   * @param {Object} imageFile - 이미지 파일 객체
   * @param {string} productId - 상품 ID
   * @param {string} imageType - 이미지 타입 (main, additional)
   * @returns {Object} 업로드 결과
   */
  async uploadProductImage(imageFile, productId, imageType = 'additional') {
    try {
      // 파일 버퍼 생성
      let buffer;
      if (Buffer.isBuffer(imageFile)) {
        buffer = imageFile;
      } else if (imageFile.buffer) {
        buffer = imageFile.buffer;
      } else if (imageFile.path) {
        buffer = await fs.readFile(imageFile.path);
      } else {
        throw new Error('Invalid image file format');
      }

      // 이미지 검증
      const validation = this.validateImage(
        buffer,
        imageFile.mimetype || 'image/jpeg',
        buffer.length
      );

      if (!validation.isValid) {
        throw new Error(`Image validation failed: ${validation.errors.join(', ')}`);
      }

      // 이미지 최적화
      const optimized = await this.optimizeImage(buffer);

      // 고유 파일명 생성
      const fileId = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const keyPrefix = `products/${productId}/${imageType}/${timestamp}_${fileId}`;

      // 업로드 작업 병렬 처리
      const uploadPromises = [];

      // 원본 이미지 업로드
      uploadPromises.push(
        this.uploadToS3(
          optimized.original.buffer,
          `${keyPrefix}_original.${optimized.original.format}`,
          `image/${optimized.original.format}`,
          {
            type: 'original',
            productId,
            imageType,
            width: optimized.original.width.toString(),
            height: optimized.original.height.toString()
          }
        )
      );

      // 최적화된 이미지 업로드
      uploadPromises.push(
        this.uploadToS3(
          optimized.optimized.buffer,
          `${keyPrefix}_optimized.${optimized.optimized.format}`,
          `image/${optimized.optimized.format}`,
          {
            type: 'optimized',
            productId,
            imageType
          }
        )
      );

      // 썸네일 업로드
      uploadPromises.push(
        this.uploadToS3(
          optimized.thumbnail.buffer,
          `${keyPrefix}_thumbnail.jpg`,
          'image/jpeg',
          {
            type: 'thumbnail',
            productId,
            imageType
          }
        )
      );

      const [originalUrl, optimizedUrl, thumbnailUrl] = await Promise.all(uploadPromises);

      // 이미지 정보 반환
      const imageInfo = {
        id: fileId,
        productId,
        imageType,
        urls: {
          original: originalUrl,
          optimized: optimizedUrl,
          thumbnail: thumbnailUrl
        },
        metadata: {
          originalSize: optimized.original.size,
          optimizedSize: optimized.optimized.size,
          thumbnailSize: optimized.thumbnail.size,
          width: optimized.original.width,
          height: optimized.original.height,
          format: optimized.original.format
        },
        uploadedAt: new Date().toISOString()
      };

      logger.info(`Product image uploaded successfully: ${fileId} for product ${productId}`);
      return imageInfo;

    } catch (error) {
      logger.error('Error uploading product image:', error);
      throw error;
    }
  }

  /**
   * 여러 이미지를 배치로 업로드합니다
   * @param {Array} imageFiles - 이미지 파일 배열
   * @param {string} productId - 상품 ID
   * @returns {Array} 업로드 결과 배열
   */
  async uploadMultipleImages(imageFiles, productId) {
    try {
      const uploadPromises = imageFiles.map((imageFile, index) => {
        const imageType = index === 0 ? 'main' : 'additional';
        return this.uploadProductImage(imageFile, productId, imageType);
      });

      const results = await Promise.all(uploadPromises);

      logger.info(`Batch uploaded ${results.length} images for product ${productId}`);
      return results;

    } catch (error) {
      logger.error('Error in batch image upload:', error);
      throw error;
    }
  }

  /**
   * 이미지를 삭제합니다
   * @param {string} imageUrl - 삭제할 이미지 URL
   * @returns {boolean} 삭제 성공 여부
   */
  async deleteImage(imageUrl) {
    try {
      // URL에서 S3 키 추출
      const key = imageUrl.replace(this.cdnUrl + '/', '');

      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();

      logger.info(`Image deleted from S3: ${key}`);
      return true;

    } catch (error) {
      logger.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * 상품의 모든 이미지를 삭제합니다
   * @param {string} productId - 상품 ID
   * @returns {boolean} 삭제 성공 여부
   */
  async deleteProductImages(productId) {
    try {
      const prefix = `products/${productId}/`;

      // 상품 관련 모든 객체 조회
      const listParams = {
        Bucket: this.bucketName,
        Prefix: prefix
      };

      const objects = await this.s3.listObjectsV2(listParams).promise();

      if (objects.Contents.length === 0) {
        logger.info(`No images found for product: ${productId}`);
        return true;
      }

      // 일괄 삭제
      const deleteParams = {
        Bucket: this.bucketName,
        Delete: {
          Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
        }
      };

      await this.s3.deleteObjects(deleteParams).promise();

      logger.info(`Deleted ${objects.Contents.length} images for product: ${productId}`);
      return true;

    } catch (error) {
      logger.error('Error deleting product images:', error);
      return false;
    }
  }

  /**
   * 이미지 메타데이터를 조회합니다
   * @param {string} imageUrl - 이미지 URL
   * @returns {Object} 이미지 메타데이터
   */
  async getImageMetadata(imageUrl) {
    try {
      const key = imageUrl.replace(this.cdnUrl + '/', '');

      const headResult = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();

      return {
        size: headResult.ContentLength,
        lastModified: headResult.LastModified,
        contentType: headResult.ContentType,
        metadata: headResult.Metadata
      };

    } catch (error) {
      logger.error('Error getting image metadata:', error);
      throw error;
    }
  }

  /**
   * 임시 파일을 정리합니다
   */
  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24시간

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          logger.debug(`Cleaned up temp file: ${file}`);
        }
      }

    } catch (error) {
      logger.error('Error cleaning up temp files:', error);
    }
  }
}

module.exports = ImageManagementService;