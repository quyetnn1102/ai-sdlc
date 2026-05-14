/**
 * Custom hook for connecting to the /terminal WebSocket namespace.
 * Provides methods to open, send input, resize, and close terminal sessions.
 * Returns terminal output stream and connection state.
 *
 * Implements auto-reconnection with exponential backoff (1s, 2s, 4s, max 30s).
 *
 * Requires: socket.io-client (peer dependency)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TerminalSocketState {
  connected: boolean;
  sessionId: string | null;
  error: string | null;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalErrorEvent {
  sessionId: string;
  message: string;
}

interface UseTerminalSocketOptions {
  /** Whether the socket should be active (default: true) */
  enabled?: boolean;
  /** Callback for terminal output data */
  onOutput?: (event: TerminalOutputEvent) => void;
  /** Callback for terminal errors */
  onError?: (event: TerminalErrorEvent) => void;
}

interface TerminalActions {
  open: (options?: { cols?: number; rows?: number }) => void;
  sendInput: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  close: () => void;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useTerminalSocket({
  enabled = true,
  onOutput,
  onError,
}: UseTerminalSocketOptions = {}): TerminalSocketState & TerminalActions {
  const [state, setState] = useState<TerminalSocketState>({
    connected: false,
    sessionId: null,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOutputRef = useRef(onOutput);
  const onErrorRef = useRef(onError);

  // Keep callback refs up to date
  onOutputRef.current = onOutput;
  onErrorRef.current = onError;

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
    if (!enabled) {
      cleanup();
      setState({ connected: false, sessionId: null, error: null });
      return;
    }

    const token = localStorage.getItem('sdlc_token');

    const socket = io('/terminal', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false, // We handle reconnection manually
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      backoffRef.current = INITIAL_BACKOFF_MS;
      setState((s) => ({ ...s, connected: true, error: null }));
    });

    socket.on('disconnect', () => {
      setState((s) => ({ ...s, connected: false }));
      scheduleReconnect();
    });

    socket.on('connect_error', (err: Error) => {
      setState((s) => ({ ...s, connected: false, error: err.message }));
      scheduleReconnect();
    });

    socket.on('terminal:output', (event: TerminalOutputEvent) => {
      onOutputRef.current?.(event);
    });

    socket.on('terminal:error', (event: TerminalErrorEvent) => {
      onErrorRef.current?.(event);
      setState((s) => ({ ...s, error: event.message }));
    });

    // When a session is opened, the server responds with the session ID
    socket.on('terminal:opened', (data: { sessionId: string }) => {
      setState((s) => ({ ...s, sessionId: data.sessionId }));
    });

    socket.on('terminal:closed', () => {
      setState((s) => ({ ...s, sessionId: null }));
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
  }, [enabled, cleanup]);

  const open = useCallback((options?: { cols?: number; rows?: number }) => {
    socketRef.current?.emit('terminal:open', {
      cols: options?.cols ?? 80,
      rows: options?.rows ?? 24,
    });
  }, []);

  const sendInput = useCallback((data: string) => {
    socketRef.current?.emit('terminal:input', { data });
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    socketRef.current?.emit('terminal:resize', { cols, rows });
  }, []);

  const close = useCallback(() => {
    socketRef.current?.emit('terminal:close');
    setState((s) => ({ ...s, sessionId: null }));
  }, []);

  return {
    ...state,
    open,
    sendInput,
    resize,
    close,
  };
}
