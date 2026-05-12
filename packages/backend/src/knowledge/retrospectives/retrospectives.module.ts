import { Module } from '@nestjs/common';
import { RetrospectivesService } from './retrospectives.service';
import { RetrospectivesController } from './retrospectives.controller';

@Module({
  providers: [RetrospectivesService],
  controllers: [RetrospectivesController],
  exports: [RetrospectivesService],
})
export class RetrospectivesModule {}
