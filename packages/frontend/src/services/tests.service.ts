import { api } from '@/lib/api';

export interface TestStep { step: string; expected: string; }
export type TestPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TestType = 'UNIT' | 'INTEGRATION' | 'E2E' | 'PERFORMANCE' | 'SECURITY' | 'MANUAL';
export type TestResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';

export interface TestCase {
  id: string; projectId: string; title: string; description?: string;
  preconditions?: string; steps?: TestStep[]; expectedResult?: string;
  priority: TestPriority; type: TestType; linkedRequirementId?: string;
  createdAt: string; updatedAt: string;
  testRuns?: TestRun[];
}
export interface TestPlan {
  id: string; projectId: string; name: string; description?: string;
  sprintName?: string; status: string; testCaseIds: string[]; createdAt: string;
  testRuns?: TestRun[];
}
export interface TestRun {
  id: string; testCaseId: string; testPlanId?: string;
  result: TestResult; executedBy?: string; notes?: string;
  duration?: number; executedAt: string;
  testCase?: Pick<TestCase, 'id' | 'title' | 'priority'>;
}
export interface TestPlanSummary {
  planId: string; total: number;
  counts: Record<string, number>; completionPct: number;
}
export interface CoverageByReq {
  requirementId: string; total: number; passed: number; coverage: number;
}
export interface CreateTestCasePayload {
  title: string; description?: string; preconditions?: string;
  steps?: TestStep[]; expectedResult?: string;
  priority?: TestPriority; type?: TestType; linkedRequirementId?: string;
}
export interface CreateTestPlanPayload {
  name: string; description?: string; sprintName?: string; testCaseIds?: string[];
}

export const testsService = {
  // Test Cases
  listCases: (projectId: string, linkedRequirementId?: string) =>
    api.get<TestCase[]>(`/projects/${projectId}/test-cases`,
      linkedRequirementId ? { linkedRequirementId } : undefined),

  getCase: (projectId: string, id: string) =>
    api.get<TestCase>(`/projects/${projectId}/test-cases/${id}`),

  createCase: (projectId: string, data: CreateTestCasePayload) =>
    api.post<TestCase>(`/projects/${projectId}/test-cases`, data),

  updateCase: (projectId: string, id: string, data: Partial<CreateTestCasePayload>) =>
    api.put<TestCase>(`/projects/${projectId}/test-cases/${id}`, data),

  deleteCase: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/test-cases/${id}`),

  coverage: (projectId: string) =>
    api.get<CoverageByReq[]>(`/projects/${projectId}/test-cases/coverage`),

  // Test Plans
  listPlans: (projectId: string) =>
    api.get<TestPlan[]>(`/projects/${projectId}/test-plans`),

  getPlan: (projectId: string, id: string) =>
    api.get<TestPlan>(`/projects/${projectId}/test-plans/${id}`),

  createPlan: (projectId: string, data: CreateTestPlanPayload) =>
    api.post<TestPlan>(`/projects/${projectId}/test-plans`, data),

  updatePlan: (projectId: string, id: string, data: Partial<CreateTestPlanPayload> & { status?: string }) =>
    api.put<TestPlan>(`/projects/${projectId}/test-plans/${id}`, data),

  deletePlan: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/test-plans/${id}`),

  planSummary: (projectId: string, planId: string) =>
    api.get<TestPlanSummary>(`/projects/${projectId}/test-plans/${planId}/summary`),

  // Test Runs
  createRun: (projectId: string, data: { testCaseId: string; testPlanId?: string; result: TestResult; notes?: string }) =>
    api.post<TestRun>(`/projects/${projectId}/test-runs`, data),

  runsByPlan: (projectId: string, planId: string) =>
    api.get<TestRun[]>(`/projects/${projectId}/test-runs/by-plan/${planId}`),
};
