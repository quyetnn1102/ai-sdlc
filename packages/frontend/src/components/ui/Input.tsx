import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const inputBase =
  'w-full h-9 px-3 rounded-md bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-strong transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-text-secondary">{label}</label>}
      <input ref={ref} className={cn(inputBase, error && 'border-status-danger', className)} {...props} />
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-text-secondary">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-md bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-border-strong transition-colors resize-none',
          error && 'border-status-danger',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  ),
);
TextArea.displayName = 'TextArea';
