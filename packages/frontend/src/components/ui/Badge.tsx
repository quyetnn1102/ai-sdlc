import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'pending' | 'info' | 'neutral' | 'default';

interface BadgeProps { variant?: BadgeVariant; children: React.ReactNode; className?: string; }

const variants: Record<BadgeVariant, string> = {
  success: 'bg-[rgba(34,197,94,0.12)] text-status-success border border-[rgba(34,197,94,0.25)]',
  danger:  'bg-[rgba(239,68,68,0.12)] text-status-danger  border border-[rgba(239,68,68,0.25)]',
  warning: 'bg-[rgba(245,158,11,0.12)] text-status-warning border border-[rgba(245,158,11,0.25)]',
  pending: 'bg-[rgba(107,114,128,0.12)] text-status-neutral border border-[rgba(107,114,128,0.25)]',
  info:    'bg-[rgba(59,130,246,0.12)] text-status-info border border-[rgba(59,130,246,0.25)]',
  neutral: 'bg-[rgba(107,114,128,0.12)] text-status-neutral border border-[rgba(107,114,128,0.25)]',
  default: 'bg-bg-elevated text-text-secondary border border-border-subtle',
};

/** Map gate / incident / integration status strings to a badge variant */
export function statusToVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (['pass', 'success', 'active', 'connected', 'resolved', 'merged'].includes(s)) return 'success';
  if (['fail', 'failure', 'failed', 'open', 'disconnected', 'critical'].includes(s)) return 'danger';
  if (['warning', 'degraded', 'in_progress', 'investigating'].includes(s)) return 'warning';
  if (['pending', 'draft', 'blocked'].includes(s)) return 'pending';
  return 'neutral';
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-none',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
