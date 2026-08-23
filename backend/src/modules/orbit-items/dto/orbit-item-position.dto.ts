import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class OrbitItemPositionDto {
  @ApiProperty()
  @IsNumber()
  leftPercent: number;

  @ApiProperty()
  @IsNumber()
  topPercent: number;
}
