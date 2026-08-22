import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiProperty() inviteCode: string;
  @ApiProperty({ nullable: true }) phoneVerifiedAt: Date | null;
  @ApiProperty() twoFactorEnabled: boolean;
  @ApiProperty() status: string;
}
