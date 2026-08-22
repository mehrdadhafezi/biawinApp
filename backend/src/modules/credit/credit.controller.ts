import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ListCreditQueryDto } from './dto/list-query.dto';
import { CreditService } from './credit.service';

@ApiTags('credit')
@ApiBearerAuth()
@Controller({ path: 'credit', version: '1' })
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get()
  list(
    @Query() pagination: ListCreditQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.creditService.list(
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
    return this.creditService.findOneOrThrow(id, currentUser.userId);
  }
}
