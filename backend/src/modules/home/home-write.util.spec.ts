import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DUPLICATE_BODY_SLUG_MESSAGE,
  DUPLICATE_CARD_KEY_MESSAGE,
  INVALID_CATEGORY_MESSAGE,
  INVALID_MEDIA_MESSAGE,
  assertCategoryExists,
  assertMediaAssetUsable,
  loadReorderBeforeState,
  rethrowHomeWriteError,
} from './home-write.util';

/** Real Prisma error instances (installed client), not look-alikes — the mapping must work on what Prisma actually throws. */
function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError(`mock ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });
}

describe('rethrowHomeWriteError — Prisma → HTTP mapping (Stage 5.16-B §3)', () => {
  it('P2002 on cardKey → 409 with the cardKey message', () => {
    const run = () =>
      rethrowHomeWriteError(prismaError('P2002', { target: ['cardKey'] }));
    expect(run).toThrow(ConflictException);
    expect(run).toThrow(DUPLICATE_CARD_KEY_MESSAGE);
  });

  it('P2002 on bodySlug → 409 with the bodySlug message (constraint-name style target too)', () => {
    for (const target of [['bodySlug'], 'home_news_articles_bodySlug_key']) {
      const run = () => rethrowHomeWriteError(prismaError('P2002', { target }));
      expect(run).toThrow(ConflictException);
      expect(run).toThrow(DUPLICATE_BODY_SLUG_MESSAGE);
    }
  });

  it('P2002 with unknown/missing meta → still 409 (never falls through to 500)', () => {
    expect(() => rethrowHomeWriteError(prismaError('P2002'))).toThrow(
      ConflictException,
    );
  });

  it('P2003 (foreign key) → 422', () => {
    expect(() => rethrowHomeWriteError(prismaError('P2003'))).toThrow(
      UnprocessableEntityException,
    );
  });

  it('P2025 (record not found on mutation) → 404', () => {
    expect(() => rethrowHomeWriteError(prismaError('P2025'))).toThrow(
      NotFoundException,
    );
  });

  it('any other Prisma code and any non-Prisma error is re-thrown unchanged (still a 500 upstream)', () => {
    const other = prismaError('P1001');
    expect(() => rethrowHomeWriteError(other)).toThrow(other);
    const plain = new Error('boom');
    expect(() => rethrowHomeWriteError(plain)).toThrow(plain);
  });
});

describe('assertCategoryExists / assertMediaAssetUsable (read-only reference checks)', () => {
  const prisma = {
    category: { findUnique: jest.fn() },
    mediaAsset: { findFirst: jest.fn() },
  };
  beforeEach(() => {
    prisma.category.findUnique.mockReset();
    prisma.mediaAsset.findFirst.mockReset();
  });

  it('unknown category → 422 with the existing catalog message', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      assertCategoryExists(prisma as never, 'cat-x'),
    ).rejects.toThrow(
      new UnprocessableEntityException(INVALID_CATEGORY_MESSAGE),
    );
  });

  it('an INACTIVE category is accepted (BD-1: only existence is required)', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    await expect(
      assertCategoryExists(prisma as never, 'cat-1'),
    ).resolves.toBeUndefined();
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      select: { id: true },
    });
  });

  it('absent categoryId (update without it) skips the lookup', async () => {
    await assertCategoryExists(prisma as never, undefined);
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it('unknown or soft-deleted media → 422', async () => {
    prisma.mediaAsset.findFirst.mockResolvedValue(null);
    await expect(
      assertMediaAssetUsable(prisma as never, 'media-x'),
    ).rejects.toThrow(new UnprocessableEntityException(INVALID_MEDIA_MESSAGE));
    expect(prisma.mediaAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'media-x', active: true },
      select: { id: true },
    });
  });

  it('null / undefined media (none, or "clear it") is always accepted without a lookup', async () => {
    await assertMediaAssetUsable(prisma as never, null);
    await assertMediaAssetUsable(prisma as never, undefined);
    expect(prisma.mediaAsset.findFirst).not.toHaveBeenCalled();
  });
});

describe('loadReorderBeforeState', () => {
  it('returns each listed row’s previous sortOrder, in payload order', async () => {
    const result = await loadReorderBeforeState(
      [
        { id: 'b', sortOrder: 0 },
        { id: 'a', sortOrder: 1 },
      ],
      () =>
        Promise.resolve([
          { id: 'a', sortOrder: 7 },
          { id: 'b', sortOrder: 9 },
        ]),
    );
    expect(result).toEqual([
      { id: 'b', sortOrder: 9 },
      { id: 'a', sortOrder: 7 },
    ]);
  });

  it('unknown id → 422 listing the unknown ids', async () => {
    const error = await loadReorderBeforeState(
      [
        { id: 'a', sortOrder: 0 },
        { id: 'ghost', sortOrder: 1 },
      ],
      () => Promise.resolve([{ id: 'a', sortOrder: 0 }]),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toEqual(
      expect.objectContaining({ details: { unknownIds: ['ghost'] } }),
    );
  });
});
