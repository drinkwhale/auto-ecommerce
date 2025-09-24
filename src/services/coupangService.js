const OpenMarketService = require('./openMarketService');
const crypto = require('crypto');

/**
 * 쿠팡 오픈마켓 API 클라이언트
 * 공식 API 문서: https://developers.coupangcorp.com
 */
class CoupangService extends OpenMarketService {
  constructor() {
    super({
      platform: 'coupang',
      baseURL: process.env.COUPANG_BASE_URL || 'https://api-gateway.coupang.com',
      accessKey: process.env.COUPANG_ACCESS_KEY,
      secretKey: process.env.COUPANG_SECRET_KEY,
      vendorId: process.env.COUPANG_VENDOR_ID,
      timeout: 30000
    });

    if (!this.config.accessKey || !this.config.secretKey || !this.config.vendorId) {
      throw new Error('COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, COUPANG_VENDOR_ID are required');
    }
  }

  /**
   * 쿠팡 API HMAC 인증 헤더를 추가합니다
   */
  async addAuthHeaders(config) {
    const timestamp = Date.now().toString();
    const method = (config.method || 'GET').toUpperCase();
    const path = this.getPathFromUrl(config.url || '');
    const query = this.getQueryFromUrl(config.url || '');

    // Authorization 생성을 위한 문자열
    let message = timestamp + method + path + this.config.accessKey;

    // POST/PUT 요청시 body 추가
    if (config.data && typeof config.data === 'string') {
      message += config.data;
    } else if (config.data && typeof config.data === 'object') {
      message += JSON.stringify(config.data);
    }

    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(message)
      .digest('hex');

    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json;charset=UTF-8',
      'Authorization': `CEA algorithm=HmacSHA256, access-key=${this.config.accessKey}, signed-date=${timestamp}, signature=${signature}`,
      'X-EXTENDED-TIMEOUT': '90000'
    };

    return config;
  }

  /**
   * URL에서 path를 추출합니다
   */
  getPathFromUrl(url) {
    try {
      const urlObject = new URL(url, this.config.baseURL);
      return urlObject.pathname;
    } catch {
      return url.split('?')[0];
    }
  }

  /**
   * URL에서 query string을 추출합니다
   */
  getQueryFromUrl(url) {
    try {
      const urlObject = new URL(url, this.config.baseURL);
      return urlObject.search;
    } catch {
      const parts = url.split('?');
      return parts.length > 1 ? '?' + parts[1] : '';
    }
  }

  /**
   * 상품을 쿠팡에 등록합니다
   * @param {Object} productData - 상품 데이터
   * @returns {Promise<Object>} 등록 결과
   */
  async registerProduct(productData) {
    try {
      // 쿠팡 상품 등록을 위한 복잡한 데이터 구조
      const payload = this.transformProductData(productData);

      const response = await this.axios.post(
        `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`,
        payload
      );

      return {
        success: true,
        platform: '쿠팡',
        productId: response.data?.vendorItemId,
        data: response.data
      };
    } catch (error) {
      logger.error('쿠팡 상품 등록 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 데이터를 쿠팡 API 형식으로 변환합니다
   */
  transformProductData(productData) {
    return {
      sellerProductName: productData.name,
      vendorItemId: productData.sku || `AUTO_${Date.now()}`,
      saleStartedAt: new Date().toISOString(),
      saleEndedAt: productData.saleEndDate || null,
      displayCategoryCode: productData.categoryId,
      sellerProductId: productData.sku || `AUTO_${Date.now()}`,
      generalProductInfoProvidedNoticeView: {
        productInfoProvidedNoticeView: {
          productName: productData.name,
          modelName: productData.model || '',
          certificationsView: [],
          materialComponentInfoView: {
            materialComponents: productData.materials || []
          },
          sizeWeightInfoView: {
            packageSizeWidth: productData.packageWidth || 0,
            packageSizeLength: productData.packageLength || 0,
            packageSizeHeight: productData.packageHeight || 0,
            packageWeight: productData.packageWeight || 0
          },
          manufacturerInfoView: {
            manufacturerName: productData.manufacturer || '',
            manufacturerAddress: productData.manufacturerAddress || '',
            importerName: productData.importer || '',
            importerAddress: productData.importerAddress || ''
          },
          afterServiceContactInfoView: {
            afterServiceTelephone1: productData.afterServicePhone || ''
          }
        }
      },
      items: [
        {
          itemName: productData.name,
          originalPrice: productData.originalPrice || productData.price,
          salePrice: productData.price,
          maximumBuyCount: productData.maxBuyCount || 999,
          outboundShippingTimeDay: productData.shippingDays || 1,
          maximumBuyCountPer24h: productData.maxBuyCountPer24h || 999,
          unitCount: 1,
          adultProduct: false,
          taxType: productData.taxType === 'FREE' ? 'TAX_FREE' : 'TAX',
          parallelImported: productData.parallelImported || false,
          overseasPurchased: productData.overseasPurchased || false,
          pccNeeded: false,
          externalVendorSku: productData.sku || `AUTO_${Date.now()}`,
          barcode: productData.barcode || '',
          modelNo: productData.model || '',
          extraProperties: {},
          certifications: [],
          searchTags: productData.searchTags || [],
          images: this.transformImages(productData),
          notices: [],
          attributes: [],
          contents: {
            contentsType: 'TEXT',
            contentDetails: [
              {
                content: productData.description || '',
                detailType: 'TEXT'
              }
            ]
          },
          shipping: {
            leadTimeType: 'CUSTOM',
            splitShippingType: 'UNSPLITTABLE'
          }
        }
      ]
    };
  }

  /**
   * 이미지 데이터를 변환합니다
   */
  transformImages(productData) {
    const images = [];

    if (productData.mainImage) {
      images.push({
        imageOrder: 1,
        imageType: 'REPRESENTATION',
        cdnPath: productData.mainImage
      });
    }

    if (productData.additionalImages && Array.isArray(productData.additionalImages)) {
      productData.additionalImages.forEach((imageUrl, index) => {
        images.push({
          imageOrder: index + 2,
          imageType: 'DETAIL',
          cdnPath: imageUrl
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
        `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${productId}`,
        payload
      );

      return {
        success: true,
        platform: '쿠팡',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('쿠팡 상품 수정 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품을 삭제합니다
   */
  async deleteProduct(productId) {
    try {
      const response = await this.axios.delete(
        `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${productId}`
      );

      return {
        success: true,
        platform: '쿠팡',
        productId: productId,
        data: response.data
      };
    } catch (error) {
      logger.error('쿠팡 상품 삭제 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 상품 목록을 조회합니다
   */
  async getProducts(options = {}) {
    try {
      const params = {
        nextToken: options.nextToken || '',
        maxPerPage: options.maxPerPage || 50,
        status: options.status || 'APPROVED'
      };

      const response = await this.axios.get(
        `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`,
        { params }
      );

      return {
        success: true,
        platform: '쿠팡',
        data: response.data,
        nextToken: response.data?.nextToken
      };
    } catch (error) {
      logger.error('쿠팡 상품 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 주문 목록을 조회합니다
   */
  async getOrders(options = {}) {
    try {
      const params = {
        createdAtFrom: options.startDate || this.getIsoDateString(-7), // 7일 전
        createdAtTo: options.endDate || this.getIsoDateString(0),
        status: options.status || '',
        nextToken: options.nextToken || '',
        maxPerPage: options.maxPerPage || 50
      };

      const response = await this.axios.get(
        `/v2/providers/seller_api/apis/api/v1/marketplace/orders`,
        { params }
      );

      return {
        success: true,
        platform: '쿠팡',
        data: response.data,
        nextToken: response.data?.nextToken
      };
    } catch (error) {
      logger.error('쿠팡 주문 목록 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 카테고리 목록을 조회합니다
   */
  async getCategories() {
    try {
      const response = await this.axios.get(
        `/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes`
      );

      return {
        success: true,
        platform: '쿠팡',
        data: response.data
      };
    } catch (error) {
      logger.error('쿠팡 카테고리 조회 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 이미지를 업로드합니다
   */
  async uploadImage(imageFile) {
    try {
      // 쿠팡의 경우 이미지 업로드는 별도의 CDN 서비스를 사용
      // 실제 구현시에는 이미지를 먼저 외부 CDN에 업로드한 후 URL을 사용해야 함
      throw new Error('쿠팡 이미지 업로드는 외부 CDN을 통해 처리해야 합니다.');
    } catch (error) {
      logger.error('쿠팡 이미지 업로드 실패:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * 재고를 업데이트합니다
   */
  async updateInventory(productId, quantity) {
    try {
      const payload = {
        inventoryQuantity: quantity
      };

      const response = await this.axios.put(
        `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${productId}/inventory`,
        payload
      );

      return {
        success: true,
        platform: '쿠팡',
        productId: productId,
        quantity: quantity,
        data: response.data
      };
    } catch (error) {
      logger.error('쿠팡 재고 업데이트 실패:', error);
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
    const apiError = new Error(error.message || '쿠팡 API 요청 실패');
    apiError.platform = '쿠팡';
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.details = error.response?.data;
    return apiError;
  }
}

module.exports = CoupangService;