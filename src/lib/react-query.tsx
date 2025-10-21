/**
 * React Query 설정
 *
 * 서버 상태 관리를 위한 React Query (TanStack Query) 설정
 * - QueryClient 설정
 * - 기본 옵션
 * - 에러 핸들링
 * - 리트라이 정책
 *
 * Phase 3.8: 통합 및 미들웨어 - T061
 */

'use client';

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

/**
 * React Query 기본 설정
 */
const queryConfig = {
  queries: {
    // 쿼리 성공 후 stale 상태로 전환되는 시간 (5분)
    staleTime: 5 * 60 * 1000,

    // 캐시 데이터 유지 시간 (10분)
    gcTime: 10 * 60 * 1000,

    // 실패 시 재시도 횟수
    retry: 3,

    // 재시도 딜레이 (exponential backoff)
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // 윈도우 포커스 시 자동 리페치
    refetchOnWindowFocus: true,

    // 마운트 시 자동 리페치
    refetchOnMount: true,

    // 네트워크 재연결 시 자동 리페치
    refetchOnReconnect: true,
  },

  mutations: {
    // 실패 시 재시도 안 함 (mutation은 멱등성이 보장되지 않을 수 있음)
    retry: 0,
  },
};

/**
 * QueryClient 생성 함수
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 전역 에러 핸들링
        console.error('Query Error:', {
          queryKey: query.queryKey,
          error,
        });

        // 401 Unauthorized 에러 시 로그인 페이지로 리다이렉트
        if ((error as any)?.response?.status === 401) {
          window.location.href = '/auth/login';
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // 전역 Mutation 에러 핸들링
        console.error('Mutation Error:', {
          mutationKey: mutation.options.mutationKey,
          error,
        });

        // 사용자에게 에러 알림 (선택적)
        if (typeof window !== 'undefined') {
          // Toast 알림 등으로 에러 표시
          // toast.error('작업 중 오류가 발생했습니다.');
        }
      },
    }),
  });
}

/**
 * 브라우저 환경에서 사용할 QueryClient (싱글톤)
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // 서버 환경: 항상 새로운 QueryClient 생성
    return makeQueryClient();
  } else {
    // 브라우저 환경: 싱글톤 패턴
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

/**
 * React Query Provider 컴포넌트
 */
interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // useState를 사용하여 브라우저에서 재생성 방지
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 환경에서만 DevTools 표시 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      )}
    </QueryClientProvider>
  );
}

/**
 * Query Key 팩토리
 *
 * 일관된 쿼리 키 생성을 위한 헬퍼 함수들
 */
export const queryKeys = {
  // 인증
  auth: {
    user: ['auth', 'user'] as const,
    session: ['auth', 'session'] as const,
  },

  // 상품
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },

  // 주문
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.orders.details(), id] as const,
  },

  // 통계
  analytics: {
    all: ['analytics'] as const,
    dashboard: (period?: string) => [...queryKeys.analytics.all, 'dashboard', period] as const,
  },
};

/**
 * 캐시 무효화 헬퍼 함수
 */
export async function invalidateQueries(queryClient: QueryClient, keys: readonly any[]) {
  await queryClient.invalidateQueries({ queryKey: keys as any });
}

/**
 * 낙관적 업데이트 헬퍼 함수
 */
export async function optimisticUpdate<T>(
  queryClient: QueryClient,
  queryKey: readonly any[],
  updateFn: (old: T | undefined) => T
) {
  // 이전 데이터 스냅샷 저장
  const previousData = queryClient.getQueryData<T>(queryKey as any);

  // 낙관적 업데이트
  queryClient.setQueryData<T>(queryKey as any, updateFn);

  return { previousData };
}

/**
 * 에러 발생 시 롤백 헬퍼 함수
 */
export function rollbackUpdate<T>(
  queryClient: QueryClient,
  queryKey: readonly any[],
  previousData: T | undefined
) {
  if (previousData !== undefined) {
    queryClient.setQueryData(queryKey as any, previousData);
  }
}
