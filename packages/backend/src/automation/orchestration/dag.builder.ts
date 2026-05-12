/**
 * DAG Builder
 * Converts a list of WorkflowTasks (with dependency edges) into an adjacency
 * structure used by the scheduler to find executable (unblocked) tasks.
 */

export interface DagNode {
  taskId: string;
  phaseName: string;
  status: string;
  dependsOn: string[]; // task IDs this task is waiting for
}

export interface Dag {
  nodes: Map<string, DagNode>;
  /** Tasks with no unresolved dependencies and status PENDING */
  eligibleTaskIds(): string[];
  /** Returns true when every node is DONE or SKIPPED */
  isComplete(): boolean;
  /** Mark a task with a new status and return newly eligible task IDs */
  transition(taskId: string, status: string): string[];
}

export function buildDag(
  tasks: Array<{
    id: string;
    phaseName: string;
    status: string;
    dependencies: Array<{ dependsOnTaskId: string }>;
  }>,
): Dag {
  const nodes = new Map<string, DagNode>();

  for (const t of tasks) {
    nodes.set(t.id, {
      taskId: t.id,
      phaseName: t.phaseName,
      status: t.status,
      dependsOn: t.dependencies.map((d) => d.dependsOnTaskId),
    });
  }

  const terminalStatuses = new Set(['DONE', 'SKIPPED', 'FAILED', 'TIMED_OUT']);
  const successStatuses  = new Set(['DONE', 'SKIPPED']);

  return {
    nodes,

    eligibleTaskIds() {
      const eligible: string[] = [];
      for (const node of nodes.values()) {
        if (node.status !== 'PENDING') continue;
        const allDepsDone = node.dependsOn.every((depId) => {
          const dep = nodes.get(depId);
          return dep ? successStatuses.has(dep.status) : true; // unknown dep → treat as done
        });
        if (allDepsDone) eligible.push(node.taskId);
      }
      return eligible;
    },

    isComplete() {
      return [...nodes.values()].every((n) => terminalStatuses.has(n.status));
    },

    transition(taskId: string, status: string): string[] {
      const node = nodes.get(taskId);
      if (!node) return [];
      node.status = status;
      // After a successful transition, return newly eligible tasks
      if (successStatuses.has(status)) {
        return this.eligibleTaskIds();
      }
      return [];
    },
  };
}
