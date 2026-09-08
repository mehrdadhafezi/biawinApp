import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CustomerCardsService } from './customer-cards.service';

@ApiTags('customer-cards')
@ApiBearerAuth()
@Controller({ path: 'customer/cards', version: '1' })
export class CustomerCardsController {
  constructor(private readonly customerCardsService: CustomerCardsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.customerCardsService.list(
      currentUser.userId,
      pagination.skip,
      pagination.limit,
    );
  }

  @Get(':id')
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customerCardsService.findOneOrThrow(id, currentUser.userId);
  }

  @Get(':id/usage')
  listUsage(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.customerCardsService.listUsage(
      id,
      currentUser.userId,
      pagination.skip,
      pagination.limit,
    );
  }
}
