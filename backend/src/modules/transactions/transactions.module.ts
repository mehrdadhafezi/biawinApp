import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [WalletModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
