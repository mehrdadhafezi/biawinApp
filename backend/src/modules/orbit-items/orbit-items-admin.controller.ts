import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateOrbitItemDto } from './dto/create-orbit-item.dto';
import { ReorderOrbitItemsDto } from './dto/reorder-orbit-items.dto';
import { UpdateOrbitItemDto } from './dto/update-orbit-item.dto';
import { OrbitItemsService } from './orbit-items.service';

/**
 * Mutation endpoints for the Orbit catalog. Gated by the global
 * JwtAuthGuard only (authenticated, not role-checked) — this codebase has
 * no admin-role/RBAC system yet; adding one is out of scope for this data
 * migration. Revisit once a real RBAC feature exists.
 */
@ApiTags('orbit-items-admin')
@ApiBearerAuth()
@Controller({ path: 'admin/orbit-items', version: '1' })
export class OrbitItemsAdminController {
  constructor(private readonly orbitItemsService: OrbitItemsService) {}

  @Post()
  create(@Body() dto: CreateOrbitItemDto) {
    return this.orbitItemsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrbitItemDto) {
    return this.orbitItemsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orbitItemsService.remove(id);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderOrbitItemsDto) {
    return this.orbitItemsService.reorder(dto);
  }
}
