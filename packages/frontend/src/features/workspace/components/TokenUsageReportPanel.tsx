/**
 * TokenUsageReportPanel — Slide-over panel showing token usage report.
 * Sections: Today, Month, By Model, By Agent, Daily Trend.
 * Auto-refreshes every 30 seconds.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { tokenUsageApi, type TokenUsageReportResponse } from '../api/workspace.service';
import { formatTokenCount } from './TokenUsageBadge';

interface TokenUsageReportPanelProps {
  onClose: () => void;
}

export function TokenUsageReportPanel({ onClose }: TokenUsageReportPanelProps) {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<TokenUsageReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const failCountRef = useRef(0);
  const [stale, setStale] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!projectId) return;
    try {
      const report = await tokenUsageApi.report(projectId);
      setData(report);
      setError(null);
      failCountRef.current = 0;
      setStale(false);
    } catch {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) setStale(true);
      if (!data) setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [projectId, data]);

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 30_000);
    return () => clearInterval(interval);
  }, [fetchReport]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md bg-bg-base border-l border-border-subtle h-full overflow-y-auto p-6 space-y-6 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Token Usage Report</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        {stale && (
          <p className="text-[11px] text-status-warning">⚠ Data may be stale — connection issues</p>
        )}

        {loading && !data ? (
          <SkeletonReport />
        ) : error && !data ? (
          <p className="text-sm text-status-danger">{error}</p>
        ) : data ? (
          <>
            {/* Today */}
            <Section title="Today">
              <StatRow label="Tokens" value={formatTokenCount(data.today.totalTokens)} />
              <StatRow label="Cost" value={`$${data.today.estimatedCost.toFixed(2)}`} />
            </Section>

            {/* This Month */}
            <Section title="This Month">
              <StatRow label="Tokens" value={formatTokenCount(data.thisMonth.totalTokens)} />
              <StatRow label="Cost" value={`$${data.thisMonth.estimatedCost.toFixed(2)}`} />
            </Section>

            {/* By Model */}
            <Section title="By Model">
              {data.byModel.map((m) => (
                <PercentageBar key={m.model} label={m.model} percentage={m.percentage} />
              ))}
            </Section>

            {/* By Agent */}
            <Section title="By Agent">
              {data.byAgent.map((a) => (
                <PercentageBar key={a.agentName} label={a.agentName} percentage={a.percentage} />
              ))}
            </Section>

            {/* Daily Trend */}
            <Section title="Daily Trend (Last 7 Days)">
              <DailyTrendChart data={data.dailyTrend.slice(-7)} />
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function PercentageBar({ label, percentage }: { label: string; percentage: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary truncate">{label}</span>
        <span className="text-text-primary font-medium">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-primary transition-all"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function DailyTrendChart({ data }: { data: Array<{ date: string; cost: number }> }) {
  if (data.length === 0) return <p className="text-xs text-text-disabled">No data yet</p>;
  const maxCost = Math.max(...data.map((d) => d.cost), 0.01);

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm bg-accent-primary/70 transition-all"
            style={{ height: `${(d.cost / maxCost) * 100}%`, minHeight: '2px' }}
            title={`${d.date}: $${d.cost.toFixed(2)}`}
          />
          <span className="text-[8px] text-text-disabled">{d.date.slice(-2)}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonReport() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-bg-elevated rounded" />
          <div className="h-4 w-full bg-bg-elevated rounded" />
          <div className="h-4 w-3/4 bg-bg-elevated rounded" />
        </div>
      ))}
    </div>
  );
}
