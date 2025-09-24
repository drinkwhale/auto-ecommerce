const Joi = require('joi');
const { Fail } = require('../utils/response');

/**
 * 상품 데이터 스키마 정의
 */
const productSchema = Joi.object({
  sku: Joi.string().max(50).optional(),
  name: Joi.string().min(1).max(200).required(),
  price: Joi.number().positive().required(),
  originalPrice: Joi.number().positive().optional(),
  description: Joi.string().min(10).max(5000).required(),
  brand: Joi.string().max(100).optional(),
  manufacturer: Joi.string().max(100).optional(),
  model: Joi.string().max(100).optional(),
  stock: Joi.number().integer().min(0).optional(),
  categories: Joi.array().items(Joi.string()).optional(),
  images: Joi.array().items(Joi.string().uri()).max(10).optional(),
  deliveryFee: Joi.number().min(0).optional(),
  deliveryType: Joi.string().valid('FREE', 'PAID', 'CONDITIONAL_FREE').optional(),
  deliveryPeriod: Joi.string().max(50).optional(),
  taxType: Joi.string().valid('TAX', 'FREE').optional(),
  adultProduct: Joi.boolean().optional(),
  saleStartDate: Joi.date().iso().optional(),
  saleEndDate: Joi.date().iso().min(Joi.ref('saleStartDate')).optional(),
  maxBuyCount: Joi.number().integer().positive().optional(),
  minBuyCount: Joi.number().integer().positive().optional(),
  keywords: Joi.array().items(Joi.string()).optional(),
  attributes: Joi.array().items(Joi.object()).optional(),
  options: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    values: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      additionalPrice: Joi.number().optional(),
      stock: Joi.number().integer().min(0).optional()
    })).required()
  })).optional()
});

/**
 * 플랫폼 스키마 정의
 */
const platformSchema = Joi.array()
  .items(Joi.string().valid('elevenst', 'coupang', 'naver', 'esm'))
  .min(1)
  .max(4)
  .unique()
  .required();

/**
 * 등록 옵션 스키마 정의
 */
const optionsSchema = Joi.object({
  skipCategoryValidation: Joi.boolean().optional(),
  esmMarketplace: Joi.string().valid('gmarket', 'auction').optional(),
  batchIndex: Joi.number().optional(),
  priority: Joi.string().valid('low', 'normal', 'high').optional(),
  tags: Joi.array().items(Joi.string()).optional()
}).optional();

/**
 * 재고 업데이트 스키마 정의
 */
const inventoryUpdateSchema = Joi.object({
  productSku: Joi.string().required(),
  quantity: Joi.number().integer().min(0).required(),
  platforms: Joi.array()
    .items(Joi.string().valid('elevenst', 'coupang', 'naver', 'esm'))
    .min(1)
    .unique()
    .required()
});

/**
 * 상품 데이터 검증 미들웨어
 */
const validateProductData = (req, res, next) => {
  try {
    const { productData, platforms, options } = req.body;

    // productData 검증
    if (!productData) {
      return res.status(400).json(
        Fail('Product data is required')
      );
    }

    const { error: productError, value: validatedProduct } = productSchema.validate(productData, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (productError) {
      const errorMessages = productError.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json(
        Fail('Product data validation failed', errorMessages)
      );
    }

    // platforms 검증
    const { error: platformError, value: validatedPlatforms } = platformSchema.validate(platforms);

    if (platformError) {
      return res.status(400).json(
        Fail('Invalid platforms data', platformError.details.map(d => d.message))
      );
    }

    // options 검증
    let validatedOptions = {};
    if (options) {
      const { error: optionsError, value: validatedOpts } = optionsSchema.validate(options);

      if (optionsError) {
        return res.status(400).json(
          Fail('Invalid options data', optionsError.details.map(d => d.message))
        );
      }

      validatedOptions = validatedOpts;
    }

    // 추가 비즈니스 로직 검증
    const businessValidationErrors = validateBusinessRules(validatedProduct, validatedPlatforms, validatedOptions);

    if (businessValidationErrors.length > 0) {
      return res.status(400).json(
        Fail('Business rule validation failed', businessValidationErrors)
      );
    }

    // multipart/form-data로 전송된 이미지 파일 처리
    if (req.files && req.files.length > 0) {
      validatedProduct.imageFiles = req.files;
    }

    // 검증된 데이터로 교체
    req.body.productData = validatedProduct;
    req.body.platforms = validatedPlatforms;
    req.body.options = validatedOptions;

    next();

  } catch (error) {
    return res.status(500).json(
      Fail('Validation error', error.message)
    );
  }
};

/**
 * 배치 데이터 검증 미들웨어
 */
const validateBatchData = (req, res, next) => {
  try {
    const { products, platforms, options } = req.body;

    // products 배열 검증
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

    // 각 상품 데이터 검증
    const validationErrors = [];
    const validatedProducts = [];

    for (let i = 0; i < products.length; i++) {
      const { error, value } = productSchema.validate(products[i], {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        validationErrors.push({
          productIndex: i,
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      } else {
        validatedProducts.push(value);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json(
        Fail('Products validation failed', validationErrors)
      );
    }

    // platforms 검증
    const { error: platformError, value: validatedPlatforms } = platformSchema.validate(platforms);

    if (platformError) {
      return res.status(400).json(
        Fail('Invalid platforms data', platformError.details.map(d => d.message))
      );
    }

    // options 검증
    let validatedOptions = {};
    if (options) {
      const { error: optionsError, value: validatedOpts } = optionsSchema.validate(options);

      if (optionsError) {
        return res.status(400).json(
          Fail('Invalid options data', optionsError.details.map(d => d.message))
        );
      }

      validatedOptions = validatedOpts;
    }

    // SKU 중복 검사
    const skus = validatedProducts.map(p => p.sku).filter(Boolean);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);

    if (duplicateSkus.length > 0) {
      return res.status(400).json(
        Fail('Duplicate SKUs found in batch', { duplicateSkus })
      );
    }

    // 검증된 데이터로 교체
    req.body.products = validatedProducts;
    req.body.platforms = validatedPlatforms;
    req.body.options = validatedOptions;

    next();

  } catch (error) {
    return res.status(500).json(
      Fail('Batch validation error', error.message)
    );
  }
};

/**
 * 재고 데이터 검증 미들웨어
 */
const validateInventoryData = (req, res, next) => {
  try {
    const { inventoryUpdates } = req.body;

    if (!Array.isArray(inventoryUpdates) || inventoryUpdates.length === 0) {
      return res.status(400).json(
        Fail('Inventory updates array is required and must not be empty')
      );
    }

    if (inventoryUpdates.length > 100) {
      return res.status(400).json(
        Fail('Maximum 100 inventory updates allowed per request')
      );
    }

    // 각 재고 업데이트 데이터 검증
    const validationErrors = [];
    const validatedUpdates = [];

    for (let i = 0; i < inventoryUpdates.length; i++) {
      const { error, value } = inventoryUpdateSchema.validate(inventoryUpdates[i], {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        validationErrors.push({
          updateIndex: i,
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }))
        });
      } else {
        validatedUpdates.push(value);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json(
        Fail('Inventory updates validation failed', validationErrors)
      );
    }

    // 중복 SKU + Platform 조합 검사
    const combinations = [];
    for (const update of validatedUpdates) {
      for (const platform of update.platforms) {
        const combo = `${update.productSku}:${platform}`;
        if (combinations.includes(combo)) {
          return res.status(400).json(
            Fail('Duplicate SKU-Platform combination found', { combination: combo })
          );
        }
        combinations.push(combo);
      }
    }

    // 검증된 데이터로 교체
    req.body.inventoryUpdates = validatedUpdates;

    next();

  } catch (error) {
    return res.status(500).json(
      Fail('Inventory validation error', error.message)
    );
  }
};

/**
 * 비즈니스 룰 검증
 * @param {Object} productData - 상품 데이터
 * @param {Array} platforms - 플랫폼 목록
 * @param {Object} options - 옵션
 * @returns {Array} 검증 에러 목록
 */
const validateBusinessRules = (productData, platforms, options) => {
  const errors = [];

  // 1. 가격 검증
  if (productData.originalPrice && productData.price > productData.originalPrice) {
    errors.push({
      rule: 'price_validation',
      message: 'Sale price cannot be higher than original price',
      field: 'price'
    });
  }

  // 2. 날짜 검증
  if (productData.saleStartDate && productData.saleEndDate) {
    const startDate = new Date(productData.saleStartDate);
    const endDate = new Date(productData.saleEndDate);

    if (startDate >= endDate) {
      errors.push({
        rule: 'date_validation',
        message: 'Sale end date must be after sale start date',
        field: 'saleEndDate'
      });
    }

    if (startDate < new Date()) {
      errors.push({
        rule: 'date_validation',
        message: 'Sale start date cannot be in the past',
        field: 'saleStartDate'
      });
    }
  }

  // 3. 최소/최대 구매 수량 검증
  if (productData.minBuyCount && productData.maxBuyCount) {
    if (productData.minBuyCount > productData.maxBuyCount) {
      errors.push({
        rule: 'buy_count_validation',
        message: 'Minimum buy count cannot be greater than maximum buy count',
        field: 'minBuyCount'
      });
    }
  }

  // 4. 재고와 최소 구매 수량 검증
  if (productData.stock !== undefined && productData.minBuyCount) {
    if (productData.stock < productData.minBuyCount) {
      errors.push({
        rule: 'stock_validation',
        message: 'Stock quantity must be at least equal to minimum buy count',
        field: 'stock'
      });
    }
  }

  // 5. ESM 플랫폼 사용시 마켓플레이스 선택 검증
  if (platforms.includes('esm') && !options.esmMarketplace) {
    errors.push({
      rule: 'esm_marketplace_required',
      message: 'ESM marketplace (gmarket or auction) must be specified',
      field: 'esmMarketplace'
    });
  }

  // 6. 상품 옵션 검증
  if (productData.options && Array.isArray(productData.options)) {
    for (let i = 0; i < productData.options.length; i++) {
      const option = productData.options[i];

      if (!option.values || option.values.length === 0) {
        errors.push({
          rule: 'option_validation',
          message: `Option ${option.name} must have at least one value`,
          field: `options[${i}].values`
        });
      }

      // 옵션 값 중복 검사
      const optionValueNames = option.values.map(v => v.name);
      const duplicateValues = optionValueNames.filter((name, index) =>
        optionValueNames.indexOf(name) !== index
      );

      if (duplicateValues.length > 0) {
        errors.push({
          rule: 'option_validation',
          message: `Duplicate option values found: ${duplicateValues.join(', ')}`,
          field: `options[${i}].values`
        });
      }
    }
  }

  // 7. 이미지 수량 검증
  if (productData.images && productData.images.length > 10) {
    errors.push({
      rule: 'image_validation',
      message: 'Maximum 10 images allowed per product',
      field: 'images'
    });
  }

  return errors;
};

module.exports = {
  validateProductData,
  validateBatchData,
  validateInventoryData,
  validateBusinessRules
};