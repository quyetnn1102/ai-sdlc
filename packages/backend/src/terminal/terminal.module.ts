import { Module } from '@nestjs/common';
import { PtyService } from './pty.service';
import { TerminalGateway } from './terminal.gateway';

/**
 * TerminalModule provides PTY-based terminal session management
 * and a WebSocket gateway for real-time terminal I/O streaming.
 *
 * NOTE: Requires @nestjs/websockets and @nestjs/platform-socket.io packages.
 * Install with: npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 */
@Module({
  providers: [PtyService, TerminalGateway],
  exports: [PtyService],
})
export class TerminalModule {}
