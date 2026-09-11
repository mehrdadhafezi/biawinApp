import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  /**
   * SERVICES-R5.24 — `skip` is a derived, read-only value (always computed
   * from `page`/`limit`), never a real client input — it has no
   * `@IsInt()`/validation decorator on purpose. Without this setter, the
   * global `ValidationPipe`'s `plainToInstance()` step crashes with an
   * unhandled 500 ("Cannot set property skip of ... which has only a
   * getter") the instant ANY caller sends a raw `?skip=` query param to
   * ANY of the 19 endpoints whose query DTO extends this class — the
   * crash happens during transformation, before `whitelist`/
   * `forbidNonWhitelisted` (both already enabled, `backend/src/main.ts`)
   * ever get a chance to reject it as an unrecognized property. This
   * no-op setter absorbs that assignment harmlessly so the pipeline
   * reaches validation, where `forbidNonWhitelisted` now correctly turns
   * a stray `?skip=` into a clean 400 ("property skip should not exist")
   * instead of an unhandled 500 — confirmed live, see
   * docs/services-r5-24-staging-catalog-media-qa-audit.md.
   */
  set skip(_ignored: number) {
    // Intentionally a no-op — see the getter's own doc comment above.
  }
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
