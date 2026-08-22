import { ApiProperty } from '@nestjs/swagger';
import { Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '09121234567' })
  @Matches(/^09\d{9}$/, {
    message: 'phone must be a valid Iranian mobile number (09xxxxxxxxx)',
  })
  phone: string;

  @ApiProperty({ example: '123456' })
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code: string;
}
