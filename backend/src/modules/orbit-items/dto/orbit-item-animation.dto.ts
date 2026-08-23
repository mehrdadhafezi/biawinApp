import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber } from 'class-validator';

export class OrbitItemAnimationDto {
  @ApiProperty({ enum: ['a', 'b', 'c', 'd'] })
  @IsIn(['a', 'b', 'c', 'd'])
  variant: 'a' | 'b' | 'c' | 'd';

  @ApiProperty()
  @IsNumber()
  delaySeconds: number;
}
