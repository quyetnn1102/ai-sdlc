import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Skeleton, SkeletonRow } from './Skeleton';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T, idx: number) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns, rows, loading, skeletonRows = 5,
  emptyMessage = 'No data available', className, onRowClick,
}: TableProps<T>) {
  return (
    <div className={cn('rounded-xl bg-bg-surface border border-border-subtle overflow-hidden', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-default">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className="text-left px-4 h-10 text-[11px] uppercase tracking-wide text-text-secondary font-medium"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-border-subtle">
                <td colSpan={columns.length} className="px-0 py-0">
                  <SkeletonRow />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-text-secondary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-border-subtle last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-bg-hover',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 h-10 text-sm text-text-primary">
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
