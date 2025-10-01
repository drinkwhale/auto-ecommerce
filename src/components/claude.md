# Components 모듈 - React 컴포넌트 작성 규칙

## 모듈 역할
- **React 컴포넌트 계층**: 재사용 가능한 UI 컴포넌트를 관리하며, Next.js 14 App Router와 통합됩니다.
- **shadcn/ui 기반**: 접근성과 커스터마이징이 뛰어난 shadcn/ui 라이브러리를 활용합니다.
- **Tailwind CSS 스타일링**: 유틸리티 우선 CSS 프레임워크로 일관된 디자인을 구현합니다.

## 디렉토리 구조
```
src/components/
├── common/              # 공통 컴포넌트
│   ├── Header.tsx      # 헤더 및 네비게이션
│   ├── Sidebar.tsx     # 사이드바 메뉴
│   └── DataTable.tsx   # 재사용 가능한 데이터 테이블
├── product/            # 상품 관련 컴포넌트
│   ├── ProductList.tsx   # 상품 목록
│   ├── ProductCard.tsx   # 상품 카드
│   └── ProductForm.tsx   # 상품 등록/수정 폼
├── order/              # 주문 관련 컴포넌트
│   ├── OrderList.tsx     # 주문 목록
│   └── OrderDetail.tsx   # 주문 상세
└── ui/                 # shadcn/ui 기본 컴포넌트
    ├── button.tsx
    ├── input.tsx
    ├── dialog.tsx
    └── ...
```

## 핵심 규칙

### 규칙 1: TypeScript 타입 안정성
- **모든 Props는 명시적 타입 정의 필수**
  ```typescript
  // ✅ 좋은 예시
  interface ProductCardProps {
    product: {
      id: string;
      title: string;
      price: number;
      imageUrl?: string;
    };
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
  }

  export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
    // ...
  }

  // ❌ 나쁜 예시
  export function ProductCard({ product, onEdit, onDelete }: any) {
    // ...
  }
  ```

### 규칙 2: Server Component vs Client Component
- **기본적으로 Server Component 사용** (Next.js 14 App Router)
- **인터랙션이 필요한 경우에만 'use client' 지시어 추가**
  ```typescript
  // ✅ Server Component (기본)
  export default function ProductList({ products }: { products: Product[] }) {
    return (
      <div>
        {products.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    );
  }

  // ✅ Client Component (인터랙션 필요)
  'use client';

  import { useState } from 'react';

  export function ProductForm() {
    const [formData, setFormData] = useState({});
    // ...
  }
  ```

### 규칙 3: shadcn/ui 컴포넌트 활용
- **ui/ 폴더의 기본 컴포넌트를 최대한 재사용**
- **새로운 UI 요소가 필요하면 shadcn/ui CLI로 추가**
  ```bash
  npx shadcn-ui@latest add button
  npx shadcn-ui@latest add dialog
  npx shadcn-ui@latest add table
  ```
  ```typescript
  // ✅ shadcn/ui 컴포넌트 사용
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

  export function ProductActions() {
    return (
      <div>
        <Button variant="outline">수정</Button>
        <Button variant="destructive">삭제</Button>
      </div>
    );
  }
  ```

### 규칙 4: Tailwind CSS 스타일링
- **인라인 Tailwind 유틸리티 클래스 사용**
- **복잡한 스타일은 `cn()` 유틸리티로 조건부 스타일링**
  ```typescript
  import { cn } from '@/lib/utils';

  // ✅ 기본 스타일링
  <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
    <h3 className="text-lg font-semibold">제목</h3>
  </div>

  // ✅ 조건부 스타일링
  <Button
    className={cn(
      "w-full",
      isLoading && "opacity-50 cursor-not-allowed",
      variant === "primary" && "bg-blue-500 hover:bg-blue-600"
    )}
  >
    버튼
  </Button>
  ```

### 규칙 5: 컴포넌트 파일 구조
- **파일명은 PascalCase** (예: ProductCard.tsx)
- **한 파일에 하나의 주요 컴포넌트만 export**
- **파일 구조 순서**:
  1. import 문
  2. 타입/인터페이스 정의
  3. 컴포넌트 정의
  4. 헬퍼 함수 (필요 시)
  ```typescript
  // ✅ 권장 파일 구조
  'use client';

  // 1. import 문
  import { useState } from 'react';
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';

  // 2. 타입 정의
  interface ProductFormProps {
    initialData?: Product;
    onSubmit: (data: ProductFormData) => Promise<void>;
  }

  // 3. 컴포넌트 정의
  export function ProductForm({ initialData, onSubmit }: ProductFormProps) {
    const [formData, setFormData] = useState(initialData || {});

    return (
      <form onSubmit={handleSubmit}>
        {/* ... */}
      </form>
    );
  }

  // 4. 헬퍼 함수
  function validateForm(data: ProductFormData): boolean {
    // ...
  }
  ```

### 규칙 6: 상태 관리
- **로컬 상태는 useState 사용**
- **폼 상태는 React Hook Form 권장**
- **전역 상태는 필요 시에만 Context API 사용**
  ```typescript
  // ✅ 로컬 상태 관리
  import { useState } from 'react';

  export function ProductCard({ product }: ProductCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div onClick={() => setIsExpanded(!isExpanded)}>
        {/* ... */}
      </div>
    );
  }
  ```

### 규칙 7: API 호출 및 데이터 페칭
- **컴포넌트에서 직접 API 호출 금지**
- **Server Component에서는 직접 데이터 페칭 가능**
- **Client Component에서는 SWR 또는 React Query 사용**
  ```typescript
  // ✅ Server Component - 직접 데이터 페칭
  import { getProducts } from '@/services/product.service';

  export default async function ProductListPage() {
    const products = await getProducts({ page: 1, limit: 10 });

    return <ProductList products={products} />;
  }

  // ✅ Client Component - SWR 사용
  'use client';

  import useSWR from 'swr';

  export function ProductList() {
    const { data, error, isLoading } = useSWR('/api/v1/products', fetcher);

    if (isLoading) return <Skeleton />;
    if (error) return <ErrorMessage />;

    return <div>{/* ... */}</div>;
  }
  ```

### 규칙 8: 접근성 (Accessibility)
- **시맨틱 HTML 태그 사용**
- **버튼에는 의미 있는 aria-label 추가**
- **키보드 네비게이션 지원**
  ```typescript
  // ✅ 접근성 준수
  <button
    type="button"
    aria-label="상품 삭제"
    onClick={handleDelete}
    className="..."
  >
    <TrashIcon className="w-4 h-4" />
  </button>

  <nav aria-label="메인 네비게이션">
    <ul>
      <li><a href="/products">상품 관리</a></li>
    </ul>
  </nav>
  ```

### 규칙 9: 에러 처리 및 로딩 상태
- **로딩 상태는 명시적으로 표시**
- **에러 발생 시 사용자 친화적인 메시지 표시**
  ```typescript
  // ✅ 로딩 및 에러 처리
  'use client';

  import { useState } from 'react';
  import { Button } from '@/components/ui/button';

  export function ProductActions({ productId }: { productId: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
      try {
        setIsDeleting(true);
        setError(null);
        await deleteProduct(productId);
      } catch (err) {
        setError('상품 삭제 중 오류가 발생했습니다.');
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <div>
        <Button
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? '삭제 중...' : '삭제'}
        </Button>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    );
  }
  ```

### 규칙 10: 컴포넌트 재사용성
- **Props를 통한 유연한 설정**
- **기본값(defaultProps) 제공**
- **합성(Composition) 패턴 활용**
  ```typescript
  // ✅ 재사용 가능한 컴포넌트
  interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (row: T) => void;
    emptyMessage?: string;
  }

  export function DataTable<T>({
    data,
    columns,
    onRowClick,
    emptyMessage = "데이터가 없습니다."
  }: DataTableProps<T>) {
    if (data.length === 0) {
      return <EmptyState message={emptyMessage} />;
    }

    return (
      <table>
        {/* ... */}
      </table>
    );
  }
  ```

## 코딩 컨벤션

### 네이밍
- **컴포넌트**: PascalCase (예: ProductCard, OrderList)
- **함수**: camelCase + 동사로 시작 (예: handleClick, fetchProducts)
- **Props 인터페이스**: `{컴포넌트명}Props` (예: ProductCardProps)
- **이벤트 핸들러**: `handle{이벤트명}` (예: handleSubmit, handleDelete)

### Import 순서
1. React 관련
2. 외부 라이브러리
3. 내부 컴포넌트
4. 타입/인터페이스
5. 스타일/유틸리티
```typescript
// ✅ Import 순서
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/product/ProductCard';
import type { Product } from '@prisma/client';
import { cn } from '@/lib/utils';
```

## 주요 컴포넌트 설명

### common/DataTable.tsx
- **역할**: 재사용 가능한 데이터 테이블 컴포넌트
- **기능**: 정렬, 필터링, 페이지네이션, 행 선택
- **사용법**:
  ```typescript
  <DataTable
    data={products}
    columns={productColumns}
    onRowClick={(product) => router.push(`/products/${product.id}`)}
  />
  ```

### common/Header.tsx
- **역할**: 전역 헤더 및 네비게이션
- **기능**: 로고, 메뉴, 사용자 프로필, 로그아웃

### common/Sidebar.tsx
- **역할**: 사이드바 메뉴
- **기능**: 페이지 네비게이션, 활성 메뉴 하이라이트

### product/ProductForm.tsx
- **역할**: 상품 등록/수정 폼
- **검증**: Zod 스키마를 통한 입력 검증
- **상태 관리**: React Hook Form 사용

## 테스트 규칙
- **각 컴포넌트는 테스트 파일 작성 필수** (예: ProductCard.test.tsx)
- **React Testing Library 사용**
- **사용자 인터랙션 중심 테스트**
```typescript
// ProductCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('상품 정보를 올바르게 표시해야 합니다', () => {
    const product = { id: '1', title: '테스트 상품', price: 10000 };
    render(<ProductCard product={product} />);

    expect(screen.getByText('테스트 상품')).toBeInTheDocument();
    expect(screen.getByText('₩10,000')).toBeInTheDocument();
  });

  it('수정 버튼 클릭 시 onEdit 콜백이 호출되어야 합니다', () => {
    const onEdit = jest.fn();
    const product = { id: '1', title: '테스트 상품', price: 10000 };
    render(<ProductCard product={product} onEdit={onEdit} />);

    fireEvent.click(screen.getByLabelText('수정'));
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});
```

## 참고 자료
- **shadcn/ui 문서**: https://ui.shadcn.com
- **Tailwind CSS 문서**: https://tailwindcss.com/docs
- **Next.js 14 문서**: https://nextjs.org/docs
- **React Testing Library**: https://testing-library.com/react
