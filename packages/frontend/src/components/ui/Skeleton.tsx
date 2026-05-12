import { cn } from '@/lib/utils';

interface SkeletonProps { className?: string; }

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-[rgba(255,255,255,0.06)] animate-pulse',
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 h-10">
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}
