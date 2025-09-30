/**
 * DataTable 컴포넌트
 *
 * 범용 데이터 테이블 컴포넌트
 * - 정렬, 필터링, 페이지네이션
 * - 선택 가능한 행
 * - 액션 버튼
 * - 반응형 디자인
 *
 * Phase 3.6: 프론트엔드 컴포넌트 - T046
 */

'use client';

import { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (rows: T[]) => void;
  actions?: {
    label: string;
    onClick: (rows: T[]) => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }[];
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField = 'id',
  pagination,
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  actions,
  emptyMessage = '데이터가 없습니다.',
  loading = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 정렬된 데이터
  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortOrder]);

  // 정렬 핸들러
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // 전체 선택 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? sortedData : []);
    }
  };

  // 개별 선택 핸들러
  const handleSelectRow = (row: T, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedRows, row]
        : selectedRows.filter((r) => r[keyField] !== row[keyField]);
      onSelectionChange(newSelection);
    }
  };

  // 선택 상태 확인
  const isSelected = (row: T) => {
    return selectedRows.some((r) => r[keyField] === row[keyField]);
  };

  const allSelected = sortedData.length > 0 && sortedData.every(isSelected);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 액션 버튼 */}
      {actions && selectedRows.length > 0 && (
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center space-x-2">
          <span className="text-sm text-gray-700">
            {selectedRows.length}개 선택됨
          </span>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => action.onClick(selectedRows)}
              className={`
                px-3 py-1 text-sm font-medium rounded-md transition-colors
                ${
                  action.variant === 'danger'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : action.variant === 'secondary'
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-6 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                    ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                    ${column.width ? column.width : ''}
                  `}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && sortKey === column.key && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr
                  key={row[keyField]}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                    ${isSelected(row) ? 'bg-blue-50' : ''}
                  `}
                >
                  {selectable && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected(row)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(row, e.target.checked);
                        }}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination && pagination.total > 0 && (
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            전체 {pagination.total}개 중{' '}
            {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              이전
            </button>
            <span className="text-sm text-gray-700">
              {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={
                pagination.page >= Math.ceil(pagination.total / pagination.limit)
              }
              className="px-3 py-1 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;