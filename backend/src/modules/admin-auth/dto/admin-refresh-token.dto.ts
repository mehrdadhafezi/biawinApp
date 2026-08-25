import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AdminRefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
