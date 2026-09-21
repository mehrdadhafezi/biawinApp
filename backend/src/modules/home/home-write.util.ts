import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Stage 5.16-B — shared write-path guards for the 4 Home CMS services
 * (docs/STAGE-5.16-HOME-BACKEND-HARDENING-PLAN.md §3–§5). Handled locally in
 * the Home services on purpose: the global `HttpExceptionFilter` is not
 * touched, so no other module's error behavior changes.
 *
 * Everything here is READ-ONLY toward image references: it validates that a
 * referenced Category/MediaAsset exists, it never writes `mediaAssetId` (or
 * any other column) on any table — see `home-image-integrity.spec.ts`.
 */

/**
 * Deterministic ordering: `sortOrder` first, then creation time, then id so
 * rows sharing a `sortOrder` never swap places between requests. Rows with
 * unique `sortOrder` (every row in the inspected staging data) keep exactly
 * the order they had before.
 */
export const HOME_ORDER_BY = [
  { sortOrder: 'asc' as const },
  { createdAt: 'asc' as const },
  { id: 'asc' as const },
];

/** Existing catalog convention (`services.service.ts` `assertCategoryExists`): 422 + this exact Persian message. */
export const INVALID_CATEGORY_MESSAGE = 'دسته‌بندی انتخاب‌شده معتبر نیست.';
export const INVALID_MEDIA_MESSAGE = 'رسانه انتخاب‌شده معتبر نیست.';
export const DUPLICATE_CARD_KEY_MESSAGE =
  'این کلید کارت قبلاً استفاده شده است.';
export const DUPLICATE_BODY_SLUG_MESSAGE =
  'این نامک مقاله قبلاً استفاده شده است.';
export const DUPLICATE_VALUE_MESSAGE = 'مقدار وارد‌شده تکراری است.';
export const INVALID_REFERENCE_MESSAGE = 'مرجع انتخاب‌شده معتبر نیست.';
export const ROW_NOT_FOUND_MESSAGE = 'مورد موردنظر یافت نشد.';
export const INVALID_REORDER_IDS_MESSAGE =
  'برخی از موارد انتخاب‌شده برای تغییر ترتیب یافت نشدند.';

/**
 * BD-1 (Stage 5.16-A): the Category must EXIST; it is deliberately NOT
 * required to be `active` — an admin may prepare a banner for a category
 * that is not live yet, and public Home keeps its current behavior.
 */
export async function assertCategoryExists(
  prisma: PrismaService,
  categoryId: string | undefined,
): Promise<void> {
  if (categoryId === undefined) return;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category)
    throw new UnprocessableEntityException(INVALID_CATEGORY_MESSAGE);
}

/** `null`/`undefined` (no media, or "clear it") is always allowed; a set id must be an existing, non-soft-deleted asset. */
export async function assertMediaAssetUsable(
  prisma: PrismaService,
  mediaAssetId: string | null | undefined,
): Promise<void> {
  if (mediaAssetId === null || mediaAssetId === undefined) return;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, active: true },
    select: { id: true },
  });
  if (!asset) throw new UnprocessableEntityException(INVALID_MEDIA_MESSAGE);
}

function targetIncludes(
  err: Prisma.PrismaClientKnownRequestError,
  field: string,
) {
  const target = err.meta?.target;
  if (Array.isArray(target))
    return target.some((t) => String(t).includes(field));
  return typeof target === 'string' && target.includes(field);
}

/**
 * Maps the three Prisma failure modes Stage 5.15 found reaching the client
 * as 500 (`P2002` unique, `P2003` foreign key, `P2025` record not found).
 * Anything else is re-thrown UNCHANGED so unexpected failures still surface
 * as 500 and are logged by the global filter.
 */
export function rethrowHomeWriteError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      if (targetIncludes(err, 'cardKey')) {
        throw new ConflictException(DUPLICATE_CARD_KEY_MESSAGE);
      }
      if (targetIncludes(err, 'bodySlug')) {
        throw new ConflictException(DUPLICATE_BODY_SLUG_MESSAGE);
      }
      throw new ConflictException(DUPLICATE_VALUE_MESSAGE);
    }
    if (err.code === 'P2003') {
      throw new UnprocessableEntityException(INVALID_REFERENCE_MESSAGE);
    }
    if (err.code === 'P2025') {
      throw new NotFoundException(ROW_NOT_FOUND_MESSAGE);
    }
  }
  throw err;
}

export interface ReorderEntry {
  id: string;
  sortOrder: number;
}

/**
 * Reorder pre-check (partial semantics are preserved — only the listed rows
 * are ever touched). Confirms every id exists in THIS resource's table
 * BEFORE any write; a miss is 422 and nothing is written. Returns each
 * listed row's previous `sortOrder` for the audit `beforeJson`.
 * Payload shape (empty / malformed uuid / duplicate ids / duplicate
 * positions) is rejected earlier, at DTO validation, as 400.
 */
export async function loadReorderBeforeState(
  entries: ReorderEntry[],
  findExisting: (ids: string[]) => Promise<{ id: string; sortOrder: number }[]>,
): Promise<ReorderEntry[]> {
  const ids = entries.map((entry) => entry.id);
  const rows = await findExisting(ids);
  const existing = new Map(rows.map((row) => [row.id, row.sortOrder]));
  const unknownIds = ids.filter((id) => !existing.has(id));
  if (unknownIds.length > 0) {
    throw new UnprocessableEntityException({
      message: INVALID_REORDER_IDS_MESSAGE,
      details: { unknownIds },
    });
  }
  return ids.map((id) => ({ id, sortOrder: existing.get(id) as number }));
}
