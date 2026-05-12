import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { AdaptersModule } from '../adapters/adapters.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [AdaptersModule, IntegrationsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
