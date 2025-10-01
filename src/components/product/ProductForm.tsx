/**
 * ProductForm 컴포넌트
 *
 * 상품 등록/수정 폼 컴포넌트
 * - 다단계 폼
 * - 유효성 검증
 * - 이미지 미리보기
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T048
 */

'use client';

import { useState } from 'react';

interface ProductFormData {
  sourceUrl: string;
  sourcePlatform: 'TAOBAO' | 'AMAZON' | 'ALIBABA';
  title: string;
  description: string;
  price: number;
  images: string[];
  marginRate: number;
  salePrice?: number;
  targetMarkets: string[];
}

interface ProductFormProps {
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  mode = 'create',
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    sourceUrl: initialData?.sourceUrl || '',
    sourcePlatform: initialData?.sourcePlatform || 'TAOBAO',
    title: initialData?.title || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    images: initialData?.images || [],
    marginRate: initialData?.marginRate || 30,
    salePrice: initialData?.salePrice,
    targetMarkets: initialData?.targetMarkets || [],
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const finalValue =
      type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value;

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    // 마진율 변경 시 판매가 자동 계산
    if (name === 'marginRate' || name === 'price') {
      const newMarginRate =
        name === 'marginRate' ? parseFloat(value) : formData.marginRate;
      const newPrice = name === 'price' ? parseFloat(value) : formData.price;
      const calculatedSalePrice = newPrice * (1 + newMarginRate / 100);

      setFormData((prev) => ({
        ...prev,
        [name]: finalValue,
        salePrice: Math.round(calculatedSalePrice),
      }));
    }

    // 에러 초기화
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.sourceUrl) {
      newErrors.sourceUrl = '소스 URL을 입력해주세요.';
    }
    if (!formData.title) {
      newErrors.title = '상품명을 입력해주세요.';
    }
    if (formData.price <= 0) {
      newErrors.price = '가격은 0보다 커야 합니다.';
    }
    if (formData.marginRate < 0 || formData.marginRate > 100) {
      newErrors.marginRate = '마진율은 0-100 사이여야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-gray-900">
        {mode === 'create' ? '상품 등록' : '상품 수정'}
      </h2>

      {/* 소스 정보 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">소스 정보</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            소스 플랫폼 *
          </label>
          <select
            name="sourcePlatform"
            value={formData.sourcePlatform}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TAOBAO">타오바오</option>
            <option value="AMAZON">아마존</option>
            <option value="ALIBABA">알리바바</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            소스 URL *
          </label>
          <input
            type="url"
            name="sourceUrl"
            value={formData.sourceUrl}
            onChange={handleChange}
            placeholder="https://..."
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.sourceUrl ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.sourceUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.sourceUrl}</p>
          )}
        </div>
      </div>

      {/* 상품 정보 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">상품 정보</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상품명 *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="상품명을 입력하세요"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상품 설명
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="상품 설명을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              원가 *
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              마진율 (%) *
            </label>
            <input
              type="number"
              name="marginRate"
              value={formData.marginRate}
              onChange={handleChange}
              min="0"
              max="100"
              step="1"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.marginRate ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.marginRate && (
              <p className="mt-1 text-sm text-red-600">{errors.marginRate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              판매가
            </label>
            <input
              type="number"
              name="salePrice"
              value={formData.salePrice || 0}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '처리중...' : mode === 'create' ? '등록' : '저장'}
        </button>
      </div>
    </form>
  );
}

export default ProductForm;