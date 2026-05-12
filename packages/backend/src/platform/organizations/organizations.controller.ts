import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List organizations for current user' })
  findAll(@Request() req: any) {
    return this.organizationsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }
}
