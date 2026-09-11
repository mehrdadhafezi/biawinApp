import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * SERVICES-R5.22 — matches `Service.faq`'s real, already-rendered shape
 * (`ServiceInfo.tsx`: `{question, answer}[]`) exactly. Closes a confirmed
 * gap: the field existed on the schema and was rendered to customers
 * since R1, but had no admin write path at all — `ServicesService.create()`
 * hardcoded `faq: []` unconditionally.
 */
export class ServiceFaqItemDto {
  @ApiProperty()
  @IsString()
  question: string;

  @ApiProperty()
  @IsString()
  answer: string;
}
