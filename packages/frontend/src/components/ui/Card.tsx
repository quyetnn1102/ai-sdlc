import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const paddings = { sm: 'p-3', md: 'p-5', lg: 'p-6' };

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl bg-bg-surface border border-border-subtle',
        paddings[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/** Metric card: label + big number + optional trend */
interface MetricCardProps {
  label: string;
  value: string | number | null;
  trend?: string;
  trendPositive?: boolean;
  suffix?: string;
  loading?: boolean;
}

export function MetricCard({ label, value, trend, trendPositive, suffix, loading }: MetricCardProps) {
  return (
    <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle">
      <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">{label}</p>
      {loading ? (
        <div className="h-8 w-24 rounded bg-bg-elevated animate-pulse" />
      ) : (
        <p className="text-2xl font-bold tabular-nums text-text-primary">
          {value ?? '—'}{suffix && <span className="text-base font-medium ml-1 text-text-secondary">{suffix}</span>}
        </p>
      )}
      {trend && (
        <p className={`text-xs mt-1 ${trendPositive ? 'text-status-success' : 'text-status-danger'}`}>
          {trend}
        </p>
      )}
    </div>
  );
}
