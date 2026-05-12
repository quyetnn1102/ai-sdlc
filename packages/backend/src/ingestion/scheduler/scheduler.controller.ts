import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { SchedulerService } from './scheduler.service';

@ApiTags('Scheduler')
@Controller('scheduler')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('poll')
  @ApiOperation({ summary: 'Manually trigger an ingestion poll cycle (admin / debug)' })
  triggerPoll() {
    return this.schedulerService.pollAll();
  }
}
