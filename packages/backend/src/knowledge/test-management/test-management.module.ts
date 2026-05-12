import { Module } from '@nestjs/common';
import { TestCasesService } from './test-cases.service';
import { TestPlansService } from './test-plans.service';
import { TestRunsService } from './test-runs.service';
import { TestManagementController } from './test-management.controller';

@Module({
  providers: [TestCasesService, TestPlansService, TestRunsService],
  controllers: [TestManagementController],
  exports: [TestCasesService, TestPlansService, TestRunsService],
})
export class TestManagementModule {}
