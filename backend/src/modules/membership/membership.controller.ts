import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ListMembershipQueryDto } from './dto/list-query.dto';
import { MembershipService } from './membership.service';

@ApiTags('membership')
@ApiBearerAuth()
@Controller({ path: 'membership', version: '1' })
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  list(
    @Query() pagination: ListMembershipQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.membershipService.list(
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
    return this.membershipService.findOneOrThrow(id, currentUser.userId);
  }
}
