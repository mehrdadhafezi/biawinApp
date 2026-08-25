import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The file itself arrives as a multipart `file` field, handled by
 * `FileInterceptor`/`@UploadedFile()` — not part of this DTO (class-
 * validator has nothing to validate on a `Buffer`). This covers the
 * optional accompanying form fields only.
 */
export class UploadMediaDto {
  @ApiPropertyOptional({
    description: 'Accessibility alt text for the uploaded image.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;
}
