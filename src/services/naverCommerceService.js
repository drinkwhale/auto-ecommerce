const OpenMarketService = require('./openMarketService');

/**
 * 네이버 커머스 API 클라이언트 (스마트스토어)
 * 공식 API 문서: https://apicenter.commerce.naver.com
 */
class NaverCommerceService extends OpenMarketService {
  constructor() {
    super({
      platform: 'naver',
      baseURL: process.env.NAVER_BASE_URL || 'https://api.commerce.naver.com',
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
      channelUid: process.env.NAVER_CHANNEL_UID,
      timeout: 30000
    });

    if (!this.config.clientId || !this.config.clientSecret || !this.config.channelUid) {
      throw new Error('NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, NAVER_CHANNEL_UID are required');
    }

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * OAuth 액세스 토큰을 획득합니다
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await this.axios.post('/v1/oauth2/token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1분 여유

      return this.accessToken;
    } catch (error) {
      logger.error('네이버 액세스 토큰 획득 실패:', error);
      throw error;
    }
  }

  /**
   * 네이버 커머스 API 인증 헤더를 추가합니다
   */
  async addAuthHeaders(config) {
    const token = await this.getAccessToken();

    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    return config;
  }

  /**
   * 상품을 네이버 스마트스토어에 등록합니다
   * @param {Object} productData - 상품 데이터
   * @returns {Promise<Object>} 등록 결과
   */
  async registerProduct(productData) {
    try {
      const payload = this.transformProductData(productData);

      const response = await this.axios.post(
        `/external/v2/eco/products/channel-products`,
        payload
      );

      return {
        success: true,
        platform: '네이버',
        productId: response.data?.channelProductId,
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 상품 등록 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 데이터를 네이버 커머스 API 형식으로 변환합니다
   */
  transformProductData(productData) {
    return {
      channelServiceType: 'STOREFARM',
      channelProductDisplayStatusType: 'ON',
      channelUid: this.config.channelUid,
      channelProductName: productData.name,
      channelProductDescription: productData.description || '',
      channelProductImages: this.transformImages(productData),
      channelProductSalePrice: productData.price,
      channelProductDiscountPrice: productData.discountPrice || null,
      channelProductStockQuantity: productData.stock || 0,
      channelProductCategoryId: productData.categoryId,
      channelProductAttributes: productData.attributes || [],
      channelProductSellerProductCode: productData.sku || `AUTO_${Date.now()}`,
      channelProductDeliveryInfo: {
        deliveryType: productData.deliveryType || 'DELIVERY',
        baseFee: productData.deliveryFee || 0,
        deliveryAttributeType: productData.deliveryAttributeType || 'NORMAL',
        deliveryCompany: productData.deliveryCompany || '',
        deliveryBundleGroupId: productData.deliveryBundleGroupId || null
      },
      channelProductExchangeReturnInfo: {
        exchangeReturnDeliveryCompanyType: 'SELLER',
        exchangeDeliveryFee: productData.exchangeDeliveryFee || 3000,
        returnDeliveryFee: productData.returnDeliveryFee || 3000,
        remoteAreaExchangeDeliveryFee: productData.remoteAreaExchangeDeliveryFee || 0,
        remoteAreaReturnDeliveryFee: productData.remoteAreaReturnDeliveryFee || 0,
        exchangeReturnInfoText: productData.exchangeReturnInfoText || '교환/반환 정보'
      },
      channelProductSaleStartDate: productData.saleStartDate || new Date().toISOString(),
      channelProductSaleEndDate: productData.saleEndDate || null,
      adultProduct: productData.adultProduct || false,
      taxType: productData.taxType || 'TAX'
    };
  }

  /**
   * 이미지 데이터를 변환합니다
   */
  transformImages(productData) {
    const images = [];

    if (productData.mainImage) {
      images.push({
        imageUrl: productData.mainImage,
        imageType: 'MAIN'
      });
    }

    if (productData.additionalImages && Array.isArray(productData.additionalImages)) {
      productData.additionalImages.forEach((imageUrl) => {
        images.push({
          imageUrl: imageUrl,
          imageType: 'ADDITIONAL'
        });
      });
    }

    return images;
  }

  /**
   * 상품을 수정합니다
   */
  async updateProduct(productId, productData) {
    try {
      const payload = this.transformProductData(productData);

      const response = await this.axios.put(
        `/external/v2/eco/products/channel-products/${productId}`,
        payload
      );

      return {
        success: true,
        platform: '네이버',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 상품 수정 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품을 삭제합니다
   */
  async deleteProduct(productId) {
    try {
      const response = await this.axios.delete(
        `/external/v2/eco/products/channel-products/${productId}`
      );

      return {
        success: true,
        platform: '네이버',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 상품 삭제 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 목록을 조회합니다
   */
  async getProducts(options = {}) {
    try {
      const params = {
        lastChannelProductId: options.lastChannelProductId || '',
        size: options.size || 50,
        channelProductDisplayStatusType: options.displayStatus || 'ALL'
      };

      const response = await this.axios.get(
        `/external/v2/eco/products/channel-products`,
        { params }
      );

      return {
        success: true,
        platform: '네이버',
        data: response.data?.channelProducts || [],
        lastChannelProductId: response.data?.lastChannelProductId
      };
    } catch (error) {
      logger.error('네이버 상품 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 목록을 조회합니다
   */
  async getOrders(options = {}) {
    try {
      const params = {
        lastChangeDate: options.lastChangeDate || this.getIsoDateString(-7),
        size: options.size || 50,
        searchDateType: options.searchDateType || 'ORDER_REQUEST_DATE'
      };

      const response = await this.axios.get(
        `/external/v1/pay-order/seller/orders`,
        { params }
      );

      return {
        success: true,
        platform: '네이버',
        data: response.data?.orders || [],
        lastChangeDate: response.data?.lastChangeDate
      };
    } catch (error) {
      logger.error('네이버 주문 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 카테고리 목록을 조회합니다
   */
  async getCategories() {
    try {
      const response = await this.axios.get(
        `/external/v2/eco/products/categories`
      );

      return {
        success: true,
        platform: '네이버',
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 카테고리 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 이미지를 업로드합니다
   */
  async uploadImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('imageFile', imageFile);

      const response = await this.axios.post(
        `/external/v1/product-images/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${await this.getAccessToken()}`
          }
        }
      );

      return {
        success: true,
        platform: '네이버',
        imageUrl: response.data?.imageUrl
      };
    } catch (error) {
      logger.error('네이버 이미지 업로드 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 재고를 업데이트합니다
   */
  async updateInventory(productId, quantity) {
    try {
      const payload = {
        channelProductStockQuantity: quantity
      };

      const response = await this.axios.patch(
        `/external/v2/eco/products/channel-products/${productId}/stock`,
        payload
      );

      return {
        success: true,
        platform: '네이버',
        productId: productId,
        quantity: quantity,
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 재고 업데이트 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 상태를 업데이트합니다
   */
  async updateOrderStatus(orderId, status, trackingNumber = null) {
    try {
      const payload = {
        orderStatusType: status,
        ...(trackingNumber && { trackingNumber })
      };

      const response = await this.axios.patch(
        `/external/v1/pay-order/seller/orders/${orderId}/status`,
        payload
      );

      return {
        success: true,
        platform: '네이버',
        orderId: orderId,
        status: status,
        data: response.data
      };
    } catch (error) {
      logger.error('네이버 주문 상태 업데이트 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * ISO 날짜 문자열을 생성합니다
   */
  getIsoDateString(daysOffset) {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString();
  }

  /**
   * API 에러를 처리합니다
   */
  handleApiError(error) {
    const apiError = new Error(error.message || '네이버 커머스 API 요청 실패');
    apiError.platform = '네이버';
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.details = error.response?.data;
    return apiError;
  }
}

module.exports = NaverCommerceService;