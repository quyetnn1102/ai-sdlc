import { api } from '@/lib/api';

export type Period = '7d' | '30d' | '90d';

export interface DeploymentFrequency {
  metric: string; period: string; count: number; perDay: number; perWeek: number;
}
export interface LeadTime {
  metric: string; period: string; avgHours: number | null; avgDays: number | null; samples: number;
}
export interface ChangeFailureRate {
  metric: string; period: string; failedDeployments: number; totalDeployments: number; rate: number;
}
export interface MttrMetric {
  metric: string; period: string;
  avgMinutes: number | null; p50Minutes: number | null; p90Minutes: number | null; samples: number;
}
export interface DoraMetrics {
  period: string;
  deploymentFrequency: DeploymentFrequency;
  leadTime: LeadTime;
  changeFailureRate: ChangeFailureRate;
  mttr: MttrMetric;
}
export interface WipPhase { phase: string; count: number; }
export interface FlowMetrics {
  period: string;
  wip: WipPhase[];
  throughput: { count: number; days: number };
  avgAge: Array<{ phase: string; avgAgeDays: number }>;
}

export const metricsService = {
  dora: (projectId: string, period: Period = '30d') =>
    api.get<DoraMetrics>(`/projects/${projectId}/metrics/dora`, { period }),

  flow: (projectId: string, period: Period = '30d') =>
    api.get<FlowMetrics>(`/projects/${projectId}/metrics/flow`, { period }),
};
