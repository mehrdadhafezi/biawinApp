# Home Prototype Asset Map (Stage 5.13)

41 real photos extracted verbatim from
`biawin_single_file_app_requested_edits_v15.html`'s inline base64 `<img>`
tags — replacing every emoji/gradient placeholder the Stage 5.13
correction pass found in the Credit Power ticker, Service Banner Grid,
Membership Story Strip, Service Mosaic, and News Carousel.

## Extraction method

A one-off Python script read the prototype file line-by-line within
each section's known line range, matched `<img alt="..." src="data:image/
webp;base64,...">` tags, decoded the base64 payload, and wrote each to
`apps/web/public/home/<subdir>/item-NN.<ext>` (all turned out to be
`.webp`, the same format the prototype itself embeds). Deduplicated by
`alt` text — the ticker's duplicate DOM groups (used for the seamless
infinite-scroll loop) share one file, referenced twice in code, not
extracted twice. Total: 41 files, 688 KB.

## `apps/web/public/home/categories/` — Credit Power ticker (16 images)

Referenced by `CATEGORY_TICKER_IMAGE` in `home.mock.ts`, rendered by
`CategoriesSection.tsx`'s `.credit-service-photo`.

| Persian name | File | Source line |
|---|---|---|
| خودرو | `item-01.webp` | 7060 |
| لوازم خانگی | `item-02.webp` | 7064 |
| زیبایی | `item-03.webp` | 7068 |
| بیمه | `item-04.webp` | 7072 |
| سلامت | `item-05.webp` | 7076 |
| مبلمان | `item-06.webp` | 7080 |
| مالی | `item-07.webp` | 7084 |
| کودک | `item-08.webp` | 7088 |
| طلا | `item-09.webp` | 7130 |
| پوشاک | `item-10.webp` | 7134 |
| گردشگری | `item-11.webp` | 7138 |
| دیجیتال | `item-12.webp` | 7142 |
| ورزش | `item-13.webp` | 7146 |
| آموزش | `item-14.webp` | 7150 |
| خرید روزمره | `item-15.webp` | 7154 |
| کارت هدیه | `item-16.webp` | 7158 |

## `apps/web/public/home/banners/` — Service Banner Grid (5 images)

Referenced by `SERVICE_BANNERS` in `home.mock.ts`, rendered by
`ServiceBannerGrid.tsx`. Matched to real seeded `Category` rows by name.

| Category | Alt (prototype) | File |
|---|---|---|
| اتومبیل | خرید خودرو | `item-01.webp` |
| لوازم خانگی | لوازم خانگی | `item-02.webp` |
| پوشاک | پوشاک و استایل | `item-03.webp` |
| طلا و جواهر | طلا و جواهر | `item-04.webp` |
| گردشگری (wide) | گردشگری و سفر | `item-05.webp` |

## `apps/web/public/home/membership/` — Membership Story Strip (8 images)

Referenced by `MEMBERSHIP_TIER_IMAGE` in `home.mock.ts`, rendered by
`MembershipStoryStrip.tsx`. Keyed by the exact `MembershipPlanDto.title`
string the real `GET /subscriptions` API returns for each tier — real
backend data, real prototype photo.

| Tier (`plan.title`) | File |
|---|---|
| کارت شروع | `item-01.webp` |
| کارت پلاس | `item-02.webp` |
| کارت خانواده | `item-03.webp` |
| کارت پرایم | `item-04.webp` |
| کارت هدیه | `item-05.webp` |
| کارت سفر | `item-06.webp` |
| کارت سبک زندگی | `item-07.webp` |
| کارت سازمانی | `item-08.webp` |

## `apps/web/public/home/mosaic/` — Service Mosaic (4 images)

Referenced by `SERVICE_MOSAIC_HALVES` / `SERVICE_MOSAIC_WIDE` in
`home.mock.ts`, rendered by `ServiceMosaic.tsx`.

| Category | Alt (prototype) | File |
|---|---|---|
| زیبایی (half tile) | لوازم آرایشی | `item-01.webp` |
| بیمه (half tile) | بیمه | `item-02.webp` |
| مبلمان (wide slide) | مبلمان | `item-03.webp` |
| دیجیتال (wide slide) | کالای دیجیتال | `item-04.webp` |

## `apps/web/public/home/news/` — News Carousel (8 images)

Referenced by `NEWS_ARTICLES` in `home.mock.ts`, rendered by
`NewsCarousel.tsx`.

| Article category | File |
|---|---|
| معرفی بیاوین | `item-01.webp` |
| قرعه‌کشی بیاوین | `item-02.webp` |
| جوایز رایگان | `item-03.webp` |
| اعتبار اقساطی | `item-04.webp` |
| خدمات زیبایی | `item-05.webp` |
| خانه و زندگی | `item-06.webp` |
| سفر و گردشگری | `item-07.webp` |
| کارت‌های اشتراک | `item-08.webp` |

## Not extracted (by design, not an oversight)

- **Home Stories bubble icons** — the prototype renders these as inline
  line-icon SVGs (`<svg><path.../></svg>`), not photos. No base64 to
  extract; `HomeStories.tsx` already reproduces the same SVG paths.
- **Biawin Cards Carousel** — the 3 hero cards are pure CSS
  gradients/typography in the prototype, no `<img>` at all.

## Future

Once `imageUrl` resolution exists for `Category.imageKey` /
`Service.imageKey` (docs/services-ui-contract.md §6 Gap #3), these
static files are the natural seed for the real Media Library — same
visual content, served from the backend/CDN instead of `public/`.
