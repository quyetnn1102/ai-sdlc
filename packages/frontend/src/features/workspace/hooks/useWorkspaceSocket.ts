/**
 * Custom hook for connecting to the /workspace WebSocket namespace.
 * Subscribes to a project room on mount and returns live workspace status
 * and epic run progress events.
 *
 * Implements auto-reconnection with exponential backoff (1s, 2s, 4s, max 30s).
 *
 * Requires: socket.io-client (peer dependency)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WorkspaceStatus, EpicRunStep } from '../api/workspace.service';

export interface WorkspaceSocketState {
  connected: boolean;
  status: WorkspaceStatus | null;
  lastEpicRunProgress: EpicRunProgressEvent | null;
  error: string | null;
}

export interface EpicRunProgressEvent {
  epicRunId: string;
  step: EpicRunStep;
  runStatus: string;
  timestamp: string;
}

interface UseWorkspaceSocketOptions {
  /** Project ID to subscribe to */
  projectId: string;
  /** Whether the socket should be active (default: true) */
  enabled?: boolean;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useWorkspaceSocket({
  projectId,
  enabled = true,
}: UseWorkspaceSocketOptions): WorkspaceSocketState {
  const [state, setState] = useState<WorkspaceSocketState>({
    connected: false,
    status: null,
    lastEpicRunProgress: null,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !projectId) {
      cleanup();
      setState((s) => ({ ...s, connected: false }));
      return;
    }

    const token = localStorage.getItem('sdlc_token');

    const socket = io('/workspace', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false, // We handle reconnection manually
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      backoffRef.current = INITIAL_BACKOFF_MS;
      setState((s) => ({ ...s, connected: true, error: null }));
      // Subscribe to the project room
      socket.emit('workspace:subscribe', { projectId });
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
      scheduleReconnect();
    });

    socket.on('connect_error', (err: Error) => {
      setState((s) => ({ ...s, connected: false, error: err.message }));
      scheduleReconnect();
    });

    socket.on('workspace:status', (data: WorkspaceStatus) => {
      setState((s) => ({ ...s, status: data }));
    });

    socket.on('epicrun:progress', (data: EpicRunProgressEvent) => {
      setState((s) => ({ ...s, lastEpicRunProgress: data }));
    });

    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        socket.connect();
      }, delay);
    }

    return () => {
      cleanup();
    };
  }, [projectId, enabled, cleanup]);

  return state;
}
