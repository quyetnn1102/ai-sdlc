import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { platform } from 'os';

export interface TerminalSession {
  id: string;
  userId: string;
  process: ChildProcess;
  cols: number;
  rows: number;
  createdAt: Date;
}

/**
 * PtyService manages terminal sessions per user.
 * Uses child_process.spawn for basic terminal functionality (not a full PTY library
 * like node-pty which requires native compilation).
 *
 * NOTE: Requires @nestjs/websockets and @nestjs/platform-socket.io packages
 * for the WebSocket gateway integration.
 */
@Injectable()
export class PtyService {
  private readonly logger = new Logger(PtyService.name);
  private readonly sessions = new Map<string, TerminalSession>();

  /**
   * Creates a new terminal session by spawning a shell process.
   * Returns the sessionId for future reference.
   */
  createSession(userId: string): string {
    const sessionId = randomUUID();
    const shell = platform() === 'win32' ? 'cmd' : 'bash';

    const proc = spawn(shell, [], {
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: TerminalSession = {
      id: sessionId,
      userId,
      process: proc,
      cols: 80,
      rows: 24,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    proc.on('exit', (code) => {
      this.logger.log(`Session ${sessionId} process exited with code ${code}`);
      this.sessions.delete(sessionId);
    });

    proc.on('error', (err) => {
      this.logger.error(`Session ${sessionId} process error: ${err.message}`);
      this.sessions.delete(sessionId);
    });

    this.logger.log(`Created terminal session ${sessionId} for user ${userId} (shell: ${shell})`);
    return sessionId;
  }

  /**
   * Writes data to the process stdin for the given session.
   */
  sendInput(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process.stdin || session.process.stdin.destroyed) {
      return false;
    }
    session.process.stdin.write(data);
    return true;
  }

  /**
   * Resize placeholder — for basic child_process.spawn, resize signals
   * are not directly supported. A full PTY library (node-pty) would be
   * needed for proper resize support.
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    // Store dimensions for reference; actual resize requires node-pty
    session.cols = cols;
    session.rows = rows;
    this.logger.debug(`Session ${sessionId} resize requested: ${cols}x${rows} (no-op without PTY)`);
    return true;
  }

  /**
   * Kills the process and removes the session from the map.
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.process.kill();
    } catch (err) {
      this.logger.warn(`Error killing session ${sessionId}: ${(err as Error).message}`);
    }

    this.sessions.delete(sessionId);
    this.logger.log(`Closed terminal session ${sessionId}`);
    return true;
  }

  /**
   * Returns session info or null if not found.
   */
  getSession(sessionId: string): TerminalSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Returns all sessions for a given user.
   */
  getSessionsForUser(userId: string): TerminalSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  /**
   * Closes all sessions for a given user. Used on client disconnect.
   */
  closeAllSessionsForUser(userId: string): void {
    const userSessions = this.getSessionsForUser(userId);
    for (const session of userSessions) {
      this.closeSession(session.id);
    }
  }
}
