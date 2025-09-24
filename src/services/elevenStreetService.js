const OpenMarketService = require('./openMarketService');
const FormData = require('form-data');

/**
 * 11번가 오픈마켓 API 클라이언트
 * 공식 API 문서: https://openapi.11st.co.kr
 */
class ElevenStreetService extends OpenMarketService {
  constructor() {
    super({
      platform: 'elevenst',
      baseURL: process.env.ELEVENST_BASE_URL || 'https://openapi.11st.co.kr',
      apiKey: process.env.ELEVENST_API_KEY,
      apiSecret: process.env.ELEVENST_API_SECRET,
      timeout: 30000
    });

    if (!this.config.apiKey) {
      throw new Error('ELEVENST_API_KEY is required');
    }
  }

  /**
   * 11번가 API 인증 헤더를 추가합니다
   */
  async addAuthHeaders(config) {
    config.headers = {
      ...config.headers,
      'openapikey': this.config.apiKey
    };

    // POST/PUT 요청시 추가 헤더
    if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
      config.headers['Content-Type'] = 'application/json; charset=UTF-8';
    }

    return config;
  }

  /**
   * 상품을 11번가에 등록합니다
   * @param {Object} productData - 상품 데이터
   * @returns {Promise<Object>} 등록 결과
   */
  async registerProduct(productData) {
    try {
      const payload = this.transformProductData(productData);

      const response = await this.axios.post('/openapi/SellerApi/Product/ProductCreate', payload);

      return {
        success: true,
        platform: '11번가',
        productId: response.data?.productId,
        data: response.data
      };
    } catch (error) {
      logger.error('11번가 상품 등록 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 데이터를 11번가 API 형식으로 변환합니다
   */
  transformProductData(productData) {
    return {
      sellerProductId: productData.sku || `AUTO_${Date.now()}`,
      productName: productData.name,
      salePrice: productData.price,
      originalPrice: productData.originalPrice || productData.price,
      categoryId: productData.categoryId,
      brandName: productData.brand || '',
      modelName: productData.model || '',
      productDescription: productData.description || '',
      productImageUrl: productData.mainImage,
      additionalImageUrls: productData.additionalImages || [],
      stockQuantity: productData.stock || 0,
      deliveryInfo: {
        deliveryType: productData.deliveryType || 'FREE',
        deliveryFee: productData.deliveryFee || 0,
        deliveryArea: '전국',
        deliveryPeriod: productData.deliveryPeriod || '1-3일'
      },
      exchangeReturnInfo: {
        exchangeReturnType: 'EXCHANGE_RETURN_POSSIBLE',
        exchangeReturnFee: 3000,
        exchangeReturnPeriod: 7
      },
      taxType: productData.taxType || 'TAX',
      adultProductYn: 'N',
      saleStartDate: new Date().toISOString(),
      saleEndDate: productData.saleEndDate || null
    };
  }

  /**
   * 상품을 수정합니다
   */
  async updateProduct(productId, productData) {
    try {
      const payload = this.transformProductData(productData);
      payload.sellerProductId = productId;

      const response = await this.axios.put('/openapi/SellerApi/Product/ProductUpdate', payload);

      return {
        success: true,
        platform: '11번가',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('11번가 상품 수정 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품을 삭제합니다
   */
  async deleteProduct(productId) {
    try {
      const response = await this.axios.delete(`/openapi/SellerApi/Product/ProductDelete`, {
        data: { sellerProductId: productId }
      });

      return {
        success: true,
        platform: '11번가',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('11번가 상품 삭제 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 목록을 조회합니다
   */
  async getProducts(options = {}) {
    try {
      const params = {
        page: options.page || 1,
        size: options.size || 20,
        searchType: options.searchType || 'ALL',
        searchKeyword: options.searchKeyword || '',
        statusCode: options.statusCode || 'ALL'
      };

      const response = await this.axios.get('/openapi/SellerApi/Product/ProductList', { params });

      return {
        success: true,
        platform: '11번가',
        data: response.data,
        pagination: {
          currentPage: params.page,
          totalItems: response.data?.totalCount || 0,
          totalPages: Math.ceil((response.data?.totalCount || 0) / params.size)
        }
      };
    } catch (error) {
      logger.error('11번가 상품 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 목록을 조회합니다
   */
  async getOrders(options = {}) {
    try {
      const params = {
        startDate: options.startDate || this.getDateString(-30), // 30일 전
        endDate: options.endDate || this.getDateString(0),
        orderStatus: options.orderStatus || 'ALL',
        page: options.page || 1,
        size: options.size || 20
      };

      const response = await this.axios.get('/openapi/SellerApi/Order/OrderList', { params });

      return {
        success: true,
        platform: '11번가',
        data: response.data,
        pagination: {
          currentPage: params.page,
          totalItems: response.data?.totalCount || 0,
          totalPages: Math.ceil((response.data?.totalCount || 0) / params.size)
        }
      };
    } catch (error) {
      logger.error('11번가 주문 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 카테고리 목록을 조회합니다
   */
  async getCategories() {
    try {
      const response = await this.axios.get('/openapi/OpenApiService/CategoryService/CategoryList');

      return {
        success: true,
        platform: '11번가',
        data: response.data
      };
    } catch (error) {
      logger.error('11번가 카테고리 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 이미지를 업로드합니다
   */
  async uploadImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await this.axios.post('/openapi/SellerApi/Product/ImageUpload', formData, {
        headers: {
          ...formData.getHeaders(),
          'openapikey': this.config.apiKey
        }
      });

      return {
        success: true,
        platform: '11번가',
        imageUrl: response.data?.imageUrl
      };
    } catch (error) {
      logger.error('11번가 이미지 업로드 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 재고를 업데이트합니다
   */
  async updateInventory(productId, quantity) {
    try {
      const payload = {
        sellerProductId: productId,
        stockQuantity: quantity
      };

      const response = await this.axios.post('/openapi/SellerApi/Product/StockUpdate', payload);

      return {
        success: true,
        platform: '11번가',
        productId: productId,
        quantity: quantity,
        data: response.data
      };
    } catch (error) {
      logger.error('11번가 재고 업데이트 실패:', error);
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
    const apiError = new Error(error.message || '11번가 API 요청 실패');
    apiError.platform = '11번가';
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.details = error.response?.data;
    return apiError;
  }
}

module.exports = ElevenStreetService;