import {
  Controller,
  Post,
  Headers,
  Body,
  RawBodyRequest,
  Req,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * GitHub webhook receiver.
   * URL: POST /api/webhooks/github/:projectId
   * Header: X-GitHub-Event, X-Hub-Signature-256
   */
  @Post('github/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive GitHub webhook events' })
  @ApiParam({ name: 'projectId', description: 'SDLC Hub project UUID' })
  async receiveGitHub(
    @Param('projectId') projectId: string,
    @Headers('x-github-event') eventType: string,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
  ) {
    if (!eventType) throw new BadRequestException('Missing X-GitHub-Event header');

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    await this.webhooksService.handleGitHub(projectId, eventType, signature, rawBody, payload);
    return { received: true };
  }

  /**
   * Jira webhook receiver.
   * URL: POST /api/webhooks/jira/:projectId
   */
  @Post('jira/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Jira webhook events' })
  @ApiParam({ name: 'projectId', description: 'SDLC Hub project UUID' })
  async receiveJira(
    @Param('projectId') projectId: string,
    @Headers('x-hub-signature') signature: string,
    @Body() payload: Record<string, unknown>,
  ) {
    const eventType = payload.webhookEvent as string;
    if (!eventType) throw new BadRequestException('Missing webhookEvent in payload');

    await this.webhooksService.handleJira(projectId, eventType, signature, payload);
    return { received: true };
  }
}
