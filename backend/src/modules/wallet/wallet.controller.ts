import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { WalletKind } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller({ path: 'wallet', version: '1' })
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.walletService.listForUser(currentUser.userId);
  }

  @Get(':kind/transactions')
  transactions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('kind') kind: WalletKind,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.walletService.listTransactions(
      currentUser.userId,
      kind,
      pagination.skip,
      pagination.limit,
    );
  }
}
