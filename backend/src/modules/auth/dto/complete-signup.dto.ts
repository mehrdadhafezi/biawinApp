import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteSignupDto {
  @ApiProperty({
    description:
      'Short-lived token returned by POST /auth/otp/verify when status is "signup_required".',
  })
  @IsString()
  signupToken: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiPropertyOptional({
    description:
      'Optional code entered at signup. Not part of authentication — passed through to the membership domain for real redemption/activation.',
  })
  @IsOptional()
  @IsString()
  subscriptionCode?: string;
}
