import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * RealtimeModule provides a WebSocket gateway for live workspace status updates
 * and epic run progress notifications.
 *
 * NOTE: Requires @nestjs/websockets and @nestjs/platform-socket.io packages.
 * Install with: npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 */
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
