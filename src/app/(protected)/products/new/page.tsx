/**
 * 상품 등록 페이지
 *
 * 새로운 상품을 등록하는 페이지
 * - ProductForm 컴포넌트를 사용한 상품 등록
 * - 크롤링 없이 수동 등록 지원
 *
 * Phase 3.7: 페이지 구현 - 추가 수정
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/product/ProductForm';

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

export default function ProductNewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // 상품 등록 처리
  const handleSubmit = async (formData: ProductFormData) => {
    try {
      setSubmitting(true);
      setError(null);

      // API가 기대하는 형식으로 데이터 변환
      const requestBody = {
        sourceInfo: {
          sourceUrl: formData.sourceUrl,
          sourcePlatform: formData.sourcePlatform,
        },
        originalData: {
          title: formData.title,
          description: formData.description,
          price: formData.price,
          images: formData.images,
        },
        salesSettings: {
          marginRate: formData.marginRate,
          salePrice: formData.salePrice,
          targetMarkets: formData.targetMarkets,
          autoUpdate: true,
        },
      };

      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        alert('상품이 성공적으로 등록되었습니다.');
        router.push(`/products/${result.data.id}`);
      } else {
        setError(result.error || '상품 등록에 실패했습니다.');
      }
    } catch (err) {
      setError('상품 등록 중 오류가 발생했습니다.');
      console.error('Product create error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/products');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">새 상품 등록</h1>
              <p className="mt-2 text-gray-600">
                상품 정보를 입력하여 새로운 상품을 등록합니다.
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 상품 등록 폼 */}
        <div className="bg-white shadow rounded-lg p-6">
          <ProductForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
  );
}
