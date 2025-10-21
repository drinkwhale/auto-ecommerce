const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

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
 * 오픈마켓 간 카테고리 매핑 관리 서비스
 * 각 오픈마켓의 카테고리 구조를 통합 관리하고 자동 매핑 기능 제공
 */
class CategoryMappingService {
  constructor() {
    this.categoryMappings = new Map();
    this.standardCategories = new Map();
    this.mappingDataPath = path.join(process.cwd(), 'data', 'category-mappings.json');
    this.standardCategoriesPath = path.join(process.cwd(), 'data', 'standard-categories.json');

    // 카테고리 매핑 캐시 (Redis로 확장 가능)
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24시간
    this.lastCacheUpdate = 0;

    this.initializeCategories();
  }

  /**
   * 카테고리 데이터를 초기화합니다
   */
  async initializeCategories() {
    try {
      await this.ensureDataDirectory();
      await this.loadStandardCategories();
      await this.loadCategoryMappings();
      logger.info('Category mapping service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize category mapping service:', error);
      throw error;
    }
  }

  /**
   * 데이터 디렉토리가 존재하는지 확인하고 생성합니다
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.mappingDataPath);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * 표준 카테고리를 로드합니다
   */
  async loadStandardCategories() {
    try {
      const data = await fs.readFile(this.standardCategoriesPath, 'utf8');
      const categories = JSON.parse(data);

      for (const category of categories) {
        this.standardCategories.set(category.id, category);
      }

      logger.info(`Loaded ${this.standardCategories.size} standard categories`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 파일이 없으면 기본 표준 카테고리 생성
        await this.createDefaultStandardCategories();
      } else {
        logger.error('Error loading standard categories:', error);
        throw error;
      }
    }
  }

  /**
   * 카테고리 매핑을 로드합니다
   */
  async loadCategoryMappings() {
    try {
      const data = await fs.readFile(this.mappingDataPath, 'utf8');
      const mappings = JSON.parse(data);

      for (const [key, value] of Object.entries(mappings)) {
        this.categoryMappings.set(key, value);
      }

      this.lastCacheUpdate = Date.now();
      logger.info(`Loaded ${this.categoryMappings.size} category mappings`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 파일이 없으면 빈 매핑으로 시작
        this.categoryMappings = new Map();
        await this.saveCategoryMappings();
      } else {
        logger.error('Error loading category mappings:', error);
        throw error;
      }
    }
  }

  /**
   * 기본 표준 카테고리를 생성합니다
   */
  async createDefaultStandardCategories() {
    const defaultCategories = [
      {
        id: 'fashion',
        name: '패션',
        path: ['패션'],
        keywords: ['의류', '패션', '옷', '의상', '아우터', '상의', '하의', '신발', '가방', '액세서리'],
        subcategories: [
          { id: 'fashion.men', name: '남성패션', keywords: ['남성', '남자', '맨즈'] },
          { id: 'fashion.women', name: '여성패션', keywords: ['여성', '여자', '레이디스'] },
          { id: 'fashion.shoes', name: '신발', keywords: ['신발', '슈즈', '운동화', '구두'] },
          { id: 'fashion.bags', name: '가방', keywords: ['가방', '백팩', '지갑', '파우치'] }
        ]
      },
      {
        id: 'electronics',
        name: '전자제품',
        path: ['전자제품'],
        keywords: ['전자', '디지털', '가전', 'IT', '컴퓨터', '스마트폰', '태블릿'],
        subcategories: [
          { id: 'electronics.mobile', name: '모바일', keywords: ['스마트폰', '휴대폰', '모바일', '핸드폰'] },
          { id: 'electronics.computer', name: '컴퓨터', keywords: ['컴퓨터', 'PC', '노트북', '태블릿'] },
          { id: 'electronics.audio', name: '오디오', keywords: ['이어폰', '헤드폰', '스피커', '오디오'] }
        ]
      },
      {
        id: 'home',
        name: '홈/리빙',
        path: ['홈/리빙'],
        keywords: ['홈', '리빙', '가구', '인테리어', '주방', '욕실', '침실'],
        subcategories: [
          { id: 'home.furniture', name: '가구', keywords: ['가구', '책상', '의자', '소파', '침대'] },
          { id: 'home.kitchen', name: '주방용품', keywords: ['주방', '그릇', '냄비', '프라이팬', '식기'] },
          { id: 'home.bathroom', name: '욕실용품', keywords: ['욕실', '수건', '샤워', '세면', '화장지'] }
        ]
      },
      {
        id: 'beauty',
        name: '뷰티',
        path: ['뷰티'],
        keywords: ['뷰티', '화장품', '스킨케어', '메이크업', '향수', '미용'],
        subcategories: [
          { id: 'beauty.skincare', name: '스킨케어', keywords: ['스킨케어', '로션', '크림', '에센스', '세럼'] },
          { id: 'beauty.makeup', name: '메이크업', keywords: ['메이크업', '파운데이션', '립스틱', '아이섀도'] },
          { id: 'beauty.perfume', name: '향수', keywords: ['향수', '퍼퓨', '데오드란트'] }
        ]
      },
      {
        id: 'sports',
        name: '스포츠/레저',
        path: ['스포츠/레저'],
        keywords: ['스포츠', '운동', '레저', '헬스', '피트니스', '등산', '캠핑'],
        subcategories: [
          { id: 'sports.fitness', name: '헬스/피트니스', keywords: ['헬스', '피트니스', '운동기구', '요가'] },
          { id: 'sports.outdoor', name: '아웃도어', keywords: ['등산', '캠핑', '낚시', '아웃도어'] },
          { id: 'sports.wear', name: '스포츠웨어', keywords: ['운동복', '스포츠웨어', '트레이닝복'] }
        ]
      }
    ];

    for (const category of defaultCategories) {
      this.standardCategories.set(category.id, category);
    }

    await this.saveStandardCategories();
    logger.info('Created default standard categories');
  }

  /**
   * 표준 카테고리를 저장합니다
   */
  async saveStandardCategories() {
    try {
      const categories = Array.from(this.standardCategories.values());
      await fs.writeFile(
        this.standardCategoriesPath,
        JSON.stringify(categories, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error('Error saving standard categories:', error);
      throw error;
    }
  }

  /**
   * 카테고리 매핑을 저장합니다
   */
  async saveCategoryMappings() {
    try {
      const mappings = Object.fromEntries(this.categoryMappings);
      await fs.writeFile(
        this.mappingDataPath,
        JSON.stringify(mappings, null, 2),
        'utf8'
      );
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      logger.error('Error saving category mappings:', error);
      throw error;
    }
  }

  /**
   * 상품명과 설명을 기반으로 표준 카테고리를 추천합니다
   * @param {string} productName - 상품명
   * @param {string} productDescription - 상품 설명
   * @param {Array} existingCategories - 기존 카테고리 정보
   * @returns {Array} 추천 카테고리 목록
   */
  suggestStandardCategory(productName, productDescription = '', existingCategories = []) {
    const text = `${productName} ${productDescription}`.toLowerCase();
    const suggestions = [];

    // 각 표준 카테고리에 대해 점수 계산
    for (const [categoryId, category] of this.standardCategories) {
      let score = 0;

      // 카테고리 키워드와 매칭
      for (const keyword of category.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      // 서브카테고리와 매칭
      for (const subcategory of category.subcategories || []) {
        for (const keyword of subcategory.keywords) {
          if (text.includes(keyword.toLowerCase())) {
            score += 15; // 서브카테고리 매칭에 더 높은 점수
          }
        }
      }

      // 기존 카테고리 정보와 매칭
      for (const existingCategory of existingCategories) {
        if (existingCategory.toLowerCase().includes(category.name.toLowerCase()) ||
            category.name.toLowerCase().includes(existingCategory.toLowerCase())) {
          score += 20;
        }
      }

      if (score > 0) {
        suggestions.push({
          categoryId,
          category,
          score,
          confidence: Math.min(score / 50, 1) // 최대 1.0
        });
      }
    }

    // 점수 순으로 정렬하고 상위 3개 반환
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * 표준 카테고리를 각 오픈마켓의 카테고리로 매핑합니다
   * @param {string} standardCategoryId - 표준 카테고리 ID
   * @param {string} platform - 플랫폼명 (elevenst, coupang, naver, esm)
   * @returns {Object} 매핑된 카테고리 정보
   */
  mapToOpenMarketCategory(standardCategoryId, platform) {
    const mappingKey = `${standardCategoryId}:${platform}`;

    if (this.categoryMappings.has(mappingKey)) {
      return this.categoryMappings.get(mappingKey);
    }

    // 매핑이 없으면 null 반환 (수동 매핑 필요)
    logger.warn(`No category mapping found for ${mappingKey}`);
    return null;
  }

  /**
   * 카테고리 매핑을 추가하거나 업데이트합니다
   * @param {string} standardCategoryId - 표준 카테고리 ID
   * @param {string} platform - 플랫폼명
   * @param {Object} platformCategoryInfo - 플랫폼별 카테고리 정보
   */
  async addCategoryMapping(standardCategoryId, platform, platformCategoryInfo) {
    const mappingKey = `${standardCategoryId}:${platform}`;

    this.categoryMappings.set(mappingKey, {
      standardCategoryId,
      platform,
      categoryId: platformCategoryInfo.categoryId,
      categoryName: platformCategoryInfo.categoryName,
      categoryPath: platformCategoryInfo.categoryPath || [],
      attributes: platformCategoryInfo.attributes || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await this.saveCategoryMappings();
    logger.info(`Added category mapping: ${mappingKey}`);
  }

  /**
   * 플랫폼의 카테고리 목록을 업데이트합니다
   * @param {string} platform - 플랫폼명
   * @param {Array} categories - 카테고리 목록
   */
  async updatePlatformCategories(platform, categories) {
    // 실제 프로덕션에서는 Redis 등의 캐시를 사용
    const categoriesData = {
      platform,
      categories,
      updatedAt: new Date().toISOString()
    };

    // 파일로 임시 저장
    const categoriesPath = path.join(process.cwd(), 'data', `${platform}-categories.json`);
    await fs.writeFile(categoriesPath, JSON.stringify(categoriesData, null, 2), 'utf8');

    logger.info(`Updated ${platform} categories: ${categories.length} items`);
  }

  /**
   * 플랫폼의 카테고리 목록을 조회합니다
   * @param {string} platform - 플랫폼명
   * @returns {Array} 카테고리 목록
   */
  async getPlatformCategories(platform) {
    try {
      const categoriesPath = path.join(process.cwd(), 'data', `${platform}-categories.json`);
      const data = await fs.readFile(categoriesPath, 'utf8');
      const categoriesData = JSON.parse(data);

      return categoriesData.categories || [];
    } catch (error) {
      logger.warn(`No cached categories found for platform: ${platform}`, { error });
      return [];
    }
  }

  /**
   * 자동 카테고리 매핑을 수행합니다
   * @param {Object} productData - 상품 데이터
   * @param {Array} targetPlatforms - 대상 플랫폼 목록
   * @returns {Object} 플랫폼별 카테고리 매핑 결과
   */
  async autoMapCategories(productData, targetPlatforms) {
    const results = {};

    // 1. 표준 카테고리 추천
    const suggestions = this.suggestStandardCategory(
      productData.name,
      productData.description,
      productData.categories || []
    );

    if (suggestions.length === 0) {
      logger.warn(`No category suggestions found for product: ${productData.name}`);
      return results;
    }

    // 가장 높은 점수의 표준 카테고리 선택
    const bestSuggestion = suggestions[0];
    const standardCategoryId = bestSuggestion.categoryId;

    // 2. 각 플랫폼별로 매핑
    for (const platform of targetPlatforms) {
      const mappedCategory = this.mapToOpenMarketCategory(standardCategoryId, platform);

      results[platform] = {
        standardCategory: bestSuggestion.category,
        mappedCategory: mappedCategory,
        confidence: bestSuggestion.confidence,
        suggestions: suggestions
      };

      if (!mappedCategory) {
        logger.warn(`Manual category mapping required for ${platform}: ${standardCategoryId}`);
      }
    }

    return results;
  }

  /**
   * 카테고리 매핑 통계를 조회합니다
   * @returns {Object} 매핑 통계 정보
   */
  getCategoryMappingStats() {
    const stats = {
      totalMappings: this.categoryMappings.size,
      standardCategories: this.standardCategories.size,
      platformStats: {},
      lastUpdated: new Date(this.lastCacheUpdate).toISOString()
    };

    // 플랫폼별 매핑 수 계산
    for (const [key] of this.categoryMappings) {
      const [, platform] = key.split(':');
      stats.platformStats[platform] = (stats.platformStats[platform] || 0) + 1;
    }

    return stats;
  }

  /**
   * 매핑되지 않은 카테고리 목록을 조회합니다
   * @param {string} platform - 플랫폼명
   * @returns {Array} 매핑되지 않은 표준 카테고리 목록
   */
  getUnmappedCategories(platform) {
    const unmapped = [];

    for (const [categoryId, category] of this.standardCategories) {
      const mappingKey = `${categoryId}:${platform}`;
      if (!this.categoryMappings.has(mappingKey)) {
        unmapped.push({
          categoryId,
          categoryName: category.name,
          categoryPath: category.path
        });
      }
    }

    return unmapped;
  }

  /**
   * 카테고리 매핑 캐시를 새로고침합니다
   */
  async refreshCache() {
    await this.loadStandardCategories();
    await this.loadCategoryMappings();
    logger.info('Category mapping cache refreshed');
  }
}

module.exports = CategoryMappingService;
