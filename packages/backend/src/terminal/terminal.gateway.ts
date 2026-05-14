import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PtyService } from './pty.service';

/**
 * NOTE: This gateway requires @nestjs/websockets and @nestjs/platform-socket.io packages.
 * Install with: npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 */
@WebSocketGateway({
  namespace: '/terminal',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TerminalGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TerminalGateway.name);

  @WebSocketServer()
  server: Server;

  /** Maps client socket ID to their active session IDs */
  private readonly clientSessions = new Map<string, Set<string>>();

  constructor(private readonly ptyService: PtyService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientSessions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up all open sessions for this client
    const sessions = this.clientSessions.get(client.id);
    if (sessions) {
      for (const sessionId of sessions) {
        this.ptyService.closeSession(sessionId);
      }
    }
    this.clientSessions.delete(client.id);
  }

  @SubscribeMessage('terminal:open')
  handleOpen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): { event: string; data: { sessionId: string } } | { event: string; data: { error: string } } {
    try {
      const userId = data?.userId || client.id;
      const sessionId = this.ptyService.createSession(userId);

      // Track session for this client
      const sessions = this.clientSessions.get(client.id);
      if (sessions) {
        sessions.add(sessionId);
      }

      // Set up stdout/stderr streaming to client
      const session = this.ptyService.getSession(sessionId);
      if (session && session.process.stdout) {
        session.process.stdout.on('data', (chunk: Buffer) => {
          client.emit('terminal:output', {
            sessionId,
            data: chunk.toString(),
          });
        });
      }

      if (session && session.process.stderr) {
        session.process.stderr.on('data', (chunk: Buffer) => {
          client.emit('terminal:output', {
            sessionId,
            data: chunk.toString(),
          });
        });
      }

      // Notify client on process exit
      if (session) {
        session.process.on('exit', (code) => {
          client.emit('terminal:close', {
            sessionId,
            code,
          });
          const clientSessions = this.clientSessions.get(client.id);
          if (clientSessions) {
            clientSessions.delete(sessionId);
          }
        });
      }

      this.logger.log(`Terminal session opened: ${sessionId} for client ${client.id}`);
      return { event: 'terminal:open', data: { sessionId } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open terminal session';
      this.logger.error(`Failed to open terminal: ${message}`);
      client.emit('terminal:error', { error: message });
      return { event: 'terminal:error', data: { error: message } };
    }
  }

  @SubscribeMessage('terminal:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; data: string },
  ): void {
    if (!data?.sessionId || data.data === undefined) {
      client.emit('terminal:error', { error: 'Missing sessionId or data' });
      return;
    }

    const success = this.ptyService.sendInput(data.sessionId, data.data);
    if (!success) {
      client.emit('terminal:error', {
        error: `Session ${data.sessionId} not found or stdin unavailable`,
        sessionId: data.sessionId,
      });
    }
  }

  @SubscribeMessage('terminal:resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; cols: number; rows: number },
  ): void {
    if (!data?.sessionId || !data.cols || !data.rows) {
      client.emit('terminal:error', { error: 'Missing sessionId, cols, or rows' });
      return;
    }

    const success = this.ptyService.resize(data.sessionId, data.cols, data.rows);
    if (!success) {
      client.emit('terminal:error', {
        error: `Session ${data.sessionId} not found`,
        sessionId: data.sessionId,
      });
    }
  }

  @SubscribeMessage('terminal:close')
  handleClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ): void {
    if (!data?.sessionId) {
      client.emit('terminal:error', { error: 'Missing sessionId' });
      return;
    }

    const success = this.ptyService.closeSession(data.sessionId);
    if (success) {
      const sessions = this.clientSessions.get(client.id);
      if (sessions) {
        sessions.delete(data.sessionId);
      }
      this.logger.log(`Terminal session closed: ${data.sessionId}`);
    } else {
      client.emit('terminal:error', {
        error: `Session ${data.sessionId} not found`,
        sessionId: data.sessionId,
      });
    }
  }
}
