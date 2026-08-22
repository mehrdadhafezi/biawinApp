import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ListInstallmentsQueryDto } from './dto/list-query.dto';
import { InstallmentsService } from './installments.service';

@ApiTags('installments')
@ApiBearerAuth()
@Controller({ path: 'installments', version: '1' })
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  list(
    @Query() pagination: ListInstallmentsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.installmentsService.list(
      pagination.skip,
      pagination.limit,
      currentUser.userId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.installmentsService.findOneOrThrow(id, currentUser.userId);
  }
}
