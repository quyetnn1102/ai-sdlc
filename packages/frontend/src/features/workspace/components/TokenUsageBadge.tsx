/**
 * TokenUsageBadge — Compact inline badge showing formatted token count.
 * Displays ⚡ icon with abbreviated token count (e.g., "12.3k", "1.2M").
 */

export interface TokenUsageBadgeProps {
  tokens: number | null;
  cost?: number | null;
  size?: 'sm' | 'md';
}

/**
 * Format a token count for display.
 * null → "—", N < 1000 → raw number, 1000 ≤ N < 1M → "X.Yk", N ≥ 1M → "X.YM"
 */
export function formatTokenCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
}

export function TokenUsageBadge({ tokens, cost, size = 'sm' }: TokenUsageBadgeProps) {
  const formatted = formatTokenCount(tokens);
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-[rgba(245,158,11,0.1)] text-status-warning border border-[rgba(245,158,11,0.2)] font-medium ${sizeClasses}`}
      title={tokens !== null ? `${tokens.toLocaleString()} tokens${cost != null ? ` · $${cost.toFixed(4)}` : ''}` : 'No token data'}
    >
      <span aria-hidden="true">⚡</span>
      <span>{formatted}</span>
    </span>
  );
}
