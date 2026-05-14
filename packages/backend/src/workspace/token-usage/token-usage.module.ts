import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { TokenUsageService } from './token-usage.service';
import { CostSuggestionService } from './cost-suggestion.service';
import { TokenUsageController } from './token-usage.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TokenUsageController],
  providers: [TokenUsageService, CostSuggestionService],
  exports: [TokenUsageService, CostSuggestionService],
})
export class TokenUsageModule {}
