/**
 * API 클라이언트
 *
 * 백엔드 API와 통신하기 위한 중앙화된 HTTP 클라이언트
 * - Fetch API 래퍼
 * - 자동 인증 헤더 추가
 * - 에러 처리
 * - 타입 안정성
 *
 * Phase 3.8: 통합 및 미들웨어 - T062
 */

'use client';

/**
 * API 응답 타입
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch 옵션 타입
 */
interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * API 클라이언트 클래스
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * URL에 쿼리 파라미터 추가
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, window.location.origin + this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * 기본 fetch 래퍼
   */
  private async request<T = any>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { params, headers, ...fetchOptions } = options;

    const url = this.buildUrl(endpoint, params);

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });

    // 응답 본문 파싱
    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch (e) {
      throw new ApiError(
        response.status,
        '응답을 파싱할 수 없습니다.',
        { originalError: e }
      );
    }

    // 에러 응답 처리
    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.error || `HTTP ${response.status} 오류`,
        data.details
      );
    }

    // 성공 응답이지만 success: false인 경우
    if (!data.success) {
      throw new ApiError(
        response.status,
        data.error || '알 수 없는 오류가 발생했습니다.',
        data.details
      );
    }

    return data.data as T;
  }

  /**
   * GET 요청
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      params,
    });
  }

  /**
   * POST 요청
   */
  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT 요청
   */
  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH 요청
   */
  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE 요청
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

/**
 * API 클라이언트 싱글톤 인스턴스
 */
export const apiClient = new ApiClient();

/**
 * API 엔드포인트 헬퍼
 *
 * 타입 안전한 API 호출을 위한 헬퍼 함수들
 */
export const api = {
  // 인증
  auth: {
    register: (data: { name: string; email: string; password: string }) =>
      apiClient.post('/auth/register', data),
    login: (data: { email: string; password: string }) =>
      apiClient.post('/auth/login', data),
    logout: () => apiClient.post('/auth/logout'),
  },

  // 상품
  products: {
    list: (params?: { page?: number; limit?: number; q?: string; status?: string; sortBy?: string; sortOrder?: string }) =>
      apiClient.get('/products', params),
    get: (id: string) =>
      apiClient.get(`/products/${id}`),
    create: (data: any) =>
      apiClient.post('/products', data),
    update: (id: string, data: any) =>
      apiClient.patch(`/products/${id}`, data),
    delete: (id: string) =>
      apiClient.delete(`/products/${id}`),
    crawl: (data: { url: string; platform: string }) =>
      apiClient.post('/products/crawl', data),
  },

  // 주문
  orders: {
    list: (params?: { page?: number; limit?: number; q?: string; status?: string; platform?: string; sortBy?: string; sortOrder?: string }) =>
      apiClient.get('/orders', params),
    get: (id: string) =>
      apiClient.get(`/orders/${id}`),
    update: (id: string, data: any) =>
      apiClient.patch(`/orders/${id}`, data),
    cancel: (id: string) =>
      apiClient.post(`/orders/${id}/cancel`),
  },

  // 통계
  analytics: {
    dashboard: (period?: string) =>
      apiClient.get('/analytics/dashboard', period ? { period } : undefined),
  },
};

/**
 * React Query와 함께 사용하기 위한 fetcher 함수
 */
export const fetcher = {
  get: <T = any>(url: string) => apiClient.get<T>(url),
  post: <T = any>(url: string, data?: any) => apiClient.post<T>(url, data),
  put: <T = any>(url: string, data?: any) => apiClient.put<T>(url, data),
  patch: <T = any>(url: string, data?: any) => apiClient.patch<T>(url, data),
  delete: <T = any>(url: string) => apiClient.delete<T>(url),
};
