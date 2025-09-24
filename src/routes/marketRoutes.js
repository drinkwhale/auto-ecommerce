const express = require('express');
const multer = require('multer');
const MarketController = require('../controllers/marketController');
const { validateProductData, validateBatchData, validateInventoryData } = require('../middleware/validation');
const rateLimitMiddleware = require('../middleware/rateLimit');

const router = express.Router();
const marketController = new MarketController();

// Multer 설정 (이미지 업로드용)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    files: 10 // 최대 10개 파일
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`), false);
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductData:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - description
 *       properties:
 *         sku:
 *           type: string
 *           description: 상품 SKU (없으면 자동 생성)
 *         name:
 *           type: string
 *           description: 상품명
 *         price:
 *           type: number
 *           description: 판매가격
 *         originalPrice:
 *           type: number
 *           description: 원가격
 *         description:
 *           type: string
 *           description: 상품 설명
 *         brand:
 *           type: string
 *           description: 브랜드명
 *         manufacturer:
 *           type: string
 *           description: 제조사
 *         model:
 *           type: string
 *           description: 모델명
 *         stock:
 *           type: number
 *           description: 재고 수량
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: 기존 카테고리 정보
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: 이미지 URL 또는 파일
 *         deliveryFee:
 *           type: number
 *           description: 배송비
 *         deliveryType:
 *           type: string
 *           description: 배송 타입
 *
 *     RegistrationResult:
 *       type: object
 *       properties:
 *         jobId:
 *           type: string
 *           description: 작업 ID
 *         successCount:
 *           type: number
 *           description: 성공한 플랫폼 수
 *         failureCount:
 *           type: number
 *           description: 실패한 플랫폼 수
 *         results:
 *           type: object
 *           properties:
 *             successful:
 *               type: array
 *               description: 성공한 등록 결과
 *             failed:
 *               type: array
 *               description: 실패한 등록 결과
 *             needsRetry:
 *               type: array
 *               description: 재시도가 필요한 결과
 *             needsManualMapping:
 *               type: array
 *               description: 수동 매핑이 필요한 결과
 */

/**
 * @swagger
 * /api/markets/products/register:
 *   post:
 *     summary: 여러 오픈마켓에 상품 등록
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productData
 *               - platforms
 *             properties:
 *               productData:
 *                 $ref: '#/components/schemas/ProductData'
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [elevenst, coupang, naver, esm]
 *                 description: 대상 플랫폼 목록
 *               options:
 *                 type: object
 *                 properties:
 *                   skipCategoryValidation:
 *                     type: boolean
 *                   esmMarketplace:
 *                     type: string
 *                     enum: [gmarket, auction]
 *     responses:
 *       201:
 *         description: 상품 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationResult'
 *       207:
 *         description: 부분 성공 (일부 플랫폼 실패)
 *       400:
 *         description: 잘못된 요청 데이터
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/products/register',
  rateLimitMiddleware('product_register', 10, 60000), // 1분에 10회
  upload.array('images', 10),
  validateProductData,
  marketController.registerProduct
);

/**
 * @swagger
 * /api/markets/products/batch-register:
 *   post:
 *     summary: 배치로 상품 등록
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - products
 *               - platforms
 *             properties:
 *               products:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   $ref: '#/components/schemas/ProductData'
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [elevenst, coupang, naver, esm]
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: 배치 등록 완료
 *       400:
 *         description: 잘못된 요청 데이터
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/products/batch-register',
  rateLimitMiddleware('batch_register', 5, 300000), // 5분에 5회
  validateBatchData,
  marketController.batchRegisterProducts
);

/**
 * @swagger
 * /api/markets/orders/sync:
 *   post:
 *     summary: 주문 정보 동기화
 *     tags: [Orders]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [elevenst, coupang, naver, esm]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: 주문 동기화 성공
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/orders/sync',
  rateLimitMiddleware('order_sync', 20, 60000), // 1분에 20회
  marketController.synchronizeOrders
);

/**
 * @swagger
 * /api/markets/inventory/sync:
 *   post:
 *     summary: 재고 정보 동기화
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inventoryUpdates
 *             properties:
 *               inventoryUpdates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productSku
 *                     - quantity
 *                     - platforms
 *                   properties:
 *                     productSku:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     platforms:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: 재고 동기화 성공
 *       400:
 *         description: 잘못된 요청 데이터
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/inventory/sync',
  rateLimitMiddleware('inventory_sync', 30, 60000), // 1분에 30회
  validateInventoryData,
  marketController.synchronizeInventory
);

/**
 * @swagger
 * /api/markets/jobs/{jobId}:
 *   get:
 *     summary: 작업 상태 조회
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 작업 ID
 *     responses:
 *       200:
 *         description: 작업 상태 조회 성공
 *       404:
 *         description: 작업을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get(
  '/jobs/:jobId',
  marketController.getJobStatus
);

/**
 * @swagger
 * /api/markets/jobs:
 *   get:
 *     summary: 모든 활성 작업 조회
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [in_progress, completed, failed]
 *     responses:
 *       200:
 *         description: 활성 작업 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get(
  '/jobs',
  marketController.getAllActiveJobs
);

/**
 * @swagger
 * /api/markets/jobs/{jobId}/retry:
 *   post:
 *     summary: 실패한 등록 재시도
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 원본 작업 ID
 *     responses:
 *       200:
 *         description: 재시도 시작
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/jobs/:jobId/retry',
  rateLimitMiddleware('job_retry', 5, 60000), // 1분에 5회
  marketController.retryFailedRegistration
);

/**
 * @swagger
 * /api/markets/categories/mappings:
 *   get:
 *     summary: 카테고리 매핑 정보 조회
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [elevenst, coupang, naver, esm]
 *         description: 특정 플랫폼의 매핑되지 않은 카테고리 조회
 *     responses:
 *       200:
 *         description: 카테고리 매핑 정보 조회 성공
 *       500:
 *         description: 서버 오류
 */
router.get(
  '/categories/mappings',
  marketController.getCategoryMappings
);

/**
 * @swagger
 * /api/markets/categories/mappings:
 *   post:
 *     summary: 카테고리 매핑 추가
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - standardCategoryId
 *               - platform
 *               - platformCategoryInfo
 *             properties:
 *               standardCategoryId:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [elevenst, coupang, naver, esm]
 *               platformCategoryInfo:
 *                 type: object
 *                 required:
 *                   - categoryId
 *                   - categoryName
 *                 properties:
 *                   categoryId:
 *                     type: string
 *                   categoryName:
 *                     type: string
 *                   categoryPath:
 *                     type: array
 *                     items:
 *                       type: string
 *                   attributes:
 *                     type: array
 *                     items:
 *                       type: object
 *     responses:
 *       201:
 *         description: 카테고리 매핑 추가 성공
 *       400:
 *         description: 잘못된 요청 데이터
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/categories/mappings',
  rateLimitMiddleware('category_mapping', 50, 60000), // 1분에 50회
  marketController.addCategoryMapping
);

/**
 * @swagger
 * /api/markets/categories/suggest:
 *   post:
 *     summary: 상품명 기반 카테고리 추천
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productName
 *             properties:
 *               productName:
 *                 type: string
 *               productDescription:
 *                 type: string
 *               existingCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 카테고리 추천 성공
 *       400:
 *         description: 잘못된 요청 데이터
 *       500:
 *         description: 서버 오류
 */
router.post(
  '/categories/suggest',
  rateLimitMiddleware('category_suggest', 100, 60000), // 1분에 100회
  marketController.suggestCategories
);

/**
 * @swagger
 * /api/markets/health:
 *   get:
 *     summary: 시스템 상태 확인
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 시스템 정상
 *       503:
 *         description: 서비스 이용 불가
 */
router.get(
  '/health',
  marketController.getSystemHealth
);

module.exports = router;