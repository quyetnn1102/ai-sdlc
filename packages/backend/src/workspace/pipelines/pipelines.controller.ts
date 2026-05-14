import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { PipelinesService } from './pipelines.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

@ApiTags('Pipelines')
@Controller('projects/:projectId/pipelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  @ApiOperation({ summary: 'List all pipelines for a project' })
  findAll(@Param('projectId') projectId: string) {
    return this.pipelinesService.findAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pipeline with steps' })
  findById(@Param('id') id: string) {
    return this.pipelinesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.pipelinesService.create(projectId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update pipeline metadata' })
  update(@Param('id') id: string, @Body() dto: UpdatePipelineDto) {
    return this.pipelinesService.update(id, dto);
  }

  @Put(':id/steps')
  @ApiOperation({ summary: 'Reorder pipeline steps' })
  reorderSteps(@Param('id') id: string, @Body() dto: ReorderStepsDto) {
    return this.pipelinesService.reorderSteps(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pipeline' })
  delete(@Param('id') id: string) {
    return this.pipelinesService.delete(id);
  }
}
