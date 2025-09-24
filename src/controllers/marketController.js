const IntegratedMarketService = require('../services/integratedMarketService');
const { Success, Fail, Error, SuccessWithPagination } = require('../utils/response');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: process.env.LOG_FILE_PATH || './logs/app.log' })
  ]
});

/**
 * 오픈마켓 통합 관리 컨트롤러
 */
class MarketController {
  constructor() {
    this.marketService = new IntegratedMarketService();
    this.initializeService();
  }

  /**
   * 서비스 초기화
   */
  async initializeService() {
    try {
      await this.marketService.initialize();
    } catch (error) {
      logger.error('Failed to initialize MarketController:', error);
    }
  }

  /**
   * 상품을 여러 오픈마켓에 등록합니다
   * POST /api/markets/products/register
   */
  registerProduct = async (req, res) => {
    try {
      const { productData, platforms, options = {} } = req.body;

      // 입력 데이터 검증
      if (!productData || !platforms || !Array.isArray(platforms)) {
        return res.status(400).json(
          Fail('Product data and platforms array are required')
        );
      }

      // 필수 상품 정보 검증
      const requiredFields = ['name', 'price', 'description'];
      const missingFields = requiredFields.filter(field => !productData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json(
          Fail(`Missing required fields: ${missingFields.join(', ')}`)
        );
      }

      // 지원하는 플랫폼 검증
      const supportedPlatforms = ['elevenst', 'coupang', 'naver', 'esm'];
      const invalidPlatforms = platforms.filter(p => !supportedPlatforms.includes(p));

      if (invalidPlatforms.length > 0) {
        return res.status(400).json(
          Fail(`Unsupported platforms: ${invalidPlatforms.join(', ')}. Supported: ${supportedPlatforms.join(', ')}`)
        );
      }

      logger.info('Starting product registration', {
        productName: productData.name,
        sku: productData.sku,
        platforms
      });

      // 상품 등록 실행
      const result = await this.marketService.registerProductToMultiplePlatforms(
        productData,
        platforms,
        options
      );

      // 부분 성공 처리
      if (result.failureCount > 0 && result.successCount > 0) {
        return res.status(207).json({ // 207 Multi-Status
          ...Success(result, 'Product registered with some failures'),
          statusCode: 207
        });
      }

      // 전체 실패 처리
      if (result.failureCount === platforms.length) {
        return res.status(500).json(
          Error('Product registration failed for all platforms', result)
        );
      }

      // 전체 성공
      res.status(201).json(
        Success(result, 'Product registered successfully to all platforms')
      );

    } catch (error) {
      logger.error('Product registration error:', error);
      res.status(500).json(
        Error('Internal server error during product registration', error.message)
      );
    }
  };

  /**
   * 배치로 상품을 등록합니다
   * POST /api/markets/products/batch-register
   */
  batchRegisterProducts = async (req, res) => {
    try {
      const { products, platforms, options = {} } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json(
          Fail('Products array is required and must not be empty')
        );
      }

      if (products.length > 50) {
        return res.status(400).json(
          Fail('Maximum 50 products allowed per batch')
        );
      }

      logger.info(`Starting batch product registration: ${products.length} products`);

      const results = [];
      const batchSize = 5; // 동시 처리 수 제한

      // 배치 처리
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        const batchPromises = batch.map(async (productData, index) => {
          try {
            return await this.marketService.registerProductToMultiplePlatforms(
              productData,
              platforms,
              { ...options, batchIndex: i + index }
            );
          } catch (error) {
            logger.error(`Batch item ${i + index} failed:`, error);
            return {
              success: false,
              error: error.message,
              productSku: productData.sku || `batch_${i + index}`
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Rate limit 방지를 위한 대기
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        }
      }

      const summary = {
        totalProducts: products.length,
        totalSuccessful: results.filter(r => r.successCount > 0).length,
        totalFailed: results.filter(r => r.successCount === 0).length,
        results: results
      };

      res.status(200).json(
        Success(summary, 'Batch product registration completed')
      );

    } catch (error) {
      logger.error('Batch product registration error:', error);
      res.status(500).json(
        Error('Internal server error during batch product registration', error.message)
      );
    }
  };

  /**
   * 주문을 동기화합니다
   * POST /api/markets/orders/sync
   */
  synchronizeOrders = async (req, res) => {
    try {
      const { platforms, startDate, endDate, options = {} } = req.body;

      const syncOptions = {
        platforms,
        startDate,
        endDate,
        ...options
      };

      logger.info('Starting order synchronization', syncOptions);

      const result = await this.marketService.synchronizeOrders(syncOptions);

      res.status(200).json(
        Success(result, 'Orders synchronized successfully')
      );

    } catch (error) {
      logger.error('Order synchronization error:', error);
      res.status(500).json(
        Error('Internal server error during order synchronization', error.message)
      );
    }
  };

  /**
   * 재고를 동기화합니다
   * POST /api/markets/inventory/sync
   */
  synchronizeInventory = async (req, res) => {
    try {
      const { inventoryUpdates } = req.body;

      if (!Array.isArray(inventoryUpdates) || inventoryUpdates.length === 0) {
        return res.status(400).json(
          Fail('Inventory updates array is required and must not be empty')
        );
      }

      // 재고 업데이트 데이터 검증
      for (const update of inventoryUpdates) {
        if (!update.productSku || typeof update.quantity !== 'number' || !Array.isArray(update.platforms)) {
          return res.status(400).json(
            Fail('Each inventory update must have productSku, quantity, and platforms array')
          );
        }
      }

      logger.info(`Starting inventory synchronization: ${inventoryUpdates.length} updates`);

      const result = await this.marketService.synchronizeInventory(inventoryUpdates);

      res.status(200).json(
        Success(result, 'Inventory synchronized successfully')
      );

    } catch (error) {
      logger.error('Inventory synchronization error:', error);
      res.status(500).json(
        Error('Internal server error during inventory synchronization', error.message)
      );
    }
  };

  /**
   * 작업 상태를 조회합니다
   * GET /api/markets/jobs/:jobId
   */
  getJobStatus = async (req, res) => {
    try {
      const { jobId } = req.params;

      const jobStatus = this.marketService.getJobStatus(jobId);

      if (!jobStatus) {
        return res.status(404).json(
          Fail(`Job not found: ${jobId}`)
        );
      }

      res.status(200).json(
        Success(jobStatus, 'Job status retrieved successfully')
      );

    } catch (error) {
      logger.error('Get job status error:', error);
      res.status(500).json(
        Error('Internal server error while retrieving job status', error.message)
      );
    }
  };

  /**
   * 모든 활성 작업을 조회합니다
   * GET /api/markets/jobs
   */
  getAllActiveJobs = async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;

      let jobs = this.marketService.getAllActiveJobs();

      // 상태별 필터링
      if (status) {
        jobs = jobs.filter(job => job.status === status);
      }

      // 페이지네이션
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedJobs = jobs.slice(startIndex, endIndex);

      const pagination = {
        currentPage: parseInt(page),
        totalItems: jobs.length,
        totalPages: Math.ceil(jobs.length / limit),
        itemsPerPage: parseInt(limit)
      };

      res.status(200).json(
        SuccessWithPagination(paginatedJobs, pagination, 'Active jobs retrieved successfully')
      );

    } catch (error) {
      logger.error('Get active jobs error:', error);
      res.status(500).json(
        Error('Internal server error while retrieving active jobs', error.message)
      );
    }
  };

  /**
   * 실패한 등록을 재시도합니다
   * POST /api/markets/jobs/:jobId/retry
   */
  retryFailedRegistration = async (req, res) => {
    try {
      const { jobId } = req.params;

      logger.info(`Retrying failed registration: ${jobId}`);

      const result = await this.marketService.retryFailedRegistrations(jobId);

      res.status(200).json(
        Success(result, 'Failed registrations retry initiated')
      );

    } catch (error) {
      logger.error('Retry failed registration error:', error);
      res.status(500).json(
        Error('Internal server error during retry', error.message)
      );
    }
  };

  /**
   * 카테고리 매핑 정보를 조회합니다
   * GET /api/markets/categories/mappings
   */
  getCategoryMappings = async (req, res) => {
    try {
      const { platform } = req.query;

      const stats = this.marketService.categoryMapping.getCategoryMappingStats();

      let additionalData = {};
      if (platform) {
        additionalData.unmappedCategories = this.marketService.categoryMapping
          .getUnmappedCategories(platform);
      }

      res.status(200).json(
        Success({
          ...stats,
          ...additionalData
        }, 'Category mapping information retrieved successfully')
      );

    } catch (error) {
      logger.error('Get category mappings error:', error);
      res.status(500).json(
        Error('Internal server error while retrieving category mappings', error.message)
      );
    }
  };

  /**
   * 카테고리 매핑을 추가합니다
   * POST /api/markets/categories/mappings
   */
  addCategoryMapping = async (req, res) => {
    try {
      const { standardCategoryId, platform, platformCategoryInfo } = req.body;

      if (!standardCategoryId || !platform || !platformCategoryInfo) {
        return res.status(400).json(
          Fail('standardCategoryId, platform, and platformCategoryInfo are required')
        );
      }

      await this.marketService.categoryMapping.addCategoryMapping(
        standardCategoryId,
        platform,
        platformCategoryInfo
      );

      res.status(201).json(
        Success(
          { standardCategoryId, platform, platformCategoryInfo },
          'Category mapping added successfully'
        )
      );

    } catch (error) {
      logger.error('Add category mapping error:', error);
      res.status(500).json(
        Error('Internal server error while adding category mapping', error.message)
      );
    }
  };

  /**
   * 상품명 기반 카테고리 추천을 조회합니다
   * POST /api/markets/categories/suggest
   */
  suggestCategories = async (req, res) => {
    try {
      const { productName, productDescription = '', existingCategories = [] } = req.body;

      if (!productName) {
        return res.status(400).json(
          Fail('Product name is required')
        );
      }

      const suggestions = this.marketService.categoryMapping.suggestStandardCategory(
        productName,
        productDescription,
        existingCategories
      );

      res.status(200).json(
        Success(suggestions, 'Category suggestions retrieved successfully')
      );

    } catch (error) {
      logger.error('Category suggestion error:', error);
      res.status(500).json(
        Error('Internal server error while suggesting categories', error.message)
      );
    }
  };

  /**
   * 시스템 상태를 조회합니다
   * GET /api/markets/health
   */
  getSystemHealth = async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          integratedMarketService: 'healthy',
          categoryMapping: 'healthy',
          imageManagement: 'healthy'
        },
        activeJobs: this.marketService.getAllActiveJobs().length,
        platformsAvailable: Object.keys(this.marketService.platforms)
      };

      res.status(200).json(
        Success(health, 'System health check completed')
      );

    } catch (error) {
      logger.error('Health check error:', error);
      res.status(503).json(
        Error('Service unhealthy', error.message, 503)
      );
    }
  };
}

module.exports = MarketController;