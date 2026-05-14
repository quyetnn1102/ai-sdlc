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
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@ApiTags('Skills')
@Controller('projects/:projectId/skills')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all skills for a project' })
  findAll(@Param('projectId') projectId: string) {
    return this.skillsService.findAll(projectId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List available skill templates' })
  listTemplates() {
    return this.skillsService.listTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get skill by ID' })
  findById(@Param('id') id: string) {
    return this.skillsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new skill' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSkillDto,
  ) {
    return this.skillsService.create(projectId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update skill content and metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a skill' })
  delete(@Param('id') id: string) {
    return this.skillsService.delete(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate skill markdown structure' })
  validate(@Body('content') content: string) {
    return this.skillsService.validate(content);
  }
}
