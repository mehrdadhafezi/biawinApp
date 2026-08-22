import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '09121234567' })
  @Matches(/^09\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number (09xxxxxxxxx)',
  })
  phone: string;
}
