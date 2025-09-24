const OpenMarketService = require('./openMarketService');
const crypto = require('crypto');

/**
 * ESM (지마켓/옥션) API 클라이언트
 * 공식 API 문서: https://etapi.gmarket.com
 */
class EsmService extends OpenMarketService {
  constructor() {
    super({
      platform: 'esm',
      baseURL: process.env.ESM_BASE_URL || 'https://etapi.gmarket.com',
      masterId: process.env.ESM_MASTER_ID,
      gmarketId: process.env.ESM_GMARKET_ID,
      auctionId: process.env.ESM_AUCTION_ID,
      apiKey: process.env.ESM_API_KEY,
      apiSecret: process.env.ESM_API_SECRET,
      timeout: 30000
    });

    if (!this.config.masterId || !this.config.apiKey || !this.config.apiSecret) {
      throw new Error('ESM_MASTER_ID, ESM_API_KEY, ESM_API_SECRET are required');
    }
  }

  /**
   * ESM API 인증 헤더를 추가합니다
   */
  async addAuthHeaders(config) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // ESM API에서 요구하는 시그니처 생성
    const signatureData = [
      config.method?.toUpperCase() || 'GET',
      encodeURIComponent(config.url || ''),
      timestamp,
      nonce,
      this.config.apiKey
    ].join('&');

    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(signatureData)
      .digest('base64');

    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': `ESM ${this.config.apiKey}:${signature}`,
      'X-ESM-Timestamp': timestamp,
      'X-ESM-Nonce': nonce,
      'X-ESM-MasterID': this.config.masterId
    };

    return config;
  }

  /**
   * 상품을 지마켓/옥션에 등록합니다
   * @param {Object} productData - 상품 데이터
   * @param {string} marketplace - 마켓플레이스 ('gmarket' 또는 'auction')
   * @returns {Promise<Object>} 등록 결과
   */
  async registerProduct(productData, marketplace = 'gmarket') {
    try {
      const sellerId = marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId;

      if (!sellerId) {
        throw new Error(`${marketplace.toUpperCase()} seller ID is not configured`);
      }

      const payload = this.transformProductData(productData, sellerId);

      const response = await this.axios.post('/api/products', payload);

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        productId: response.data?.goodsNo,
        data: response.data
      };
    } catch (error) {
      logger.error(`${marketplace} 상품 등록 실패:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 데이터를 ESM API 형식으로 변환합니다
   */
  transformProductData(productData, sellerId) {
    return {
      sellerId: sellerId,
      sellerGoodsNo: productData.sku || `AUTO_${Date.now()}`,
      goodsNm: productData.name,
      gdPrice: productData.price,
      gdOriginPrice: productData.originalPrice || productData.price,
      categoryCode: productData.categoryId,
      brandNm: productData.brand || '',
      makerNm: productData.manufacturer || '',
      modelNm: productData.model || '',
      goodsDescription: productData.description || '',
      goodsImageUrl: productData.mainImage,
      goodsImageDetailUrls: productData.additionalImages || [],
      stockQty: productData.stock || 0,
      minOrderQty: productData.minOrderQty || 1,
      maxOrderQty: productData.maxOrderQty || 999,
      adultCertYn: productData.adultProduct ? 'Y' : 'N',
      taxGubun: productData.taxType === 'FREE' ? '2' : '1', // 1: 과세, 2: 면세
      deliveryInfo: {
        deliveryType: productData.deliveryType || '1', // 1: 무료배송, 2: 착불, 3: 선불
        deliveryFee: productData.deliveryFee || 0,
        deliveryArea: '전국',
        deliveryPeriod: productData.deliveryPeriod || '1-3일'
      },
      returnExchangeInfo: {
        returnExchangeType: '1', // 1: 반품/교환가능
        returnExchangeFee: 3000,
        returnExchangePeriod: 7
      },
      saleStartDate: productData.saleStartDate || new Date().toISOString().split('T')[0],
      saleEndDate: productData.saleEndDate || null,
      optionInfo: this.transformOptions(productData.options || []),
      attributeInfo: productData.attributes || []
    };
  }

  /**
   * 상품 옵션을 변환합니다
   */
  transformOptions(options) {
    if (!Array.isArray(options) || options.length === 0) {
      return [];
    }

    return options.map((option, index) => ({
      optionNo: index + 1,
      optionName: option.name,
      optionValues: Array.isArray(option.values) ? option.values.map((value, valueIndex) => ({
        optionValueNo: valueIndex + 1,
        optionValue: value.name,
        addPrice: value.additionalPrice || 0,
        stockQty: value.stock || 0
      })) : []
    }));
  }

  /**
   * 상품을 수정합니다
   */
  async updateProduct(productId, productData, marketplace = 'gmarket') {
    try {
      const sellerId = marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId;
      const payload = this.transformProductData(productData, sellerId);
      payload.goodsNo = productId;

      const response = await this.axios.put(`/api/products/${productId}`, payload);

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error(`${marketplace} 상품 수정 실패:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품을 삭제합니다
   */
  async deleteProduct(productId, marketplace = 'gmarket') {
    try {
      const response = await this.axios.delete(`/api/products/${productId}`, {
        data: {
          sellerId: marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId
        }
      });

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error(`${marketplace} 상품 삭제 실패:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 목록을 조회합니다
   */
  async getProducts(options = {}) {
    try {
      const marketplace = options.marketplace || 'gmarket';
      const sellerId = marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId;

      const params = {
        sellerId: sellerId,
        page: options.page || 1,
        size: options.size || 20,
        searchType: options.searchType || 'ALL',
        searchKeyword: options.searchKeyword || '',
        goodsStatus: options.goodsStatus || 'ALL',
        startDate: options.startDate || this.getDateString(-30),
        endDate: options.endDate || this.getDateString(0)
      };

      const response = await this.axios.get('/api/products', { params });

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        data: response.data?.goodsList || [],
        pagination: {
          currentPage: params.page,
          totalItems: response.data?.totalCount || 0,
          totalPages: Math.ceil((response.data?.totalCount || 0) / params.size)
        }
      };
    } catch (error) {
      logger.error('ESM 상품 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 목록을 조회합니다
   */
  async getOrders(options = {}) {
    try {
      const marketplace = options.marketplace || 'gmarket';
      const sellerId = marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId;

      const params = {
        sellerId: sellerId,
        startDate: options.startDate || this.getDateString(-7),
        endDate: options.endDate || this.getDateString(0),
        orderStatus: options.orderStatus || 'ALL',
        page: options.page || 1,
        size: options.size || 20
      };

      // ESM API는 5초당 1회 호출 제한이 있음
      await this.delay(5000);

      const response = await this.axios.get('/api/orders', { params });

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        data: response.data?.orderList || [],
        pagination: {
          currentPage: params.page,
          totalItems: response.data?.totalCount || 0,
          totalPages: Math.ceil((response.data?.totalCount || 0) / params.size)
        }
      };
    } catch (error) {
      logger.error('ESM 주문 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 카테고리 목록을 조회합니다
   */
  async getCategories(marketplace = 'gmarket') {
    try {
      const params = {
        marketplace: marketplace
      };

      const response = await this.axios.get('/api/categories', { params });

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        data: response.data
      };
    } catch (error) {
      logger.error('ESM 카테고리 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 이미지를 업로드합니다
   */
  async uploadImage(imageFile, marketplace = 'gmarket') {
    try {
      const sellerId = marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId;

      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('sellerId', sellerId);

      const response = await this.axios.post('/api/images/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        imageUrl: response.data?.imageUrl
      };
    } catch (error) {
      logger.error('ESM 이미지 업로드 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 재고를 업데이트합니다
   */
  async updateInventory(productId, quantity, marketplace = 'gmarket') {
    try {
      const payload = {
        sellerId: marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId,
        goodsNo: productId,
        stockQty: quantity
      };

      const response = await this.axios.patch('/api/products/stock', payload);

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        productId: productId,
        quantity: quantity,
        data: response.data
      };
    } catch (error) {
      logger.error('ESM 재고 업데이트 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 상태를 업데이트합니다
   */
  async updateOrderStatus(orderId, status, trackingNumber = null, marketplace = 'gmarket') {
    try {
      const payload = {
        sellerId: marketplace === 'gmarket' ? this.config.gmarketId : this.config.auctionId,
        orderNo: orderId,
        orderStatus: status,
        ...(trackingNumber && {
          trackingCompany: '대한통운',
          trackingNumber: trackingNumber
        })
      };

      const response = await this.axios.patch('/api/orders/status', payload);

      return {
        success: true,
        platform: marketplace === 'gmarket' ? '지마켓' : '옥션',
        orderId: orderId,
        status: status,
        data: response.data
      };
    } catch (error) {
      logger.error('ESM 주문 상태 업데이트 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 날짜 문자열을 생성합니다 (YYYY-MM-DD 형식)
   */
  getDateString(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  /**
   * API 에러를 처리합니다
   */
  handleApiError(error) {
    const apiError = new Error(error.message || 'ESM API 요청 실패');
    apiError.platform = 'ESM';
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.details = error.response?.data;
    return apiError;
  }
}

module.exports = EsmService;