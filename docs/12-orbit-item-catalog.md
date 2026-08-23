# 12 — Orbit Item Catalog (Final List Freeze — Stage 1.6)

Contract-only document. No code changed, no assets generated, no UI built —
this freezes *which* 13 items the Orbit Landing ships with and the
per-item metadata that Stage 2 (asset generation) and the eventual Admin/
Media Library (`docs/11-orbit-asset-system.md`) both need.

## Source of truth for this list

The 13 items and their `title` come directly from the prototype's own
markup (`biawin_single_file_app_requested_edits_v16_clean.html`, lines
6872–6884 — each bubble's `alt="..."` attribute), which is identical to
what's already implemented in `apps/web/src/components/landing/orbitItems.ts`
(Stage 1). Nothing here is invented; `id`/`slug`/`title` are a direct
carry-over, already live.

## Category mapping — grounded in the real seeded data

`backend/prisma/seed.ts` already seeds 19 real `Category` rows (Persian
names, already in the staging database). Rather than invent a parallel
taxonomy for the Orbit catalog, every item below maps to one of those 19
existing categories. Five map by clear best fit rather than an exact name
match — those are marked **UNCONFIRMED** and need a product/content-owner
decision before Stage 2, not a silent guess.

| Existing category (seeded) | Used by orbit item(s) |
|---|---|
| پوشاک | clothing (exact) |
| اتومبیل | car (exact — "خودرو" = "اتومبیل"), motorcycle (**UNCONFIRMED** — closest umbrella, no dedicated motorcycle category exists) |
| طلا و جواهر | jewelry (exact) |
| گردشگری | tourism (exact) |
| لوازم خانگی | appliances (exact) |
| زیبایی | cosmetics (exact concept match — "آرایشی" = beauty) |
| دیجیتال | digital (exact) |
| بیمه | insurance (exact) |
| خرید روزمره | grocery (**UNCONFIRMED** — closest fit), meat (**UNCONFIRMED** — closest fit) |
| خانه و زندگی | carpet (**UNCONFIRMED** — could instead be "مبلمان") |
| آموزش | stationery (**UNCONFIRMED** — closest fit; stationery reads as school-supplies-adjacent, not a strong match) |

8 of 13 map cleanly; 5 are a judgment call flagged above, not a fact.

## 1. Final Orbit Catalog

```yaml
id: grocery
title: سبد مواد غذایی
slug: grocery
category: خرید روزمره   # UNCONFIRMED — closest existing category, no dedicated "grocery" category exists
short_description: سبد خرید هفتگی مواد غذایی با پرداخت اقساطی
visual_direction: سبد یا کیسه خرید پر از اقلام غذایی رنگی (میوه، نان، لبنیات) — زاویه سه‌ربع، نور نرم از بالا-چپ
asset_filename: orbit_dailyshopping_grocery_v1.webp
priority: 1
active: true
```

```yaml
id: clothing
title: پوشاک
slug: clothing
category: پوشاک
short_description: خرید اقساطی لباس و پوشاک از برندهای منتخب
visual_direction: پیراهن یا ست لباس تاشده روی جالباسی کوچک، رنگ خنثی با یک لهجه‌ی آبی برند
asset_filename: orbit_clothing_clothing_v1.webp
priority: 1
active: true
```

```yaml
id: motorcycle
title: موتورسیکلت
slug: motorcycle
category: اتومبیل   # UNCONFIRMED — closest umbrella category; no dedicated motorcycle category exists yet
short_description: خرید اقساطی موتورسیکلت
visual_direction: موتورسیکلت شهری از نمای سه‌ربع کناری، رندر تمیز و ساده، بدون پس‌زمینه پیچیده
asset_filename: orbit_vehicle_motorcycle_v1.webp
priority: 2
active: true
```

```yaml
id: car
title: خودرو
slug: car
category: اتومبیل
short_description: خرید اقساطی خودرو
visual_direction: خودروی سواری از نمای سه‌ربع جلو، رندر تمیز، سایه‌ی نرم زیر چرخ‌ها
asset_filename: orbit_vehicle_car_v1.webp
priority: 1
active: true
```

```yaml
id: jewelry
title: طلا و جواهر
slug: jewelry
category: طلا و جواهر
short_description: خرید اقساطی طلا و جواهرات
visual_direction: قطعه جواهر (مثلاً گردنبند یا انگشتر) با انعکاس نور فلزی ملایم، بدون درخشش بیش‌ازحد که جزئیات را از بین ببرد
asset_filename: orbit_jewelry_jewelry_v1.webp
priority: 1
active: true
```

```yaml
id: tourism
title: گردشگری
slug: tourism
category: گردشگری
short_description: رزرو اقساطی تور و سفر
visual_direction: چمدان سفر یا نماد ساده‌ی هواپیما/بلیط، رنگ‌بندی گرم و دعوت‌کننده
asset_filename: orbit_tourism_tourism_v1.webp
priority: 1
active: true
```

```yaml
id: appliances
title: لوازم خانگی
slug: appliances
category: لوازم خانگی
short_description: خرید اقساطی لوازم خانگی
visual_direction: یک وسیله‌ی خانگی شاخص (مثلاً یخچال یا ماشین لباسشویی) از نمای سه‌ربع، رندر تمیز صنعتی
asset_filename: orbit_appliances_appliances_v1.webp
priority: 1
active: true
```

```yaml
id: carpet
title: فرش
slug: carpet
category: خانه و زندگی   # UNCONFIRMED — "مبلمان" is the other plausible fit; needs a decision
short_description: خرید اقساطی فرش و کفپوش
visual_direction: فرش تاشده یا رول‌شده با الگوی سنتی/مدرن قابل‌تشخیص از نمای بالا-کنار
asset_filename: orbit_homeliving_carpet_v1.webp
priority: 2
active: true
```

```yaml
id: cosmetics
title: آرایشی
slug: cosmetics
category: زیبایی
short_description: خرید اقساطی محصولات آرایشی و بهداشتی
visual_direction: ست کوچک لوازم آرایشی (رژ، پالت، شیشه عطر) به‌صورت گروهی هماهنگ، رنگ‌های ملایم پاستلی
asset_filename: orbit_beauty_cosmetics_v1.webp
priority: 2
active: true
```

```yaml
id: digital
title: دیجیتال
slug: digital
category: دیجیتال
short_description: خرید اقساطی موبایل، لپ‌تاپ و لوازم دیجیتال
visual_direction: گوشی هوشمند یا لپ‌تاپ از نمای سه‌ربع، صفحه خاموش یا خنثی (بدون محتوای واقعی روی صفحه)
asset_filename: orbit_digital_digital_v1.webp
priority: 1
active: true
```

```yaml
id: insurance
title: بیمه
slug: insurance
category: بیمه
short_description: خرید اقساطی بیمه‌نامه
visual_direction: نماد چتر یا سپر محافظ، ساده و انتزاعی — بیمه کالای فیزیکی خاصی ندارد پس باید نمادین طراحی شود
asset_filename: orbit_insurance_insurance_v1.webp
priority: 2
active: true
```

```yaml
id: stationery
title: لوازم تحریر
slug: stationery
category: آموزش   # UNCONFIRMED — closest fit, but the match is weak; worth a dedicated decision
short_description: خرید اقساطی لوازم تحریر و آموزشی
visual_direction: دسته‌ای کوچک از لوازم تحریر (مداد، دفتر، کیف مدرسه) چیده‌شده به‌صورت هماهنگ
asset_filename: orbit_education_stationery_v1.webp
priority: 3
active: true
```

```yaml
id: meat
title: مرغ، گوشت و ماهی
slug: meat
category: خرید روزمره   # UNCONFIRMED — closest existing category
short_description: خرید اقساطی محصولات پروتئینی روزمره
visual_direction: بسته‌بندی تمیز و ساده از محصول پروتئینی (مثلاً بسته گوشت روی تخته)، بدون جزئیات خام/ناخوشایند
asset_filename: orbit_dailyshopping_meat_v1.webp
priority: 2
active: true
```

## Priority key

- **1** — core/high-traffic verticals; generate first.
- **2** — important but can follow after the priority-1 set is live.
- **3** — lowest priority of the 13; `stationery` specifically also has the
  weakest category match (see UNCONFIRMED note above) and may be worth
  revisiting rather than generating as-is.

## Notes for Stage 2 (asset generation)

- All 13 items are `active: true` — this is the full current set, nothing
  is being dropped or added at this stage.
- `slug` values are unchanged from `orbitItems.ts`'s existing `id` field —
  no code needs to change when real assets land, per the Stage 1.5 contract.
- `asset_filename` follows `docs/11-orbit-asset-system.md` §3's
  `orbit_{category}_{slug}_{version}.webp` pattern, using an ASCII
  slug-safe form of the mapped category (e.g. `خرید روزمره` →
  `dailyshopping`) since filenames shouldn't carry Persian text.
- The 5 UNCONFIRMED category mappings should be resolved (confirmed as-is,
  or redirected to a different/new category) before Stage 2 generates
  those 5 specific assets — the other 8 are safe to start on immediately.
