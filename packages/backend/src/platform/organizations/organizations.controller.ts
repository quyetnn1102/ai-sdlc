import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  create(@Body() dto: CreateOrganizationDto, @Request() req: any) {
    return this.organizationsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations for current user (paginated)' })
  @ApiQuery({ name: 'page',  required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  findAll(
    @Request() req: any,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.organizationsService.findAll(req.user.id, {
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}
