import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsPositive, IsString } from 'class-validator';
import type { PurchaseMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty({ enum: ['credit', 'installment', 'cash', 'free'] })
  @IsIn(['credit', 'installment', 'cash', 'free'])
  method: PurchaseMethod;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  amount: number;
}
