const ElevenStreetService = require('./elevenStreetService');
const CoupangService = require('./coupangService');
const NaverCommerceService = require('./naverCommerceService');
const EsmService = require('./esmService');
const CategoryMappingService = require('./categoryMappingService');
const ImageManagementService = require('./imageManagementService');
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
 * 통합 오픈마켓 관리 서비스
 * 모든 오픈마켓의 상품 등록, 주문 관리, 재고 동기화를 통합 관리
 */
class IntegratedMarketService {
  constructor() {
    // 각 플랫폼 서비스 초기화
    this.platforms = {
      elevenst: new ElevenStreetService(),
      coupang: new CoupangService(),
      naver: new NaverCommerceService(),
      esm: new EsmService()
    };

    // 부가 서비스 초기화
    this.categoryMapping = new CategoryMappingService();
    this.imageManagement = new ImageManagementService();

    // 기본 설정
    this.config = {
      batchSize: 10, // 배치 처리 크기
      retryAttempts: 3,
      concurrentUploads: 3, // 동시 업로드 수
      syncInterval: 30 * 60 * 1000, // 30분마다 동기화
    };

    // 작업 상태 추적
    this.activeJobs = new Map();
  }

  /**
   * 서비스를 초기화합니다
   */
  async initialize() {
    try {
      await this.categoryMapping.initializeCategories();
      logger.info('Integrated Market Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Integrated Market Service:', error);
      throw error;
    }
  }

  /**
   * 여러 오픈마켓에 상품을 동시 등록합니다
   * @param {Object} productData - 상품 데이터
   * @param {Array} targetPlatforms - 대상 플랫폼 목록
   * @param {Object} options - 등록 옵션
   * @returns {Object} 등록 결과
   */
  async registerProductToMultiplePlatforms(productData, targetPlatforms, options = {}) {
    const jobId = `register_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 작업 시작 로깅
      this.activeJobs.set(jobId, {
        type: 'register',
        productSku: productData.sku,
        platforms: targetPlatforms,
        status: 'in_progress',
        startedAt: new Date(),
        results: {}
      });

      logger.info(`Starting product registration job: ${jobId}`, {
        productName: productData.name,
        sku: productData.sku,
        platforms: targetPlatforms
      });

      // 1. 이미지 업로드 처리
      let imageUrls = {};
      if (productData.images && productData.images.length > 0) {
        imageUrls = await this.processProductImages(productData.images, productData.sku);
        logger.info(`Images processed for product ${productData.sku}:`, imageUrls);
      }

      // 2. 카테고리 자동 매핑
      const categoryMappings = await this.categoryMapping.autoMapCategories(
        productData,
        targetPlatforms
      );

      // 3. 각 플랫폼별 상품 데이터 준비
      const platformProducts = this.preparePlatformProductData(
        productData,
        imageUrls,
        categoryMappings
      );

      // 4. 동시 등록 실행
      const results = await this.executeConcurrentRegistration(
        platformProducts,
        targetPlatforms,
        options
      );

      // 5. 결과 정리 및 반환
      const jobResult = this.consolidateRegistrationResults(jobId, results);

      // 작업 완료 상태 업데이트
      this.activeJobs.set(jobId, {
        ...this.activeJobs.get(jobId),
        status: 'completed',
        completedAt: new Date(),
        results: jobResult.results
      });

      logger.info(`Product registration job completed: ${jobId}`, {
        successCount: jobResult.successCount,
        failureCount: jobResult.failureCount
      });

      return jobResult;

    } catch (error) {
      // 작업 실패 상태 업데이트
      this.activeJobs.set(jobId, {
        ...this.activeJobs.get(jobId),
        status: 'failed',
        completedAt: new Date(),
        error: error.message
      });

      logger.error(`Product registration job failed: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * 상품 이미지를 처리합니다
   * @param {Array} images - 이미지 파일 또는 URL 배열
   * @param {string} productSku - 상품 SKU
   * @returns {Object} 처리된 이미지 URL 정보
   */
  async processProductImages(images, productSku) {
    try {
      const imageResults = [];

      // 이미지 업로드를 배치로 처리
      const batches = this.chunkArray(images, this.config.concurrentUploads);

      for (const batch of batches) {
        const batchPromises = batch.map(async (image, index) => {
          try {
            if (typeof image === 'string') {
              // URL인 경우 다운로드 후 업로드
              const imageBuffer = await this.downloadImage(image);
              return await this.imageManagement.uploadProductImage(
                imageBuffer,
                productSku,
                index === 0 ? 'main' : 'additional'
              );
            } else {
              // 파일 객체인 경우 직접 업로드
              return await this.imageManagement.uploadProductImage(
                image,
                productSku,
                index === 0 ? 'main' : 'additional'
              );
            }
          } catch (error) {
            logger.error(`Failed to process image ${index} for product ${productSku}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        imageResults.push(...batchResults.filter(result => result !== null));
      }

      return {
        mainImage: imageResults.find(img => img.imageType === 'main')?.urls.optimized,
        additionalImages: imageResults
          .filter(img => img.imageType === 'additional')
          .map(img => img.urls.optimized),
        thumbnails: imageResults.map(img => img.urls.thumbnail),
        allImages: imageResults
      };

    } catch (error) {
      logger.error('Error processing product images:', error);
      throw error;
    }
  }

  /**
   * URL에서 이미지를 다운로드합니다
   * @param {string} imageUrl - 이미지 URL
   * @returns {Buffer} 이미지 버퍼
   */
  async downloadImage(imageUrl) {
    const axios = require('axios');

    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Auto-Ecommerce-Platform/1.0'
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to download image: ${imageUrl}`, error);
      throw error;
    }
  }

  /**
   * 플랫폼별 상품 데이터를 준비합니다
   * @param {Object} productData - 원본 상품 데이터
   * @param {Object} imageUrls - 처리된 이미지 URL
   * @param {Object} categoryMappings - 카테고리 매핑 정보
   * @returns {Object} 플랫폼별 상품 데이터
   */
  preparePlatformProductData(productData, imageUrls, categoryMappings) {
    const platformProducts = {};

    for (const [platform, mapping] of Object.entries(categoryMappings)) {
      platformProducts[platform] = {
        ...productData,
        mainImage: imageUrls.mainImage,
        additionalImages: imageUrls.additionalImages,
        categoryId: mapping.mappedCategory?.categoryId,
        categoryName: mapping.mappedCategory?.categoryName,
        categoryPath: mapping.mappedCategory?.categoryPath,
        attributes: mapping.mappedCategory?.attributes || [],
        mappingConfidence: mapping.confidence
      };
    }

    return platformProducts;
  }

  /**
   * 동시 등록을 실행합니다
   * @param {Object} platformProducts - 플랫폼별 상품 데이터
   * @param {Array} targetPlatforms - 대상 플랫폼
   * @param {Object} options - 등록 옵션
   * @returns {Object} 등록 결과
   */
  async executeConcurrentRegistration(platformProducts, targetPlatforms, options) {
    const registrationPromises = targetPlatforms.map(async (platform) => {
      try {
        const platformService = this.platforms[platform];
        const productData = platformProducts[platform];

        if (!platformService) {
          throw new Error(`Unknown platform: ${platform}`);
        }

        if (!productData.categoryId && !options.skipCategoryValidation) {
          logger.warn(`No category mapping found for platform: ${platform}. Skipping registration.`);
          return {
            platform,
            success: false,
            error: 'No category mapping found',
            needsManualMapping: true
          };
        }

        // 플랫폼별 특별 처리
        let result;
        if (platform === 'esm') {
          // ESM은 지마켓과 옥션을 선택해야 함
          const marketplace = options.esmMarketplace || 'gmarket';
          result = await platformService.registerProduct(productData, marketplace);
        } else {
          result = await platformService.registerProduct(productData);
        }

        return {
          platform,
          success: result.success,
          productId: result.productId,
          data: result.data,
          registeredAt: new Date().toISOString()
        };

      } catch (error) {
        logger.error(`Registration failed for platform ${platform}:`, error);
        return {
          platform,
          success: false,
          error: error.message,
          errorCode: error.code,
          needsRetry: this.shouldRetryError(error)
        };
      }
    });

    return await Promise.all(registrationPromises);
  }

  /**
   * 등록 결과를 정리합니다
   * @param {string} jobId - 작업 ID
   * @param {Array} results - 등록 결과 배열
   * @returns {Object} 정리된 결과
   */
  consolidateRegistrationResults(jobId, results) {
    const successResults = results.filter(r => r.success);
    const failureResults = results.filter(r => !r.success);
    const retryableFailures = failureResults.filter(r => r.needsRetry);
    const needManualMapping = failureResults.filter(r => r.needsManualMapping);

    return {
      jobId,
      successCount: successResults.length,
      failureCount: failureResults.length,
      results: {
        successful: successResults,
        failed: failureResults,
        needsRetry: retryableFailures,
        needsManualMapping: needManualMapping
      },
      summary: {
        totalPlatforms: results.length,
        successRate: (successResults.length / results.length) * 100,
        completedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 재시도 가능한 에러인지 확인합니다
   * @param {Error} error - 에러 객체
   * @returns {boolean} 재시도 가능 여부
   */
  shouldRetryError(error) {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMIT_EXCEEDED',
      'SERVER_ERROR',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    return retryableCodes.includes(error.code) ||
           (error.status >= 500 && error.status < 600);
  }

  /**
   * 배열을 청크 단위로 나눕니다
   * @param {Array} array - 원본 배열
   * @param {number} chunkSize - 청크 크기
   * @returns {Array} 청크 배열
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 실패한 등록을 재시도합니다
   * @param {string} jobId - 원본 작업 ID
   * @returns {Object} 재시도 결과
   */
  async retryFailedRegistrations(jobId) {
    const originalJob = this.activeJobs.get(jobId);

    if (!originalJob || !originalJob.results.needsRetry) {
      throw new Error('No retryable failures found for job: ' + jobId);
    }

    const retryJobId = `retry_${jobId}_${Date.now()}`;
    const failedPlatforms = originalJob.results.needsRetry.map(r => r.platform);

    logger.info(`Retrying failed registrations: ${retryJobId}`, {
      originalJobId: jobId,
      platforms: failedPlatforms
    });

    // 원본 상품 데이터로 재시도
    // 실제 구현에서는 원본 데이터를 저장해야 함
    return {
      retryJobId,
      message: 'Retry functionality requires original product data storage',
      failedPlatforms
    };
  }

  /**
   * 주문을 동기화합니다
   * @param {Object} options - 동기화 옵션
   * @returns {Object} 동기화 결과
   */
  async synchronizeOrders(options = {}) {
    const syncJobId = `sync_orders_${Date.now()}`;

    try {
      logger.info(`Starting order synchronization: ${syncJobId}`);

      const platforms = options.platforms || Object.keys(this.platforms);
      const results = {};

      for (const platform of platforms) {
        try {
          const platformService = this.platforms[platform];
          const orders = await platformService.getOrders(options);

          results[platform] = {
            success: true,
            orderCount: Array.isArray(orders.data) ? orders.data.length : 0,
            data: orders.data,
            syncedAt: new Date().toISOString()
          };

          logger.info(`Synced ${results[platform].orderCount} orders from ${platform}`);

        } catch (error) {
          logger.error(`Order sync failed for platform ${platform}:`, error);
          results[platform] = {
            success: false,
            error: error.message
          };
        }
      }

      return {
        syncJobId,
        results,
        totalOrders: Object.values(results)
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.orderCount, 0)
      };

    } catch (error) {
      logger.error(`Order synchronization failed: ${syncJobId}`, error);
      throw error;
    }
  }

  /**
   * 재고를 동기화합니다
   * @param {Array} inventoryUpdates - 재고 업데이트 정보
   * @returns {Object} 동기화 결과
   */
  async synchronizeInventory(inventoryUpdates) {
    const syncJobId = `sync_inventory_${Date.now()}`;

    try {
      logger.info(`Starting inventory synchronization: ${syncJobId}`);

      const results = [];

      for (const update of inventoryUpdates) {
        const { productSku, quantity, platforms } = update;

        for (const platform of platforms) {
          try {
            const platformService = this.platforms[platform];
            const result = await platformService.updateInventory(productSku, quantity);

            results.push({
              platform,
              productSku,
              quantity,
              success: result.success,
              updatedAt: new Date().toISOString()
            });

          } catch (error) {
            logger.error(`Inventory sync failed for ${platform}:${productSku}:`, error);
            results.push({
              platform,
              productSku,
              quantity,
              success: false,
              error: error.message
            });
          }
        }
      }

      return {
        syncJobId,
        results,
        summary: {
          totalUpdates: results.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length
        }
      };

    } catch (error) {
      logger.error(`Inventory synchronization failed: ${syncJobId}`, error);
      throw error;
    }
  }

  /**
   * 작업 상태를 조회합니다
   * @param {string} jobId - 작업 ID
   * @returns {Object} 작업 상태 정보
   */
  getJobStatus(jobId) {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * 모든 활성 작업을 조회합니다
   * @returns {Array} 활성 작업 목록
   */
  getAllActiveJobs() {
    return Array.from(this.activeJobs.entries()).map(([jobId, job]) => ({
      jobId,
      ...job
    }));
  }

  /**
   * 완료된 작업을 정리합니다
   */
  cleanupCompletedJobs() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24시간

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.completedAt && new Date(job.completedAt).getTime() < cutoffTime) {
        this.activeJobs.delete(jobId);
      }
    }

    logger.info('Cleaned up old completed jobs');
  }
}

module.exports = IntegratedMarketService;