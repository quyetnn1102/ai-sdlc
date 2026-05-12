/**
 * DagVisualization — pure React + SVG DAG renderer
 *
 * No external dependencies (React Flow, D3, etc.). Renders the full
 * dependency graph returned by GET /projects/:id/workflow-executions/:id/dag
 *
 * Layout: layered Sugiyama-style (topological levels → columns, within
 * each column nodes are evenly spread vertically).
 *
 * Features
 *  - Color-coded nodes by task status (spec Req 8.2)
 *  - Critical-path edges rendered with accent colour + thick stroke (Req 8.5)
 *  - "At-risk" nodes pulsing amber border (Req 8.3)
 *  - Node click → detail side panel
 *  - Zoom & pan via CSS transform
 *  - Progress bar + legend
 */

import { useState, useRef, useCallback, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';

// ── Types (match GET /dag response shape) ────────────────────────────────

export interface DagTask {
  id: string;
  phaseName: string;
  status: string;      // PENDING | STARTING | RUNNING | DONE | FAILED | TIMED_OUT | CANCELLED | SKIPPED
  agentName: string;
  agentRole: string;
  startedAt?: string;
  elapsedMs?: number | null;
  isAtRisk: boolean;
  isCriticalPath: boolean;
}

export interface DagEdge {
  fromTaskId: string;
  toTaskId: string;
}

export interface DagData {
  tasks: DagTask[];
  edges: DagEdge[];
  criticalPath: string[];
  progress: { completed: number; total: number; percentage: number };
}

// ── Constants ─────────────────────────────────────────────────────────────

const NODE_W   = 200;
const NODE_H   = 72;
const H_GAP    = 80;   // horizontal gap between columns
const V_GAP    = 24;   // vertical gap between nodes in same column
const PAD_X    = 40;
const PAD_Y    = 40;

// Status → fill / stroke colours matching design tokens
const STATUS_STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  PENDING:    { fill: '#1E1E1E', stroke: '#6B7280',  text: '#9CA3AF' },
  STARTING:   { fill: '#1a2a3a', stroke: '#F59E0B',  text: '#F59E0B' },
  RUNNING:    { fill: '#1a2240', stroke: '#4F6EF7',  text: '#93B4FF' },
  DONE:       { fill: '#0f2a1a', stroke: '#22C55E',  text: '#86EFAC' },
  FAILED:     { fill: '#2a0f0f', stroke: '#EF4444',  text: '#FCA5A5' },
  TIMED_OUT:  { fill: '#2a1a0f', stroke: '#F97316',  text: '#FDBA74' },
  CANCELLED:  { fill: '#1a1a1a', stroke: '#374151',  text: '#6B7280' },
  SKIPPED:    { fill: '#1a1a1a', stroke: '#374151',  text: '#6B7280' },
};

const AT_RISK_STROKE  = '#F59E0B';
const CRITICAL_STROKE = '#4F6EF7';
const NORMAL_STROKE   = '#FFFFFF20';

function getStyle(task: DagTask) {
  return STATUS_STYLE[task.status.toUpperCase()] ?? STATUS_STYLE.PENDING;
}

function formatElapsed(ms: number | null | undefined): string {
  if (!ms) return '';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

// ── Layout engine ─────────────────────────────────────────────────────────

interface LayoutNode {
  task: DagTask;
  col: number;
  row: number;
  x: number;
  y: number;
  cx: number; // center x
  cy: number; // center y
}

function computeLayout(tasks: DagTask[], edges: DagEdge[]): LayoutNode[] {
  if (tasks.length === 0) return [];

  // 1. Build adjacency (predecessors)
  const pred = new Map<string, string[]>();
  for (const t of tasks) pred.set(t.id, []);
  for (const e of edges) pred.get(e.toTaskId)?.push(e.fromTaskId);

  // 2. Assign columns via longest-path-from-source (topological DP)
  const col = new Map<string, number>();
  const visited = new Set<string>();

  function assignCol(id: string): number {
    if (col.has(id)) return col.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const preds = pred.get(id) ?? [];
    const c = preds.length === 0 ? 0 : Math.max(...preds.map(assignCol)) + 1;
    col.set(id, c);
    return c;
  }
  for (const t of tasks) assignCol(t.id);

  // 3. Group into columns and assign rows
  const colMap = new Map<number, string[]>();
  for (const t of tasks) {
    const c = col.get(t.id) ?? 0;
    if (!colMap.has(c)) colMap.set(c, []);
    colMap.get(c)!.push(t.id);
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const nodes: LayoutNode[] = [];

  for (const [colIdx, ids] of colMap.entries()) {
    ids.forEach((id, rowIdx) => {
      const task = taskById.get(id)!;
      const x = PAD_X + colIdx * (NODE_W + H_GAP);
      const y = PAD_Y + rowIdx * (NODE_H + V_GAP);
      nodes.push({
        task,
        col: colIdx,
        row: rowIdx,
        x,
        y,
        cx: x + NODE_W / 2,
        cy: y + NODE_H / 2,
      });
    });
  }

  return nodes;
}

// ── Edge path (cubic bezier) ──────────────────────────────────────────────

function edgePath(from: LayoutNode, to: LayoutNode): string {
  const x1 = from.x + NODE_W;
  const y1 = from.cy;
  const x2 = to.x;
  const y2 = to.cy;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

// ── Legend ────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: 'Pending',   colour: '#6B7280' },
  { label: 'Starting',  colour: '#F59E0B' },
  { label: 'Running',   colour: '#4F6EF7' },
  { label: 'Done',      colour: '#22C55E' },
  { label: 'Failed',    colour: '#EF4444' },
  { label: 'At Risk',   colour: '#F97316', dashed: true },
  { label: 'Critical Path', colour: '#4F6EF7', thick: true },
];

// ── Main component ────────────────────────────────────────────────────────

interface DagVisualizationProps {
  data: DagData;
  onTaskClick?: (task: DagTask) => void;
  className?: string;
}

export function DagVisualization({ data, onTaskClick, className }: DagVisualizationProps) {
  const { tasks, edges, criticalPath, progress } = data;
  const nodes = computeLayout(tasks, edges);

  // ── Viewport dimensions ─────────────────────────────────────────────
  const maxCol = Math.max(0, ...nodes.map((n) => n.col));
  const maxRow = Math.max(0, ...nodes.map((n) => n.row));
  const svgW = PAD_X * 2 + (maxCol + 1) * NODE_W + maxCol * H_GAP;
  const svgH = PAD_Y * 2 + (maxRow + 1) * NODE_H + maxRow * V_GAP;

  // ── Zoom / pan state ────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last     = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if ((e.target as SVGElement).closest('[data-task-node]')) return;
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - last.current.x),
      y: p.y + (e.clientY - last.current.y),
    }));
    last.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // ── Lookup helpers ──────────────────────────────────────────────────
  const nodeById = new Map(nodes.map((n) => [n.task.id, n]));
  const criticalSet = new Set(criticalPath);

  const isEdgeCritical = (e: DagEdge) =>
    criticalSet.has(e.fromTaskId) && criticalSet.has(e.toTaskId);

  return (
    <div className={cn('flex flex-col gap-3', className)}>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Progress — {progress.completed} / {progress.total} tasks done</span>
          <span className="tabular-nums font-medium text-text-primary">{progress.percentage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-primary transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <svg width="20" height="10">
              {item.thick ? (
                <line x1="0" y1="5" x2="20" y2="5"
                  stroke={item.colour} strokeWidth="3" strokeDasharray={item.dashed ? '4 2' : undefined} />
              ) : item.dashed ? (
                <rect x="1" y="2" width="18" height="6" rx="2"
                  fill="none" stroke={item.colour} strokeWidth="1.5" strokeDasharray="3 2" />
              ) : (
                <rect x="1" y="2" width="18" height="6" rx="2"
                  fill={`${item.colour}22`} stroke={item.colour} strokeWidth="1.5" />
              )}
            </svg>
            {item.label}
          </div>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">Zoom</span>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          className="w-6 h-6 rounded bg-bg-elevated text-text-primary text-sm hover:bg-bg-hover">+</button>
        <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
          className="w-6 h-6 rounded bg-bg-elevated text-text-primary text-sm hover:bg-bg-hover">−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 h-6 rounded bg-bg-elevated text-xs text-text-secondary hover:bg-bg-hover">Reset</button>
      </div>

      {/* SVG canvas */}
      <div
        className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: Math.min(600, svgH * zoom + 80) }}
        onWheel={onWheel}
        onMouseDown={onMouseDown as any}
        onMouseMove={onMouseMove as any}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'none',
          }}
        >
          <defs>
            {/* Arrow marker — normal */}
            <marker id="arrow-normal" markerWidth="8" markerHeight="8"
              refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#FFFFFF20" />
            </marker>
            {/* Arrow marker — critical */}
            <marker id="arrow-critical" markerWidth="8" markerHeight="8"
              refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={CRITICAL_STROKE} />
            </marker>
          </defs>

          {/* ── Edges ─────────────────────────────────────────────── */}
          {edges.map((edge) => {
            const from = nodeById.get(edge.fromTaskId);
            const to   = nodeById.get(edge.toTaskId);
            if (!from || !to) return null;
            const critical = isEdgeCritical(edge);
            return (
              <path
                key={`${edge.fromTaskId}-${edge.toTaskId}`}
                d={edgePath(from, to)}
                fill="none"
                stroke={critical ? CRITICAL_STROKE : NORMAL_STROKE}
                strokeWidth={critical ? 2.5 : 1.5}
                strokeDasharray={critical ? undefined : '4 3'}
                markerEnd={critical ? 'url(#arrow-critical)' : 'url(#arrow-normal)'}
                opacity={0.85}
              />
            );
          })}

          {/* ── Nodes ─────────────────────────────────────────────── */}
          {nodes.map((node) => {
            const { task, x, y } = node;
            const style = getStyle(task);
            const isCritical = criticalSet.has(task.id);
            const elapsed = formatElapsed(task.elapsedMs);

            return (
              <g
                key={task.id}
                data-task-node="1"
                style={{ cursor: 'pointer' }}
                onClick={() => onTaskClick?.(task)}
              >
                {/* At-risk animated outer ring */}
                {task.isAtRisk && (
                  <rect
                    x={x - 3} y={y - 3}
                    width={NODE_W + 6} height={NODE_H + 6}
                    rx={11} fill="none"
                    stroke={AT_RISK_STROKE} strokeWidth={2}
                    opacity={0.7}
                  >
                    <animate attributeName="opacity" values="0.7;0.2;0.7"
                      dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}

                {/* Critical-path outer glow */}
                {isCritical && !task.isAtRisk && (
                  <rect
                    x={x - 2} y={y - 2}
                    width={NODE_W + 4} height={NODE_H + 4}
                    rx={10} fill="none"
                    stroke={CRITICAL_STROKE} strokeWidth={1.5} opacity={0.5}
                  />
                )}

                {/* Node body */}
                <rect
                  x={x} y={y}
                  width={NODE_W} height={NODE_H}
                  rx={8}
                  fill={style.fill}
                  stroke={task.isAtRisk ? AT_RISK_STROKE : style.stroke}
                  strokeWidth={1.5}
                />

                {/* Status indicator bar (left edge) */}
                <rect
                  x={x} y={y + 8}
                  width={3} height={NODE_H - 16}
                  rx={1.5}
                  fill={style.stroke}
                />

                {/* Phase name */}
                <text
                  x={x + 14} y={y + 22}
                  fontSize={12} fontWeight={600}
                  fill={style.text}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {task.phaseName.length > 20
                    ? task.phaseName.slice(0, 19) + '…'
                    : task.phaseName}
                </text>

                {/* Agent name */}
                <text
                  x={x + 14} y={y + 38}
                  fontSize={10}
                  fill="#FFFFFF60"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {task.agentName.length > 24
                    ? task.agentName.slice(0, 23) + '…'
                    : task.agentName}
                </text>

                {/* Status badge */}
                <rect
                  x={x + 14} y={y + 46}
                  width={80} height={16}
                  rx={4} fill={`${style.stroke}22`}
                />
                <text
                  x={x + 22} y={y + 58}
                  fontSize={9} fontWeight={500}
                  fill={style.stroke}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {task.status}
                </text>

                {/* Elapsed time (right side) */}
                {elapsed && (
                  <text
                    x={x + NODE_W - 8} y={y + 58}
                    fontSize={9}
                    fill="#FFFFFF40"
                    fontFamily="Inter, system-ui, sans-serif"
                    textAnchor="end"
                  >
                    {elapsed}
                  </text>
                )}

                {/* Running spinner indicator */}
                {task.status === 'RUNNING' && (
                  <circle
                    cx={x + NODE_W - 12} cy={y + 14}
                    r={5}
                    fill="none" stroke={CRITICAL_STROKE} strokeWidth={1.5}
                    strokeDasharray="8 4"
                  >
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${x + NODE_W - 12} ${y + 14}`}
                      to={`360 ${x + NODE_W - 12} ${y + 14}`}
                      dur="1s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Done checkmark */}
                {task.status === 'DONE' && (
                  <text
                    x={x + NODE_W - 14} y={y + 18}
                    fontSize={12} fill="#22C55E"
                    fontFamily="Inter, system-ui, sans-serif"
                  >✓</text>
                )}

                {/* Failed ✕ */}
                {(task.status === 'FAILED' || task.status === 'TIMED_OUT') && (
                  <text
                    x={x + NODE_W - 14} y={y + 18}
                    fontSize={12} fill="#EF4444"
                    fontFamily="Inter, system-ui, sans-serif"
                  >✕</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
          No tasks in this execution yet.
        </div>
      )}
    </div>
  );
}
