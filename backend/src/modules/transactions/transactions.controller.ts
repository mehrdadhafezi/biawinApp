import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { WalletService } from '../wallet/wallet.service';

/**
 * `transactions` is intentionally a read-model module, not a table owner: it
 * composes WalletService (and, once built, CreditService/InstallmentsService)
 * to answer "show me everything that happened financially" without any
 * module reaching into another module's table directly (Module Boundary
 * Rule, docs/01-architecture.md §2.1).
 */
@ApiTags('transactions')
@ApiBearerAuth()
@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    const [main, reward] = await Promise.all([
      this.walletService.listTransactions(
        currentUser.userId,
        'main',
        pagination.skip,
        pagination.limit,
      ),
      this.walletService.listTransactions(
        currentUser.userId,
        'reward',
        pagination.skip,
        pagination.limit,
      ),
    ]);
    return [...main, ...reward].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
