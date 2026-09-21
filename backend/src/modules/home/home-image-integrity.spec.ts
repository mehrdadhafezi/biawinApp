import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Stage 5.16-B image-integrity regression (docs/STAGE-5.16-HOME-BACKEND-
 * HARDENING-PLAN.md §11.3). Existing customer card / category-card /
 * category / service artwork must never be touched by Home hardening.
 *
 * Static guard: the Home CMS services and the media service (the only code
 * touched by this stage) may WRITE only their own tables. They may read
 * `category`/`mediaAsset`/reference tables, never mutate the tables that hold
 * protected image references (`card_products`, `category_cards`,
 * `categories`, `services` incl. `galleryMediaAssetIds`), and never issue
 * raw SQL.
 */

const homeDir = __dirname;
const mediaDir = join(__dirname, '..', 'media');

function sources(dir: string, only?: RegExp) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .filter((f) => !only || only.test(f))
    .map((f) => ({
      file: join(dir, f),
      text: readFileSync(join(dir, f), 'utf8'),
    }));
}

const guarded = [
  ...sources(homeDir),
  ...sources(join(homeDir, 'dto')),
  ...sources(mediaDir, /^media(\.service|-storage\.service|\.controller)\.ts$/),
];

const WRITE = '(create|createMany|update|updateMany|upsert|delete|deleteMany)';
const PROTECTED_MODELS = [
  'cardProduct',
  'categoryCard',
  'category',
  'service',
  'customerCard',
  'order',
];

describe('Stage 5.16-B image-integrity guard (static)', () => {
  it('scans a non-trivial set of source files', () => {
    expect(guarded.length).toBeGreaterThan(15);
  });

  it.each(PROTECTED_MODELS)(
    'no guarded file writes to prisma.%s (protected image-reference table)',
    (model) => {
      const pattern = new RegExp(`\\.${model}\\.${WRITE}\\b`);
      const offenders = guarded
        .filter((s) => pattern.test(s.text))
        .map((s) => s.file);
      expect(offenders).toEqual([]);
    },
  );

  it('no guarded file issues raw SQL or writes mediaAssetId/galleryMediaAssetIds on a protected table', () => {
    const offenders = guarded
      .filter((s) =>
        /\$(executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe)/.test(s.text),
      )
      .map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('the media service touches only mediaAsset for writes, and reads other tables only via count()', () => {
    const media = readFileSync(join(mediaDir, 'media.service.ts'), 'utf8');
    const writes = [
      ...media.matchAll(
        new RegExp(`this\\.prisma\\.(\\w+)\\.${WRITE}\\b`, 'g'),
      ),
    ].map((m) => m[1]);
    expect([...new Set(writes)]).toEqual(['mediaAsset']);

    const nonMediaAccess = [...media.matchAll(/this\.prisma\.(\w+)\.(\w+)\b/g)]
      .filter((m) => m[1] !== 'mediaAsset')
      .map((m) => `${m[1]}.${m[2]}`);
    expect(nonMediaAccess.length).toBeGreaterThan(0);
    expect(nonMediaAccess.every((a) => a.endsWith('.count'))).toBe(true);
  });

  it('Home services write only their own home_* table', () => {
    for (const s of guarded.filter((g) =>
      /home-[a-z-]+\.service\.ts$/.test(g.file),
    )) {
      const written = [
        ...s.text.matchAll(
          new RegExp(`this\\.prisma\\.(\\w+)\\.${WRITE}\\b`, 'g'),
        ),
      ].map((m) => m[1]);
      expect(written.length).toBeGreaterThan(0);
      expect([...new Set(written)]).toHaveLength(1);
      expect(written[0]).toMatch(
        /^home(HeroCard|ServiceBanner|ServiceMosaicTile|NewsArticle)$/,
      );
    }
  });
});
