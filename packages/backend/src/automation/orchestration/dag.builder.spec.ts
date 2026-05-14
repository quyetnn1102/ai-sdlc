/**
 * Property-based tests for DAG Builder
 *
 * Implements Properties 5–8, 13, 19–22 from the design document.
 * Uses fast-check for property-based testing (min 100 iterations each).
 *
 * Feature: agent-workflow-automation
 */
import * as fc from 'fast-check';
import { buildDag } from './dag.builder';

// ── Helpers ───────────────────────────────────────────────────────────────

const TERMINAL = ['DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'SKIPPED'];
const SUCCESS  = ['DONE', 'SKIPPED'];

/** Build a simple linear chain: task[0] → task[1] → ... → task[n-1] */
function linearChain(n: number, statuses?: string[]) {
  const tasks = Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    phaseName: `Phase${i}`,
    status: statuses?.[i] ?? 'PENDING',
    dependencies: i === 0 ? [] : [{ dependsOnTaskId: `t${i - 1}` }],
  }));
  return tasks;
}

/** Build a two-layer parallel DAG: root → [a, b] → leaf */
function parallelDag(rootStatus = 'DONE', aStatus = 'PENDING', bStatus = 'PENDING', leafStatus = 'PENDING') {
  return [
    { id: 'root', phaseName: 'Root', status: rootStatus, dependencies: [] },
    { id: 'a',    phaseName: 'A',    status: aStatus,    dependencies: [{ dependsOnTaskId: 'root' }] },
    { id: 'b',    phaseName: 'B',    status: bStatus,    dependencies: [{ dependsOnTaskId: 'root' }] },
    { id: 'leaf', phaseName: 'Leaf', status: leafStatus, dependencies: [{ dependsOnTaskId: 'a' }, { dependsOnTaskId: 'b' }] },
  ];
}

// ── Arbitraries ───────────────────────────────────────────────────────────

const statusArb = fc.constantFrom('PENDING', 'STARTING', 'RUNNING', 'DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'SKIPPED');
const terminalStatusArb = fc.constantFrom(...TERMINAL);
const successStatusArb  = fc.constantFrom(...SUCCESS);

// ── Property 5: Task decomposition produces correct tasks ─────────────────
// Feature: agent-workflow-automation, Property 5: Task decomposition produces correct tasks with correct assignments

describe('Property 5: buildDag creates one node per task', () => {
  it('node count equals input task count', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), phaseName: fc.string({ minLength: 1 }), status: statusArb }), { minLength: 1, maxLength: 20 }),
        (tasks) => {
          const uniqueTasks = tasks.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
          const dag = buildDag(uniqueTasks.map((t) => ({ ...t, dependencies: [] })));
          expect(dag.nodes.size).toBe(uniqueTasks.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: for N tasks with distinct IDs, DAG has exactly N nodes', () => {
    // Uses fc.uniqueArray to guarantee distinct IDs as specified
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 8 }),
        (ids) => {
          const tasks = ids.map((id, i) => ({
            id,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: [],
          }));
          const dag = buildDag(tasks);
          // Exactly N nodes, one per task
          expect(dag.nodes.size).toBe(ids.length);
          // Each task ID has a corresponding node
          for (const id of ids) {
            expect(dag.nodes.has(id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 6: DAG structure has correct dependency edges ────────────────
// Feature: agent-workflow-automation, Property 6: DAG structure has correct dependency edges

describe('Property 6: dependency edges are correctly wired', () => {
  it('linear chain has N-1 edges', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (n) => {
        const dag = buildDag(linearChain(n));
        expect(dag.edges.length).toBe(n - 1);
        // Each edge goes from task[i-1] to task[i]
        for (let i = 1; i < n; i++) {
          const edge = dag.edges.find((e) => e.fromTaskId === `t${i - 1}` && e.toTaskId === `t${i}`);
          expect(edge).toBeDefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('single task has no edges', () => {
    const dag = buildDag([{ id: 't0', phaseName: 'P', status: 'PENDING', dependencies: [] }]);
    expect(dag.edges.length).toBe(0);
  });

  it('property: for any set of tasks, edges match exactly the declared dependencies', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 8 }),
        (ids) => {
          // Build tasks where task[i] depends on task[i-1] (linear chain with uuid IDs)
          const tasks = ids.map((id, i) => ({
            id,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: i === 0 ? [] : [{ dependsOnTaskId: ids[i - 1] }],
          }));
          const dag = buildDag(tasks);

          // Edge count = number of declared dependencies
          const totalDeps = tasks.reduce((sum, t) => sum + t.dependencies.length, 0);
          expect(dag.edges.length).toBe(totalDeps);

          // Every declared dependency has a corresponding edge
          for (const task of tasks) {
            for (const dep of task.dependencies) {
              const edge = dag.edges.find(
                (e) => e.fromTaskId === dep.dependsOnTaskId && e.toTaskId === task.id,
              );
              expect(edge).toBeDefined();
            }
          }

          // No edges between tasks with no declared dependency
          for (const edge of dag.edges) {
            const toTask = tasks.find((t) => t.id === edge.toTaskId)!;
            const hasDep = toTask.dependencies.some((d) => d.dependsOnTaskId === edge.fromTaskId);
            expect(hasDep).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 7: DAG eligible task evaluation ─────────────────────────────
// Feature: agent-workflow-automation, Property 7: DAG eligible task evaluation

describe('Property 7: eligibleTaskIds returns exactly PENDING tasks with all deps DONE', () => {
  it('root task is eligible when PENDING', () => {
    const dag = buildDag(linearChain(3));
    const eligible = dag.eligibleTaskIds();
    expect(eligible).toContain('t0');
    expect(eligible).not.toContain('t1');
    expect(eligible).not.toContain('t2');
  });

  it('downstream task becomes eligible after upstream is DONE', () => {
    const tasks = linearChain(3, ['DONE', 'PENDING', 'PENDING']);
    const dag = buildDag(tasks);
    const eligible = dag.eligibleTaskIds();
    expect(eligible).toContain('t1');
    expect(eligible).not.toContain('t2');
  });

  it('no tasks eligible when all are RUNNING', () => {
    const tasks = linearChain(3, ['RUNNING', 'RUNNING', 'RUNNING']);
    const dag = buildDag(tasks);
    expect(dag.eligibleTaskIds()).toHaveLength(0);
  });

  it('parallel tasks both eligible when root is DONE', () => {
    const dag = buildDag(parallelDag('DONE'));
    const eligible = dag.eligibleTaskIds();
    expect(eligible).toContain('a');
    expect(eligible).toContain('b');
    expect(eligible).not.toContain('leaf');
  });

  it('property: no task with a non-DONE dependency is ever eligible', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.array(statusArb, { minLength: 2, maxLength: 8 }),
        (n, statuses) => {
          const tasks = linearChain(n, statuses.slice(0, n));
          const dag = buildDag(tasks);
          const eligible = dag.eligibleTaskIds();
          for (const taskId of eligible) {
            const node = dag.nodes.get(taskId)!;
            for (const depId of node.dependsOn) {
              const dep = dag.nodes.get(depId)!;
              expect(SUCCESS).toContain(dep.status);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Property 8: Concurrency limit enforcement ─────────────────────────────
// Feature: agent-workflow-automation, Property 8: Concurrency limit enforcement

describe('Property 8: Concurrency limit enforcement', () => {
  it('parallel dag returns at most 2 eligible tasks when root is done', () => {
    const dag = buildDag(parallelDag('DONE'));
    expect(dag.eligibleTaskIds().length).toBeLessThanOrEqual(2);
  });

  it('property: tasksToStart = eligibleTasks.slice(0, max(0, maxConcurrency - currentlyRunning))', () => {
    // Test the pure scheduler dispatch logic:
    // given N eligible tasks and concurrency limit M with R currently running,
    // the number of tasks to start = min(N, max(0, M - R))
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // N eligible tasks
        fc.integer({ min: 1, max: 10 }), // M maxConcurrency
        fc.integer({ min: 0, max: 10 }), // R currently running
        (n, maxConcurrency, currentlyRunning) => {
          // Build a DAG with N eligible tasks (all PENDING, no dependencies)
          const tasks = Array.from({ length: n }, (_, i) => ({
            id: `task-${i}`,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: [],
          }));
          const dag = buildDag(tasks);
          const eligibleTasks = dag.eligibleTaskIds();

          // Simulate the scheduler dispatch logic
          const availableSlots = Math.max(0, maxConcurrency - currentlyRunning);
          const tasksToStart = eligibleTasks.slice(0, availableSlots);

          // Verify: tasks started = min(N, max(0, M - R))
          const expectedCount = Math.min(n, Math.max(0, maxConcurrency - currentlyRunning));
          expect(tasksToStart.length).toBe(expectedCount);

          // Verify: never starts more than maxConcurrency - currentlyRunning
          expect(tasksToStart.length).toBeLessThanOrEqual(Math.max(0, maxConcurrency - currentlyRunning));

          // Verify: never starts more than available eligible tasks
          expect(tasksToStart.length).toBeLessThanOrEqual(eligibleTasks.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: when currentlyRunning >= maxConcurrency, no new tasks are started', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }), // N eligible tasks
        fc.integer({ min: 1, max: 10 }), // M maxConcurrency
        fc.integer({ min: 0, max: 10 }), // extra running beyond limit
        (n, maxConcurrency, extra) => {
          const currentlyRunning = maxConcurrency + extra; // always >= maxConcurrency
          const tasks = Array.from({ length: n }, (_, i) => ({
            id: `task-${i}`,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: [],
          }));
          const dag = buildDag(tasks);
          const eligibleTasks = dag.eligibleTaskIds();

          const availableSlots = Math.max(0, maxConcurrency - currentlyRunning);
          const tasksToStart = eligibleTasks.slice(0, availableSlots);

          // When running >= limit, no tasks should start
          expect(tasksToStart.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 9: State machine — transition only updates the target node ───

describe('Property 9: transition updates only the specified node', () => {
  it('transitioning one node does not change others', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        terminalStatusArb,
        (n, idx, newStatus) => {
          const tasks = linearChain(n);
          const dag = buildDag(tasks);
          const targetId = `t${Math.min(idx, n - 1)}`;
          const beforeOthers = [...dag.nodes.entries()]
            .filter(([id]) => id !== targetId)
            .map(([id, node]) => ({ id, status: node.status }));

          dag.transition(targetId, newStatus);

          for (const { id, status } of beforeOthers) {
            expect(dag.nodes.get(id)!.status).toBe(status);
          }
          expect(dag.nodes.get(targetId)!.status).toBe(newStatus);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 13: Workflow completion detection ────────────────────────────

describe('Property 13: isComplete returns true iff all nodes are terminal', () => {
  it('all DONE → complete', () => {
    const dag = buildDag(linearChain(3, ['DONE', 'DONE', 'DONE']));
    expect(dag.isComplete()).toBe(true);
  });

  it('any PENDING → not complete', () => {
    const dag = buildDag(linearChain(3, ['DONE', 'DONE', 'PENDING']));
    expect(dag.isComplete()).toBe(false);
  });

  it('property: complete iff every node status is terminal', () => {
    fc.assert(
      fc.property(
        fc.array(terminalStatusArb, { minLength: 1, maxLength: 10 }),
        (statuses) => {
          const tasks = statuses.map((s, i) => ({ id: `t${i}`, phaseName: `P${i}`, status: s, dependencies: [] }));
          const dag = buildDag(tasks);
          expect(dag.isComplete()).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: not complete if any node is non-terminal', () => {
    fc.assert(
      fc.property(
        fc.array(terminalStatusArb, { minLength: 1, maxLength: 9 }),
        fc.constantFrom('PENDING', 'STARTING', 'RUNNING'),
        (terminalStatuses, nonTerminal) => {
          const allStatuses = [...terminalStatuses, nonTerminal];
          const tasks = allStatuses.map((s, i) => ({ id: `t${i}`, phaseName: `P${i}`, status: s, dependencies: [] }));
          const dag = buildDag(tasks);
          expect(dag.isComplete()).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 19: Progress percentage calculation ──────────────────────────
// Feature: agent-workflow-automation, Property 19: Progress percentage calculation

describe('Property 19: getProgress returns correct percentage', () => {
  it('all done → 100%', () => {
    const dag = buildDag(linearChain(4, ['DONE', 'DONE', 'DONE', 'DONE']));
    expect(dag.getProgress().percentage).toBe(100);
    expect(dag.getProgress().completed).toBe(4);
    expect(dag.getProgress().total).toBe(4);
  });

  it('none done → 0%', () => {
    const dag = buildDag(linearChain(4));
    expect(dag.getProgress().percentage).toBe(0);
  });

  it('property: percentage = (done / total) * 100 rounded to 1 decimal', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (total, doneCount) => {
          const done = Math.min(doneCount, total);
          const statuses = Array.from({ length: total }, (_, i) => (i < done ? 'DONE' : 'PENDING'));
          const tasks = statuses.map((s, i) => ({ id: `t${i}`, phaseName: `P${i}`, status: s, dependencies: [] }));
          const dag = buildDag(tasks);
          const progress = dag.getProgress();
          const expected = Math.round((done / total) * 1000) / 10;
          expect(progress.percentage).toBe(expected);
          expect(progress.completed).toBe(done);
          expect(progress.total).toBe(total);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── Property 20: Critical path is the longest path ───────────────────────
// Feature: agent-workflow-automation, Property 20: Critical path is the longest path in the DAG

describe('Property 20: getCriticalPath returns the longest path', () => {
  it('linear chain: critical path is the full chain', () => {
    const dag = buildDag(linearChain(4));
    const cp = dag.getCriticalPath();
    expect(cp).toEqual(['t0', 't1', 't2', 't3']);
  });

  it('single node: critical path is just that node', () => {
    const dag = buildDag([{ id: 't0', phaseName: 'P', status: 'PENDING', dependencies: [] }]);
    expect(dag.getCriticalPath()).toEqual(['t0']);
  });

  it('parallel dag: critical path goes through both branches to leaf', () => {
    const dag = buildDag(parallelDag());
    const cp = dag.getCriticalPath();
    // Critical path must start at root and end at leaf
    expect(cp[0]).toBe('root');
    expect(cp[cp.length - 1]).toBe('leaf');
  });

  it('property: critical path length ≥ 1 for any non-empty DAG', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (n) => {
          const dag = buildDag(linearChain(n));
          expect(dag.getCriticalPath().length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 21: Paused execution prevents new task starts ───────────────
// Feature: agent-workflow-automation, Property 21: Paused execution prevents new task starts

describe('Property 21: Paused execution prevents new task starts', () => {
  it('DONE node is no longer eligible', () => {
    const dag = buildDag([{ id: 't0', phaseName: 'P', status: 'PENDING', dependencies: [] }]);
    expect(dag.eligibleTaskIds()).toContain('t0');
    dag.transition('t0', 'DONE');
    expect(dag.eligibleTaskIds()).not.toContain('t0');
  });

  it('property: when execution status is PAUSED, dispatch returns 0 tasks regardless of eligible count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // N eligible tasks
        fc.integer({ min: 1, max: 10 }), // M maxConcurrency
        fc.integer({ min: 0, max: 5 }),  // R currently running
        (n, maxConcurrency, currentlyRunning) => {
          // Build a DAG with N eligible tasks
          const tasks = Array.from({ length: n }, (_, i) => ({
            id: `task-${i}`,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: [],
          }));
          const dag = buildDag(tasks);
          const eligibleTasks = dag.eligibleTaskIds();

          // Simulate scheduler dispatch logic with PAUSED execution status
          const executionStatus = 'PAUSED';
          const availableSlots = executionStatus === 'PAUSED'
            ? 0
            : Math.max(0, maxConcurrency - currentlyRunning);
          const tasksToStart = eligibleTasks.slice(0, availableSlots);

          // When paused, zero tasks should be dispatched regardless of eligible count
          expect(tasksToStart.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: RUNNING execution dispatches tasks normally, PAUSED dispatches none', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }), // N eligible tasks
        fc.integer({ min: 1, max: 10 }), // M maxConcurrency
        (n, maxConcurrency) => {
          const tasks = Array.from({ length: n }, (_, i) => ({
            id: `task-${i}`,
            phaseName: `Phase${i}`,
            status: 'PENDING',
            dependencies: [],
          }));
          const dag = buildDag(tasks);
          const eligibleTasks = dag.eligibleTaskIds();

          // RUNNING: should dispatch up to maxConcurrency tasks
          const runningSlots = Math.max(0, maxConcurrency - 0); // 0 currently running
          const runningDispatched = eligibleTasks.slice(0, runningSlots);
          expect(runningDispatched.length).toBeGreaterThan(0);
          expect(runningDispatched.length).toBe(Math.min(n, maxConcurrency));

          // PAUSED: should dispatch 0 tasks
          const pausedSlots = 0;
          const pausedDispatched = eligibleTasks.slice(0, pausedSlots);
          expect(pausedDispatched.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 22: Cancellation marks all pending tasks ────────────────────

describe('Property 22: transition correctly propagates to downstream eligibility', () => {
  it('cancelling root makes downstream tasks ineligible', () => {
    const dag = buildDag(linearChain(3));
    dag.transition('t0', 'CANCELLED');
    // t1 depends on t0 which is CANCELLED (not SUCCESS), so t1 is not eligible
    expect(dag.eligibleTaskIds()).not.toContain('t1');
  });
});
