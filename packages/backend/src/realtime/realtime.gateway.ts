import { Injectable, Logger } from '@nestjs/common';
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

export interface WorkspaceStatus {
  agentCount: number;
  skillCount: number;
  pipelineCount: number;
  activeRuns: {
    running: number;
    paused: number;
    failed: number;
  };
  slashCommands: Array<{ name: string; description: string }>;
}

export interface EpicRunStepUpdate {
  stepId: string;
  stepOrder: number;
  status: string;
  output?: string;
  timestamp: string;
}

/**
 * NOTE: This gateway requires @nestjs/websockets and @nestjs/platform-socket.io packages.
 * Install with: npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 */
@Injectable()
@WebSocketGateway({
  namespace: '/workspace',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected to workspace gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected from workspace gateway: ${client.id}`);
  }

  /**
   * Handles workspace:subscribe — client joins a project-scoped room
   * to receive live updates for that project's workspace.
   */
  @SubscribeMessage('workspace:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ): { event: string; data: { subscribed: boolean; projectId: string } } {
    if (!data?.projectId) {
      client.emit('workspace:error', { error: 'Missing projectId' });
      return { event: 'workspace:subscribe', data: { subscribed: false, projectId: '' } };
    }

    const room = `project:${data.projectId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to project ${data.projectId}`);

    return {
      event: 'workspace:subscribe',
      data: { subscribed: true, projectId: data.projectId },
    };
  }

  /**
   * Broadcasts workspace status update to all clients in the project room.
   * Called by other services (e.g., WorkspaceConfigService) when entities change.
   */
  emitWorkspaceStatus(projectId: string, status: WorkspaceStatus): void {
    const room = `project:${projectId}`;
    this.server.to(room).emit('workspace:status', {
      projectId,
      status,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`Emitted workspace:status to project ${projectId}`);
  }

  /**
   * Broadcasts epic run step progress to all clients in the project room.
   * Called by EpicRunService when step transitions occur.
   */
  emitEpicRunProgress(projectId: string, epicRunId: string, stepUpdate: EpicRunStepUpdate): void {
    const room = `project:${projectId}`;
    this.server.to(room).emit('epicrun:progress', {
      projectId,
      epicRunId,
      stepUpdate,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(
      `Emitted epicrun:progress for run ${epicRunId} step ${stepUpdate.stepOrder} to project ${projectId}`,
    );
  }
}
