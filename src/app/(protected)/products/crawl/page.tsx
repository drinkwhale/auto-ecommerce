/**
 * 상품 크롤링 페이지
 *
 * 외부 쇼핑몰 URL로부터 상품을 크롤링하는 페이지
 * - URL 입력 및 플랫폼 자동 감지
 * - 크롤링 옵션 설정 (번역, 이미지 처리, 마진율)
 * - 실시간 크롤링 진행 상태 표시
 *
 * Phase 3.7: 페이지 구현 - 추가 (크롤링 페이지 누락 수정)
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Platform = 'TAOBAO' | 'AMAZON' | 'ALIBABA' | null;

interface CrawlPreview {
  url: string;
  platform: Platform;
  isSupported: boolean;
  isDuplicate: boolean;
  existingProduct?: {
    id: string;
    status: string;
    title: string;
    createdAt: string;
  };
}

export default function ProductCrawlPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<CrawlPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 크롤링 옵션
  const [options, setOptions] = useState({
    autoTranslate: true,
    processImages: true,
    marginRate: 30,
  });

  // 인증 확인
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // URL 미리보기 (플랫폼 감지 및 중복 확인)
  const handleCheckUrl = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPreview(null);

      const response = await fetch(`/api/v1/products/crawl?url=${encodeURIComponent(url)}`);
      const result = await response.json();

      if (result.success) {
        setPreview(result.data);
      } else {
        setError(result.error || 'URL 확인 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('URL 확인 중 오류가 발생했습니다.');
      console.error('URL check error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 크롤링 시작
  const handleStartCrawl = async () => {
    if (!preview || !preview.platform) {
      setError('먼저 URL을 확인해주세요.');
      return;
    }

    if (preview.isDuplicate) {
      setError('이미 등록된 상품입니다.');
      return;
    }

    try {
      setCrawling(true);
      setError(null);

      const response = await fetch('/api/v1/products/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          platform: preview.platform,
          options,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`크롤링이 시작되었습니다. (예상 시간: ${result.data.estimatedTime})`);
        router.push(`/products/${result.data.productId}`);
      } else {
        setError(result.error || '크롤링 시작에 실패했습니다.');
      }
    } catch (err) {
      setError('크롤링 시작 중 오류가 발생했습니다.');
      console.error('Crawl start error:', err);
    } finally {
      setCrawling(false);
    }
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
              <h1 className="text-3xl font-bold text-gray-900">상품 크롤링</h1>
              <p className="mt-2 text-gray-600">
                타오바오, 아마존, 알리바바 상품 URL을 입력하여 자동으로 상품을 등록합니다.
              </p>
            </div>
            <button
              onClick={() => router.push('/products')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              목록으로
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

        {/* URL 입력 폼 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 URL 입력</h2>

          <div className="space-y-4">
            {/* URL 입력 */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                상품 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://item.taobao.com/item.htm?id=..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 border"
                  disabled={loading || crawling}
                />
                <button
                  onClick={handleCheckUrl}
                  disabled={loading || crawling || !url}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? '확인 중...' : 'URL 확인'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                지원 플랫폼: Taobao, Tmall, Amazon, Alibaba, 1688
              </p>
            </div>
          </div>
        </div>

        {/* URL 미리보기 */}
        {preview && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">URL 정보</h2>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">플랫폼:</span>
                <span className="text-sm text-gray-900 font-semibold">{preview.platform}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">지원 여부:</span>
                <span className={`text-sm font-semibold ${preview.isSupported ? 'text-green-600' : 'text-red-600'}`}>
                  {preview.isSupported ? '✓ 지원됨' : '✗ 지원되지 않음'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">중복 확인:</span>
                <span className={`text-sm font-semibold ${preview.isDuplicate ? 'text-orange-600' : 'text-green-600'}`}>
                  {preview.isDuplicate ? '⚠ 이미 등록됨' : '✓ 신규 상품'}
                </span>
              </div>

              {preview.isDuplicate && preview.existingProduct && (
                <div className="mt-4 p-4 bg-orange-50 rounded-md">
                  <p className="text-sm font-medium text-orange-800 mb-2">기존 상품 정보</p>
                  <div className="space-y-1 text-sm text-orange-700">
                    <p>제목: {preview.existingProduct.title}</p>
                    <p>상태: {preview.existingProduct.status}</p>
                    <p>등록일: {new Date(preview.existingProduct.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/products/${preview.existingProduct!.id}`)}
                    className="mt-3 text-sm text-orange-800 underline hover:text-orange-900"
                  >
                    기존 상품 보기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 크롤링 옵션 */}
        {preview && preview.isSupported && !preview.isDuplicate && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">크롤링 옵션</h2>

            <div className="space-y-4">
              {/* 자동 번역 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">자동 번역</label>
                  <p className="text-sm text-gray-500">상품명과 설명을 한국어로 자동 번역합니다.</p>
                </div>
                <input
                  type="checkbox"
                  checked={options.autoTranslate}
                  onChange={(e) => setOptions({ ...options, autoTranslate: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* 이미지 처리 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">이미지 처리</label>
                  <p className="text-sm text-gray-500">이미지를 다운로드하고 최적화합니다.</p>
                </div>
                <input
                  type="checkbox"
                  checked={options.processImages}
                  onChange={(e) => setOptions({ ...options, processImages: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* 마진율 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마진율 ({options.marginRate}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={options.marginRate}
                  onChange={(e) => setOptions({ ...options, marginRate: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* 크롤링 시작 버튼 */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleStartCrawl}
                disabled={crawling}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {crawling ? '크롤링 중...' : '🔍 크롤링 시작'}
              </button>
              <button
                onClick={() => {
                  setUrl('');
                  setPreview(null);
                  setError(null);
                }}
                disabled={crawling}
                className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                초기화
              </button>
            </div>
          </div>
        )}

        {/* 안내 정보 */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">💡 사용 방법</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>1. 타오바오, 아마존, 알리바바 등의 상품 URL을 입력합니다.</li>
            <li>2. "URL 확인" 버튼을 클릭하여 플랫폼 감지 및 중복 여부를 확인합니다.</li>
            <li>3. 크롤링 옵션을 설정합니다 (번역, 이미지 처리, 마진율).</li>
            <li>4. "크롤링 시작" 버튼을 클릭하면 자동으로 상품이 등록됩니다.</li>
            <li>5. 크롤링 완료 후 상품 상세 페이지로 이동하여 결과를 확인할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
