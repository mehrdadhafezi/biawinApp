# Design System Foundation

منبع واقعی: [`packages/ui/src/tokens.ts`](../packages/ui/src/tokens.ts) و [`packages/ui/src/components/`](../packages/ui/src/components/). این سند مستندسازی + نگاشت است — همیشه فایل واقعی مرجع باشد. همه‌ی مقادیر مستقیماً از پروتوتایپ استخراج شده‌اند (`docs/01-prototype-analysis.md` بخش ۳ و بازبینی تکمیلی هنگام `docs/prototype-to-production-mapping.md`)، نه حدسی.

## ۰. Prototype Fidelity Rule (قانون ثابت، از این مرحله به بعد)

> **پروتوتایپ (`biawin_single_file_app_requested_edits_v15.html`) مرجع اصلی UI است.**

- هیچ صفحه/Component ای خارج از چیزی که در پروتوتایپ وجود دارد ساخته نمی‌شود؛ اگر یک قابلیت در پروتوتایپ نیست، طراحی‌اش (نه فقط پیاده‌سازی‌اش) باید قبلش با کاربر تأیید شود.
- نسخه‌ی Production باید **High Fidelity** باشد — یعنی چیدمان، فاصله‌گذاری، رنگ، تایپوگرافی و رفتار تعاملی (کاروسل‌ها، استوری‌ها، مودال‌ها، ...) با پروتوتایپ مطابقت داشته باشد، نه فقط «شبیه» آن.
- همه‌ی Component ها باید از `packages/ui` ساخته شوند (بخش ۸ همین سند) — نه استایل‌دهی مستقیم و یک‌بارمصرف داخل هر صفحه.
- صفحاتی که طبق `docs/prototype-to-production-mapping.md` باید دقیقاً از پروتوتایپ ساخته شوند (Sprintهای بعدی): Landing، Auth، Home Dashboard، Account Summary، Wallet Cards، Membership Cards، Services، Categories، Rewards، Profile، Winyar (مشاور).
- صفحه‌ی فعلی `apps/web` (Landing/Auth/Home) هنوز **Placeholder** است — قصداً ساده نگه داشته شده تا Foundation جدا از UI نهایی تثبیت شود؛ بازسازی High-Fidelity آن‌ها طبق همین قانون، کار Sprintهای بعدی Prototype Implementation است، نه این مرحله.

## ۱. Color Tokens

### پالت اصلی (`color`)

| توکن | مقدار | کاربرد در پروتوتایپ |
|---|---|---|
| `primary` | `#0879dc` | رنگ برند، دکمه‌های اصلی، آیکون فعال |
| `primary2` | `#0a63b8` | حالت گرادیانت/hover |
| `deep` | `#074f98` | تیترها، حالت تیره‌ی گرادیانت کارت‌ها |
| `ink` | `#0e2f4d` | متن اصلی |
| `muted` | `#6f8497` | متن ثانویه/توضیحات |
| `ice` | `#f2f8fd` | پس‌زمینه‌ی روشن بخش‌ها |
| `line` | `#d9eafb` | خط جداکننده/border |
| `white` | `#ffffff` | پس‌زمینه‌ی کارت‌ها |
| `accentOrange` | `#f28a2d` | برچسب «فرصت‌های خاص»، هشدارهای غیرخطا |

### تم‌های ثانویه (استخراج تکمیلی)

| گروه | مقادیر | منبع در پروتوتایپ |
|---|---|---|
| پرسونای مشاور | طلایی `#b78327`/`#fff8eb`، فیروزه‌ای `#087f83`/`#edfafa`، بنفش `#7852ad`/`#f6f0ff` | متغیرهای `--advisor-accent`/`--advisor-soft` per پرسونا |
| Landing panel accents | `#1269b5` (کسب‌وکار)، `#168cd8` (چرا بیاوین)، `#f28a2d` (خاص)، `#075db2` (کارت‌ها) | `.landing-panel.panel-*` |
| Category theme (نمونه؛ قابل‌گسترش به ۱۸ دسته) | `auto #0879dc`, `home #0a78c8`, `fashion #0879dc`, `gold #c9a13a`, `travel #0879dc` | `.service-banner.theme-*` — بقیه‌ی ۱۳ دسته باید هنگام Feature-stage به همین جدول اضافه شوند |

### رنگ‌های وضعیت (Semantic — جدید، برای `Badge`/پیام‌ها)

| نام | مقدار پیشنهادی | کاربرد |
|---|---|---|
| `success` | `#1f9d55` روی `#e6f7ee` | سفارش تکمیل‌شده، پرداخت موفق |
| `warning` | `#c65f11` روی `#fff4e5` | در انتظار، اعتبار محدود |
| `danger` | باید تعریف شود (Feature-stage) | خطا، لغو |

## ۲. Typography

| نام | سایز | وزن | line-height | کاربرد |
|---|---|---|---|---|
| `h1` | 25 | 800 | 1.2 | تیتر بخش Intro (`.intro h2`) |
| `h2` | 22 | 800 | 1.25 | تیتر صفحات جزئیات |
| `h3` | 16 | 700 | 1.3 | تیتر بخش‌های داخلی (`.hero-title h1`) |
| `body` | 13 | 400 | 1.9 | متن توضیحی استاندارد |
| `caption` | 11 | 700 | 1.4 | برچسب‌ها، متن کمکی |
| `micro` | 9 | 700 | 1.35 | زیرنویس آیکون (`.story-bubble-title`) |

فونت: `Vazirmatn` (وزن‌های 300–800)، فقط از Google Fonts لود می‌شود؛ فallback: `Tahoma, Arial, sans-serif`.

## ۳. Spacing

مقیاس ۴px-پایه: `xs(4) sm(8) md(14) lg(18) xl(24) xxl(32)`. اکثر padding/gap های پروتوتایپ (مثل `padding:14px 18px` هدر، `gap:14px` کارت‌ها) دقیقاً روی همین پله‌ها می‌افتند.

## ۴. Radius

مقیاس: `sm(10) md(14) lg(18) xl(24)`. **استثناهای دیده‌شده در پروتوتایپ** که خارج از این مقیاس‌اند و باید per-component override شوند: کارت مالی/عضویت `26–30px`، brand-mark `15px`. توصیه: مقیاس ۴تایی برای اکثر UI کافی است؛ کامپوننت‌های «کارت با ظاهر فیزیکی بانکی» (`FinancialCard`) مقدار خودشان را جدا نگه می‌دارند (همین الان هم `borderRadius:26` به‌صورت مستقیم در `FinancialCard.tsx` است، نه از `radius` توکن).

## ۵. Shadow

| نام | مقدار | کاربرد |
|---|---|---|
| `sm` | `0 9px 28px rgba(4,79,152,.10)` | کارت‌های سطح پایین (feature box) |
| `md` | `0 18px 50px rgba(4,79,152,.13)` | Modal، کارت‌های برجسته |

**نیاز Feature-stage:** یک `lg` برای سایه‌ی عمیق‌تر مودال‌های تمام‌صفحه (پروتوتایپ مقدار `0 0 80px rgba(5,64,115,.09)` برای کانتینر اصلی اپ دارد) — هنوز به `tokens.ts` اضافه نشده.

## ۶. Breakpoints

`sm(480) md(768) lg(1024)`. پروتوتایپ عمدتاً یک `@media(max-width:420px)` برای فشرده‌سازی گرید میان‌برها دارد؛ چون به‌طور کامل زیر `sm` ماست، override جدا لازم نیست.

## ۷. Component Variants (از پروتوتایپ استخراج‌شده)

### Badge / برچسب نوع پرداخت
مقادیر واقعی دیده‌شده روی کارت‌های محصول: `اقساطی`, `اعتباری`, `تخفیفی`, `اقتصادی`, `اشتراک`, `خدمت`, `سازمانی`, `سفارشی`, `فوری`, `محبوب`, `ویژه`, `رزرو`, `سریع`. این‌ها **مقادیر آزاد متنی** هستند نه یک enum بسته (به همین دلیل در `Product.badge` نوع Prisma هم `String` است، نه enum) — کامپوننت `Badge` باید یک `tone` بگیرد (info/success/warning/neutral) که از روی نوع پرداخت map می‌شود (Feature-stage: تابع `mapBadgeToTone(label)`).

### Button
Contextهای دیده‌شده: دکمه‌ی اصلی پر‌رنگ (`primary` — CTA خرید/تأیید)، دکمه‌ی ثانویه با outline (`secondary` — لغو/بازگشت)، دکمه‌ی متنی بدون پس‌زمینه (`ghost` — لینک‌های کم‌اهمیت مثل «بازگشت به بالا»).

### Card themes (بنر خدمات)
هر دسته یک theme class دارد: `theme-auto`, `theme-home`, `theme-fashion`, `theme-gold`, `theme-travel`, و به همین ترتیب برای ۱۳ دسته‌ی باقی‌مانده (`theme-beauty`, `theme-insurance`, `theme-digital`, ...) — لیست کامل باید هنگام seed کردن `Category` نهایی شود.

## ۸. نگاشت Component ها به `packages/ui`

| Component | معادل پروتوتایپ | وضعیت | نکته پیاده‌سازی |
|---|---|---|---|
| `Button` | `.unified-primary` | ✅ ساخته‌شده | ۳ variant |
| `Card` | سطح عمومی | ✅ ساخته‌شده | |
| `FinancialCard` | `.credit-card`/`.membership-card-face` | ✅ ساخته‌شده | |
| `WalletCard` | `.profile-wallet-card` | ✅ ساخته‌شده | |
| `StoryCard` | `.story-bubble` | ✅ ساخته‌شده | |
| `BottomSheet` | `.purchase-sheet`/`.reward-modal` | ✅ ساخته‌شده | |
| `Modal` | `.auth-modal` | ✅ ساخته‌شده | |
| `Input` | `.search-box input` | ✅ ساخته‌شده | |
| `Badge` | برچسب‌های نوع پرداخت | ✅ ساخته‌شده (۴ tone) | نیاز به `mapBadgeToTone` در Feature-stage |
| `BottomNavigation` | `.app-bottom-nav` | ✅ ساخته‌شده | آیکون از بیرون تزریق می‌شود |
| `Carousel`/`SnapScroller` | `.card-track`, `.stories-strip`, `.news-snap-track` | 🆕 برنامه‌ریزی‌شده | wrapper عمومی روی `overflow-x:auto; scroll-snap-type:x` — همه‌ی کاروسل‌های پروتوتایپ این الگو را دارند |
| `Accordion` | `.profile-accordion` | 🆕 برنامه‌ریزی‌شده | برای Profile (۷ بخش) |
| `OtpInput` | `.unified-otp` | 🆕 برنامه‌ریزی‌شده | ۶ باکس + auto-focus + paste |
| `Countdown` | `#unifiedResend` | 🆕 برنامه‌ریزی‌شده | تایمر resend OTP |
| `ProductCard` | `.service-card`/کارت زیردسته | 🆕 برنامه‌ریزی‌شده | `Card` + `Badge` ترکیب‌شده |
| `Accordion` FAQ item | `.detail-faq-item` | 🆕 برنامه‌ریزی‌شده | نسخه‌ی تک‌آیتمی |
| `StatTile` | `.profile-summary-grid > div` | 🆕 برنامه‌ریزی‌شده | عدد بزرگ + برچسب |
| `Avatar` | `.profile-main-avatar` | 🆕 برنامه‌ریزی‌شده | |
| `FilterChip` | `.category-filter-row button` | 🆕 برنامه‌ریزی‌شده | حالت active/inactive |
| `Toast` | `.membership-toast`/`.detail-toast` | 🆕 برنامه‌ریزی‌شده | پیام موقت پایین صفحه |
| `ChatBubble` / `ChatComposer` | `.advisor-chat-*` | 🆕 برنامه‌ریزی‌شده — فقط وقتی مشاور Feature-stage (P2) شروع شود |
| `StepIndicator` | `.unified-auth-progress`, `.advisor-journey` | 🆕 برنامه‌ریزی‌شده | نقطه‌های مرحله |
| `Gallery` | `.detail-gallery` | 🆕 برنامه‌ریزی‌شده | گرید ۳تایی تصویر |

## ۹. دامنه‌ی این مرحله (و آنچه بعداً می‌آید)

- کامپوننت‌ها فقط برای **وب (React DOM)** نوشته شده‌اند. معادل React Native باید در Feature-stage ساخته شود (پیشنهاد: فایل‌های `.native.tsx` موازی، یا `packages/ui-native` جدا) — **تصمیم Product معلق** (بخش ۴ گزارش قبلی).
- استایل‌ها inline style object هستند (نه Tailwind/CSS Module) تا پکیج به هیچ ابزار build خاصی وابسته نباشد.
- کامپوننت‌های ردیف دوم جدول بخش ۸ («🆕 برنامه‌ریزی‌شده») هنوز کدنویسی نشده‌اند — طبق دستور صریح («فعلاً هیچ Feature کدنویسی نکن»)، ساخته می‌شوند وقتی صفحه‌ی مربوطه در P0/P1/P2 (`docs/prototype-to-production-mapping.md` بخش C) شروع شود.
