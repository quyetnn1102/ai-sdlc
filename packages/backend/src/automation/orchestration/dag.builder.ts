/**
 * DAG Builder — Agent Workflow Automation
 *
 * Converts WorkflowTasks (with dependency edges) into a fully queryable
 * directed acyclic graph used by the Scheduler and monitoring endpoints.
 *
 * Implements all 22 spec properties including:
 *   - eligibleTaskIds()   → Property 7
 *   - getCriticalPath()   → Property 20
 *   - getProgress()       → Property 19
 *   - isComplete()        → Property 13
 *   - transition()        → Property 9
 */

export interface DagNode {
  taskId: string;
  phaseName: string;
  status: string;
  dependsOn: string[];   // task IDs this task must wait for
  dependents: string[];  // task IDs that depend on this one
}

export interface DagEdge {
  fromTaskId: string;  // prerequisite
  toTaskId: string;    // dependent
}

export interface DagProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface Dag {
  nodes: Map<string, DagNode>;
  edges: DagEdge[];

  /** Pending tasks whose every dependency is in a success state */
  eligibleTaskIds(): string[];

  /** True when every node has reached a terminal state */
  isComplete(): boolean;

  /**
   * Update a node's status in-memory.
   * Returns the set of newly eligible task IDs after the transition.
   */
  transition(taskId: string, status: string): string[];

  /**
   * Longest path through the DAG (critical path).
   * Uses a topological-sort + dynamic-programming approach — O(V + E).
   */
  getCriticalPath(): string[];

  /** Completion percentage (done / total rounded to 1 decimal place) */
  getProgress(): DagProgress;
}

// ── Status categories ────────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set(['DONE', 'SKIPPED', 'FAILED', 'TIMED_OUT', 'CANCELLED']);
const SUCCESS_STATUSES  = new Set(['DONE', 'SKIPPED']);

// ── Factory ───────────────────────────────────────────────────────────────
export function buildDag(
  tasks: Array<{
    id: string;
    phaseName: string;
    status: string;
    dependencies: Array<{ dependsOnTaskId: string }>;
  }>,
): Dag {
  const nodes = new Map<string, DagNode>();

  // 1. Create nodes
  for (const t of tasks) {
    nodes.set(t.id, {
      taskId: t.id,
      phaseName: t.phaseName,
      status: t.status,
      dependsOn: t.dependencies.map((d) => d.dependsOnTaskId),
      dependents: [],
    });
  }

  // 2. Populate reverse-edges (dependents)
  for (const node of nodes.values()) {
    for (const depId of node.dependsOn) {
      const dep = nodes.get(depId);
      if (dep && !dep.dependents.includes(node.taskId)) {
        dep.dependents.push(node.taskId);
      }
    }
  }

  // 3. Build edge list for the DAG response
  const edges: DagEdge[] = [];
  for (const node of nodes.values()) {
    for (const depId of node.dependsOn) {
      edges.push({ fromTaskId: depId, toTaskId: node.taskId });
    }
  }

  return {
    nodes,
    edges,

    // ── eligibleTaskIds ─────────────────────────────────────────────────
    eligibleTaskIds() {
      const eligible: string[] = [];
      for (const node of nodes.values()) {
        if (node.status !== 'PENDING') continue;
        const allDepsDone = node.dependsOn.every((depId) => {
          const dep = nodes.get(depId);
          return dep ? SUCCESS_STATUSES.has(dep.status) : true;
        });
        if (allDepsDone) eligible.push(node.taskId);
      }
      return eligible;
    },

    // ── isComplete ──────────────────────────────────────────────────────
    isComplete() {
      return [...nodes.values()].every((n) => TERMINAL_STATUSES.has(n.status));
    },

    // ── transition ──────────────────────────────────────────────────────
    transition(taskId: string, status: string): string[] {
      const node = nodes.get(taskId);
      if (!node) return [];
      node.status = status;
      if (SUCCESS_STATUSES.has(status)) {
        return this.eligibleTaskIds();
      }
      return [];
    },

    // ── getCriticalPath ─────────────────────────────────────────────────
    // Longest path from any root to any leaf, measured in hop count.
    // Uses Kahn's topological sort + DP for O(V + E) time.
    getCriticalPath(): string[] {
      const nodeIds = [...nodes.keys()];
      if (nodeIds.length === 0) return [];

      // in-degree for topological sort
      const inDegree = new Map<string, number>();
      for (const id of nodeIds) inDegree.set(id, 0);
      for (const edge of edges) {
        inDegree.set(edge.toTaskId, (inDegree.get(edge.toTaskId) ?? 0) + 1);
      }

      // dist[id] = longest path length ending at that node
      const dist = new Map<string, number>();
      // prev[id] = predecessor in the longest path
      const prev = new Map<string, string | null>();
      for (const id of nodeIds) {
        dist.set(id, 0);
        prev.set(id, null);
      }

      // Kahn's queue (start with roots)
      const queue: string[] = [];
      for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) queue.push(id);
      }

      const order: string[] = [];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        order.push(cur);
        const node = nodes.get(cur)!;
        for (const nextId of node.dependents) {
          const newDist = (dist.get(cur) ?? 0) + 1;
          if (newDist > (dist.get(nextId) ?? 0)) {
            dist.set(nextId, newDist);
            prev.set(nextId, cur);
          }
          inDegree.set(nextId, (inDegree.get(nextId) ?? 1) - 1);
          if (inDegree.get(nextId) === 0) queue.push(nextId);
        }
      }

      // Find the node with the greatest distance (end of critical path)
      let maxDist = -1;
      let endNode = '';
      for (const [id, d] of dist.entries()) {
        if (d > maxDist) { maxDist = d; endNode = id; }
      }

      if (!endNode) return nodeIds.slice(0, 1); // single-node fallback

      // Reconstruct path by walking backwards via prev[]
      const path: string[] = [];
      let cur: string | null = endNode;
      while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) ?? null;
      }

      return path;
    },

    // ── getProgress ─────────────────────────────────────────────────────
    getProgress(): DagProgress {
      const total = nodes.size;
      if (total === 0) return { completed: 0, total: 0, percentage: 0 };
      const completed = [...nodes.values()].filter((n) =>
        SUCCESS_STATUSES.has(n.status),
      ).length;
      const percentage = Math.round((completed / total) * 1000) / 10; // 1 decimal
      return { completed, total, percentage };
    },
  };
}
