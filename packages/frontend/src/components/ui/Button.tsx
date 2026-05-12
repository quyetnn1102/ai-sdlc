import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[6px] transition-colors duration-[120ms] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary';

const variants: Record<Variant, string> = {
  primary:   'bg-accent-primary text-white hover:bg-accent-hover',
  secondary: 'bg-transparent border border-border-default text-text-primary hover:bg-bg-hover',
  danger:    'bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] text-status-danger hover:bg-[rgba(239,68,68,0.2)]',
  ghost:     'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, iconLeft, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : iconLeft}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
