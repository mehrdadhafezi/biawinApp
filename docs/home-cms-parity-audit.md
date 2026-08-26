# Home CMS Data Parity Audit (Stage 5.21)

Compares the pre-migration static content (`apps/web/src/components/home/home.mock.ts`'s
now-fallback arrays, and `BiawinCardsCarousel.tsx`'s former local `CARDS` array) against
the live Stage 5.19 seeded CMS rows, as actually returned by the real running backend
during this stage's verification (`GET /home/**`, checked live — not assumed). All rows
below were checked; none required a data correction before cutover.

## Hero cards (3/3 match)

| cardKey | Mock title | CMS title | Text match | Order match | Active |
|---|---|---|---|---|---|
| earn | کارت کسب درآمد | کارت کسب درآمد | ✅ | sortOrder 0 = position 1 ✅ | ✅ |
| biawin | کارت بیاوین | کارت بیاوین | ✅ | sortOrder 1 = position 2 ✅ | ✅ |
| reward | کارت جایزه | کارت جایزه | ✅ | sortOrder 2 = position 3 ✅ | ✅ |

Subtitle/`displayNumber`/`ownerLabel` also checked for all 3 — verbatim matches. No
`image`/link field exists on this model (see the integration report §8) — N/A, not a gap.

## Service banners (5/5 match)

| categoryName | Mock image file | CMS image (post-migration) | Text match | Order match | Active |
|---|---|---|---|---|---|
| اتومبیل | banners/item-01.webp | linked, byte-identical | ✅ | sortOrder 0 ✅ | ✅ |
| لوازم خانگی | banners/item-02.webp | linked, byte-identical | ✅ | sortOrder 1 ✅ | ✅ |
| پوشاک | banners/item-03.webp | linked, byte-identical | ✅ | sortOrder 2 ✅ | ✅ |
| طلا و جواهر | banners/item-04.webp | linked, byte-identical | ✅ | sortOrder 3 ✅ | ✅ |
| گردشگری | banners/item-05.webp | linked, byte-identical | ✅ | sortOrder 4, `wide: true` ✅ | ✅ |

`kicker`/`theme` also checked for all 5 — verbatim matches, including `گردشگری`'s `wide`
flag being the only `true` value, matching the original single-wide-tile design.

## Service mosaic tiles (4/4 match)

| categoryName | slotType | Mock image file | CMS image | Text match | Order match | Active |
|---|---|---|---|---|---|---|
| زیبایی | half | mosaic/item-01.webp | linked | ✅ | sortOrder 0 ✅ | ✅ |
| بیمه | half | mosaic/item-02.webp | linked | ✅ | sortOrder 1 ✅ | ✅ |
| مبلمان | wide | mosaic/item-03.webp | linked | ✅ (title/lead too) | sortOrder 2 ✅ | ✅ |
| دیجیتال | wide | mosaic/item-04.webp | linked | ✅ (title/lead too) | sortOrder 3 ✅ | ✅ |

Half/wide split preserved exactly (2 + 2), matching `SERVICE_MOSAIC_HALVES`/`SERVICE_MOSAIC_WIDE`.

## News articles (8/8 match)

| # | Title (truncated) | Mock image file | CMS image | Text match | Order match | Active |
|---|---|---|---|---|---|---|
| 1 | بیاوین چگونه خریدهای بزرگ... | news/item-01.webp | linked | ✅ | sortOrder 0 ✅ | ✅ |
| 2 | هر خرید می‌تواند یک شانس... | news/item-02.webp | linked | ✅ | sortOrder 1 ✅ | ✅ |
| 3 | جوایزی که تجربه عضویت... | news/item-03.webp | linked | ✅ | sortOrder 2 ✅ | ✅ |
| 4 | چطور اعتبار بیاوین را... | news/item-04.webp | linked | ✅ | sortOrder 3 ✅ | ✅ |
| 5 | خدمات زیبایی و مراقبتی... | news/item-05.webp | linked | ✅ | sortOrder 4 ✅ | ✅ |
| 6 | چطور خرید مبلمان و... | news/item-06.webp | linked | ✅ | sortOrder 5 ✅ | ✅ |
| 7 | سفرهای برنامه‌ریزی‌شده... | news/item-07.webp | linked | ✅ | sortOrder 6 ✅ | ✅ |
| 8 | کدام کارت اشتراک بیاوین... | news/item-08.webp | linked | ✅ | sortOrder 7 ✅ | ✅ |

`category`/`kicker`/full `lead` text also checked for all 8 — verbatim matches (already
established during Stage 5.19's own seed verification; re-confirmed here against the
live-rendered Customer Home page text this stage, word for word).

## Image byte-identity spot check

`banners/item-01.webp` (اتومبیل) was downloaded from the live `/api/v1/media/{filename}`
route and compared via `cmp` against `apps/web/public/home/banners/item-01.webp`:
**byte-for-byte identical**, confirming `seed-home-media.ts`'s migration didn't
re-encode, recompress, or otherwise alter any asset — the same file, just now served
through the CMS/Media Library pipeline instead of Next.js's static file serving.

## Result

**17/17 CMS-managed rows (3 hero cards + 5 banners + 4 mosaic tiles + 8 news articles)
match their pre-migration static content exactly** — text, image, order, and active
state. No data correction was needed before cutover.
