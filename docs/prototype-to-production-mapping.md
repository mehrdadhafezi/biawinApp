# Prototype → Production Mapping

منبع: [`docs/01-prototype-analysis.md`](01-prototype-analysis.md) (تحلیل کامل پروتوتایپ) + معماری Foundation فعلی (`docs/01-architecture.md` تا `07-security.md`). این سند پل بین آن‌هاست: هر Screen پروتوتایپ را به Component های فرانت‌اند، API های بک‌اند، مدل‌های دیتابیس، State ها و Edge Case های واقعی نگاشت می‌کند.

علامت‌گذاری وضعیت API:
- ✅ = endpoint از قبل در Foundation ساخته شده (`docs/03-api.md`)
- 🆕 = endpoint جدید که در مرحله‌ی Feature باید ساخته شود

---

## بخش A — نقشه‌ی کامل Screen ها (۱۷ مورد)

### ۱. Landing — صفحه‌ی ورود/معرفی

- **هدف کاربر:** آشنایی سریع با ۴ محور بیاوین (کسب‌وکار، چرا بیاوین، فرصت‌های خاص، کارت‌ها) پیش از ورود، و شروع فلوی احراز هویت.
- **Componentهای Frontend:** `LandingPanelGrid` (۴ باکس)، `LandingCenterButton`، اتصال به `IntroStoryViewer` (بخش ۱۵).
- **APIهای Backend:** هیچ‌کدام (محتوای بازاریابی استاتیک؛ در آینده می‌تواند از CMS بیاید — خارج از scope فعلی).
- **DB Models درگیر:** هیچ.
- **Stateهای لازم:** `activeIntroTopic` (کدام استوری باز است)، `isAuthenticated` (برای ریدایرکت خودکار کاربر لاگین‌شده).
- **Edge Caseها:** کاربر از قبل توکن معتبر دارد → باید مستقیم به Home هدایت شود، نه دیدن لندینگ؛ اولین اجرای اپ vs بازدید مجدد (تفاوتی در لندینگ ندارد، تفاوت در Onboarding بعد از ثبت‌نام است).

### ۲. Home — خانه

- **هدف کاربر:** مرکز فرماندهی؛ دیدن کارت‌های عضویت، جست‌وجوی خدمات، دسترسی سریع، اخبار.
- **Componentهای Frontend:** `HeroCardCarousel` (بر پایه‌ی `FinancialCard`)، `StoryStrip` (بر پایه‌ی `StoryCard`)، `QuickActionsGrid`، `SearchInput` (بر پایه‌ی `Input`)، `CreditServiceTicker` (اسکرول عمودی خودکار)، `ServiceBannerGrid`، `MembershipStoryStrip`، `NewsCarousel`، `BottomNavigation`.
- **APIهای Backend:** `GET /membership` ✅ (کارت‌های فعال کاربر) · `GET /categories` ✅ (برای تیکر/بنر) · `GET /services` ✅ (نسخه‌ی فیلترشده/محدود 🆕 برای «خدمات منتخب») · جست‌وجوی سراسری خدمات 🆕 (`GET /services?q=`) · تعداد اعلان‌های نخوانده 🆕 (`GET /notifications/unread-count`).
- **DB Models:** `Membership`, `MembershipPlan`, `Category`, `Service`, `NewsArticle` (🆕 خارج از ۱۹ مدل فعلی).
- **Stateهای لازم:** `activeCardIndex`، `searchQuery`، `activeNewsIndex`، `unreadNotificationCount`.
- **Edge Caseها:** کاربر بدون هیچ Membership فعال (نمایش CTA فعال‌سازی به‌جای کارت واقعی)؛ نتیجه‌ی خالی جست‌وجو؛ آفلاین/کند بودن شبکه (نمایش skeleton/cache)؛ کاربر مهمان (بدون توکن) که هنوز به این صفحه نرسیده چون گارد سراسری است — یعنی این صفحه فقط بعد از auth در دسترس است.

### ۳. Card Detail — جزئیات کارت عضویت

- **هدف کاربر:** بررسی جزئیات یک کارت (Earn/Core/Reward) پیش از فعال‌سازی.
- **Componentهای Frontend:** `MembershipDetailHeader`، `FinancialCard` (نسخه‌ی بزرگ)، `MembershipStatsRow`، `BenefitList`، `ServiceTagList`، `StickyActionBar`، `Toast`.
- **APIهای Backend:** `GET /subscriptions/:id` ✅ (جزئیات پلن) · فعال‌سازی 🆕 (`POST /membership` با `planId`).
- **DB Models:** `MembershipPlan`, `Membership`.
- **Stateهای لازم:** `selectedCardId`, `isActivating`.
- **Edge Caseها:** کارتی که کاربر از قبل فعال دارد (دکمه باید «مشاهده» نه «فعال‌سازی» نشان دهد)؛ خطای فعال‌سازی (مثلاً شرایط احراز صلاحیت)؛ کارت جایزه که دکمه‌اش کاربر را به صفحه‌ی Rewards می‌برد نه فعال‌سازی مستقیم.

### ۴. Services — فهرست خدمات

- **هدف کاربر:** مرور کامل دسته‌بندی‌های خدمات (۱۸+ مورد) و رفتن به زیردسته‌ی موردنظر.
- **Componentهای Frontend:** `SearchInput`، `PromoBanner`، `ServiceCategoryGrid` (+ دکمه‌ی «بیشتر»)، `CategoryBannerHighlight` (گردشگری/اتومبیل ویژه).
- **APIهای Backend:** `GET /categories` ✅.
- **DB Models:** `Category`.
- **Stateهای لازم:** `searchQuery`, `showExtraCategories`.
- **Edge Caseها:** جست‌وجوی بدون نتیجه؛ دسته‌ی غیرفعال (`active:false` در DB) که نباید نمایش داده شود.

### ۵. Service Category — زیردسته‌ی خدمات

- **هدف کاربر:** مقایسه‌ی محصولات/کارت‌های داخل یک دسته با فیلتر نوع پرداخت و جست‌وجو.
- **Componentهای Frontend:** `CategoryHero`، `SearchInput`، `FilterChipRow` (همه/اقساطی/اعتباری/تخفیفی/ترکیبی)، `ProductCardGrid` (بر پایه‌ی `Card` + `Badge`).
- **APIهای Backend:** `GET /categories/:id` ✅ · لیست محصولات یک دسته با فیلتر 🆕 (`GET /services?categoryId=&method=&q=`).
- **DB Models:** `Category`, `Service`.
- **Stateهای لازم:** `activeFilter`, `searchQuery`.
- **Edge Caseها:** دسته‌ای با صفر محصول فعال؛ فیلتر ترکیبی که هیچ نتیجه‌ای ندارد.

### ۶. Service Detail — جزئیات خدمت/محصول

- **هدف کاربر:** بررسی کامل یک محصول و انتخاب روش خرید (اعتباری/اقساطی/کامل/رایگان) پیش از ثبت سفارش.
- **Componentهای Frontend:** `DetailHero`، `SelectedItemSummary`، `PurchaseMethodSelector` (۴ کارت)، `FeatureList`، `Gallery`، `ProcessSteps`، `FaqAccordion`، `StickyBuyBar`، `PurchaseSheet` (بخش ۱۴).
- **APIهای Backend:** `GET /services/:id` ✅ · ثبت سفارش `POST /orders` ✅.
- **DB Models:** `Service`, `Order`.
- **Stateهای لازم:** `selectedMethod`, `selectedInstallmentMonths` (اگر اقساطی)، `isPurchaseSheetOpen`.
- **Edge Caseها:** روشی که برای این محصول در دسترس نیست (باید غیرفعال/مخفی شود، نه فقط استایل)؛ کاربر بدون اعتبار کافی برای روش اعتباری؛ محصول غیرفعال شده بعد از باز شدن صفحه (race condition ساده).

### ۷. Rewards — فروشگاه جایزه

- **هدف کاربر:** دیدن موجودی کیف‌پول جایزه و دریافت یک کالای جایزه.
- **Componentهای Frontend:** `WalletCard` (نسخه‌ی جایزه)، `RewardProductGrid`، `RewardModal` (بخش ۱۳).
- **APIهای Backend:** `GET /rewards` ✅ · `GET /wallet` ✅ (موجودی کیف‌پول جایزه).
- **DB Models:** `Reward`, `Wallet`.
- **Stateهای لازم:** `selectedRewardId`.
- **Edge Caseها:** جایزه‌ای که موجودی کیف‌پول برایش کافی نیست (نیاز به پرداخت ترکیبی — بخش ۱۳)؛ جایزه‌ی اتمام‌موجودی/غیرفعال.

### ۸. Advisor — انتخاب مشاور هوشمند

- **هدف کاربر:** انتخاب یکی از ۳ پرسونای مشاور (وینا/وین‌یاد/آروین) برای همراهی در تصمیم‌های خرید.
- **Componentهای Frontend:** `AdvisorCarousel`، `AdvisorBioCard`، `AdvisorGrid`، `AdvisorDetailModal`.
- **APIهای Backend:** `GET /advisor` ✅ · انتخاب پرسونای فعال کاربر 🆕 (`POST /advisor/select`).
- **DB Models:** `AdvisorPersona`, `UserAdvisorPreference` (🆕 — مدل کوچک خارج از ۱۹ مدل فعلی، برای نگه‌داشتن انتخاب کاربر).
- **Stateهای لازم:** `activeAdvisorKey`, `selectedAdvisorForDetail`.
- **Edge Caseها:** کاربری که هنوز هیچ مشاوری انتخاب نکرده (پرسونای پیش‌فرض)؛ تعویض مشاور در میانه‌ی یک چت فعال.

### ۹. Profile — پروفایل

- **هدف کاربر:** مدیریت حساب، کارت‌ها، سفارش‌ها، مأموریت‌ها، آدرس، دعوت دوستان، اعلان‌ها، پشتیبانی؛ خروج.
- **Componentهای Frontend:** `ProfileHeader`، `WalletCard`، `ServiceCardCarousel` (کارت‌های اقساطی/اعتباری/تخفیفی/ترکیبی)، `StatTileRow`، `Accordion` (۷ بخش)، `LogoutButton`.
- **APIهای Backend:** `GET /users/me` ✅ · `GET/PATCH /profiles/me` ✅ · `GET /wallet` ✅ · `GET /orders` ✅ · `GET /notifications` ✅ · مأموریت‌ها 🆕 · آدرس‌ها 🆕 · دعوت دوستان (از `User.inviteCode` موجود، فقط نیاز به endpoint نمایش آمار 🆕).
- **DB Models:** `User`, `Profile`, `Wallet`, `Order`, `Notification`, `Mission`/`Address` (🆕 خارج از scope فعلی).
- **Stateهای لازم:** `openAccordionKey`, فرم ویرایش پروفایل (`fullName`, `email`, ...).
- **Edge Caseها:** ویرایش پروفایل با ایمیل تکراری/نامعتبر؛ خروج از حساب وقتی توکن رفرش از قبل expire شده.

### ۱۰. Auth Modal — ورود و ثبت‌نام (۳ مرحله)

- **هدف کاربر:** ورود با شماره موبایل + OTP؛ اگر کاربر جدید است، تکمیل نام در مرحله‌ی سوم.
- **Componentهای Frontend:** `Modal`، `PhoneStep` (`Input`)، `OtpStep` (`OtpInput` — ۶ باکس + `Countdown`)، `ProfileStep` (فرم نام/کد اشتراک/ایمیل + `Checkbox`).
- **APIهای Backend:** `POST /auth/otp/request` ✅ · `POST /auth/otp/verify` ✅.
- **DB Models:** `PhoneVerification`, `User`, `Profile`, `Wallet`, `RefreshToken`.
- **Stateهای لازم:** `step` (1|2|3), `phone`, `otpDigits[6]`, `resendCountdown`, `fullName`, `subscriptionCode`, `email`, `termsAccepted`.
- **Edge Caseها:** شماره‌ی نامعتبر؛ کد اشتباه (تا سقف تلاش)؛ کد منقضی/درخواست مجدد قبل از پایان countdown (۴۲۹ از Rate Limit)؛ شماره‌ای که در حال signup است ولی از قبل ثبت‌نام کرده (باید کاربر را به login هدایت کند)؛ بستن مودال وسط فلو (باید state ریست شود).

### ۱۱. First Onboarding — تور آموزشی (۶ اسلاید)

- **هدف کاربر:** آشنایی سریع با اپ فقط برای کاربر تازه‌ثبت‌نام‌کرده.
- **Componentهای Frontend:** `OnboardingSlideshow` (اسکرین‌شات + hotspot)، `StepIndicator`، دکمه‌ی رد کردن.
- **APIهای Backend:** هیچ (فقط یک flag محلی/سرور که «دیده شد» — می‌تواند `localStorage` یا فیلد ساده روی `User` باشد 🆕).
- **DB Models:** هیچ (یا فیلد `onboardingSeenAt` روی `User` 🆕، تصمیم Product).
- **Stateهای لازم:** `currentSlideIndex`.
- **Edge Caseها:** کاربری که signup را نیمه‌کاره رها کرده و دوباره برمی‌گردد؛ باید تور فقط یک‌بار دیده شود (نه هر لاگین).

### ۱۲. Advisor Chat — گفتگو با مشاور

- **هدف کاربر:** پرسیدن سؤال مالی/خرید از مشاور انتخاب‌شده، با متن یا صدا.
- **Componentهای Frontend:** `AdvisorFloatButton`، `ChatPanel`، `ChatMessageList` (`ChatBubble`)، `ChatComposer` (`Input` + میکروفن)، `QuickPromptRow`، `VoiceIntroBar`.
- **APIهای Backend:** کاملاً 🆕 — نیاز به اتصال LLM واقعی (`POST /advisor/chat`) که در تحلیل پروتوتایپ (بخش ۷) هم به‌عنوان mock علامت‌گذاری شده بود.
- **DB Models:** `ChatMessage` (🆕 خارج از ۱۹ مدل فعلی).
- **Stateهای لازم:** `messages[]`, `isSending`, `isVoiceEnabled`, `inputText`.
- **Edge Caseها:** خطای سرویس LLM؛ پیام خیلی طولانی؛ قطع اتصال وسط پاسخ استریم‌شده؛ محدودیت نرخ پرسش.

### ۱۳. Reward Redeem Modal — دریافت جایزه + پرداخت ترکیبی

- **هدف کاربر:** تأیید دریافت یک جایزه؛ اگر موجودی کیف‌پول کافی نبود، پرداخت مابه‌التفاوت از درگاه.
- **Componentهای Frontend:** `BottomSheet`، `RewardSummary`، `PaymentSplitBreakdown`، `GatewayForm` (شماره کارت/CVV2/تاریخ — **فقط UI، هرگز داده‌ی واقعی کارت را به بک‌اند خودمان نمی‌فرستیم**، مستقیم به IPG)، `ConfirmationState`.
- **APIهای Backend:** 🆕 `POST /rewards/:id/claim` (محاسبه‌ی تقسیم پرداخت) · 🆕 اتصال درگاه واقعی (خارج از scope Foundation).
- **DB Models:** `RewardClaim`, `Wallet`, `WalletTransaction`, `Payment`.
- **Stateهای لازم:** `useWallet` (checkbox)، `gatewayAmount` (محاسبه‌شده)، مرحله (`summary`|`gateway`|`success`).
- **Edge Caseها:** موجودی کیف‌پول دقیقاً صفر؛ لغو وسط پرداخت درگاه؛ Timeout درگاه بعد از کسر از کیف‌پول (نیاز به تراکنش اتمیک/جبرانی — نکته‌ی مهم برای Feature-stage).

### ۱۴. Purchase Sheet — تأیید نهایی خرید خدمت

- **هدف کاربر:** تأیید سریع روش انتخابی پیش از ثبت نهایی سفارش (از Service Detail باز می‌شود).
- **Componentهای Frontend:** `BottomSheet`، `OrderSummary`، دو دکمه (تأیید/انصراف).
- **APIهای Backend:** `POST /orders` ✅.
- **DB Models:** `Order`.
- **Stateهای لازم:** ارثی از Service Detail (`selectedMethod`, `amount`).
- **Edge Caseها:** خطای شبکه هنگام ثبت (باید Retry/پیام خطا داشته باشد، نه فقط بسته شدن بی‌صدا).

### ۱۵. Story Viewer — استوری‌های معرفی و کارت‌های اشتراک

- **هدف کاربر:** مرور سریع محتوای معرفی (۴ موضوع لندینگ) یا معرفی ۸ کارت اشتراک، با تایمر خودکار.
- **Componentهای Frontend:** `StoryViewer` (progress bars + swipe/tap navigation)، `StorySlide`.
- **APIهای Backend:** هیچ (محتوای استاتیک؛ در آینده می‌تواند از `MembershipPlan.description` بیاید).
- **DB Models:** `MembershipPlan` (اگر محتوا دینامیک شود).
- **Stateهای لازم:** `activeStoryIndex`, `isPaused`.
- **Edge Caseها:** swipe سریع (چند بار پشت‌سرهم) که نباید تایمرها را قاطی کند.

### ۱۶. App Guide Modal — راهنمای سریع اپ

- **هدف کاربر:** مرور ۶ مرحله‌ی کلی استفاده از اپ، در هر زمان (از دکمه‌ی هدر Home).
- **Componentهای Frontend:** `Modal`، `GuideStepList`.
- **APIهای Backend:** هیچ.
- **DB Models:** هیچ.
- **Stateهای لازم:** هیچ (محتوای استاتیک).
- **Edge Caseها:** ندارد — کم‌ریسک‌ترین صفحه.

### ۱۷. Logout Confirm — تأیید خروج

- **هدف کاربر:** جلوگیری از خروج تصادفی.
- **Componentهای Frontend:** `BottomSheet` یا `Modal` کوچک، دو دکمه.
- **APIهای Backend:** `POST /auth/logout` ✅.
- **DB Models:** `RefreshToken` (revoke).
- **Stateهای لازم:** هیچ.
- **Edge Caseها:** درخواست logout وقتی توکن از قبل expire/revoke شده (باید همچنان موفق به‌نظر برسد، نه خطای گیج‌کننده).

---

## بخش B — User Journey های اصلی

هر Journey به Screen ها و API های بخش A ارجاع می‌دهد.

### J1. ورود کاربر جدید (Signup)

1. **Landing** → لمس دکمه‌ی مرکزی → **Auth Modal** باز می‌شود، مرحله‌ی ۱.
2. کاربر شماره را وارد می‌کند → `POST /auth/otp/request {purpose:"signup"}` ✅.
3. مرحله‌ی ۲: کد ۶ رقمی → `POST /auth/otp/verify {purpose:"signup"}` ✅ — چون کاربر جدید است، بک‌اند مستقیماً وارد مرحله‌ی تکمیل پروفایل می‌شود (نه لاگین فوری).
4. مرحله‌ی ۳: نام (الزامی) + کد اشتراک/ایمیل (اختیاری) → همان `verify` با `fullName` تکمیل، `User`+`Profile`+دو `Wallet` ساخته می‌شود، توکن‌ها صادر می‌شوند.
5. **First Onboarding** (۶ اسلاید) نمایش داده می‌شود.
6. ورود به **Home**.

### J2. ورود کاربر قبلی (Login)

1. **Landing** → **Auth Modal** مرحله‌ی ۱ → `POST /auth/otp/request {purpose:"login"}` ✅ (اگر شماره ثبت‌نام نکرده باشد، خطای صریح).
2. مرحله‌ی ۲: کد → `POST /auth/otp/verify {purpose:"login"}` ✅ — چون کاربر از قبل وجود دارد، مستقیم توکن صادر می‌شود (مرحله‌ی ۳ رد می‌شود).
3. ورود مستقیم به **Home** (بدون Onboarding).

### J3. خرید اشتراک بیاوین (فعال‌سازی کارت عضویت)

1. **Home** → لمس یک کارت در `HeroCardCarousel` → **Card Detail**.
2. بررسی مزایا/شرایط → دکمه‌ی «فعال‌سازی» → 🆕 `POST /membership {planId}`.
3. Toast تأیید → بازگشت به **Home** با کارت فعال جدید.
4. *(مسیر جایگزین: از Home → Services → مشاهده‌ی `MembershipStoryStrip` → همین فلو)*.

### J4. شارژ کیف پول

1. **Profile** یا **Home Quick Actions** → «افزایش موجودی».
2. 🆕 صفحه/مودال انتخاب مبلغ → 🆕 `POST /wallet/topup` (شروع تراکنش درگاه) → بازگشت از IPG → 🆕 `POST /wallet/topup/callback` (تسویه).
3. کیف‌پول به‌روزرسانی می‌شود (`WalletTransaction` نوع `topup`).
- **نکته:** این کل فلو در پروتوتایپ فقط یک دکمه بود بدون فرم واقعی — طراحی فرم مبلغ/درگاه کاملاً Feature-stage است.

### J5. استفاده از اعتبار

1. **Service Detail** → انتخاب روش «خرید اعتباری» → **Purchase Sheet** → `POST /orders {method:"credit"}` ✅.
2. بک‌اند (Feature-stage) باید موجودی `CreditLine` را بررسی و `CreditUsage` ثبت کند — این منطق در Foundation فعلی پیاده نشده (فقط `Order` ساخته می‌شود، بدون کسر اعتبار واقعی).
3. کاربر می‌تواند وضعیت را در **Profile → خریدها** یا 🆕 صفحه‌ی «اعتبار من» (از `GET /credit` ✅) پیگیری کند.

### J6. خرید اقساطی

1. **Service Detail** → انتخاب «خرید قسطی» → انتخاب تعداد ماه (۳ تا ۳۶) → **Purchase Sheet** → `POST /orders {method:"installment", installmentMonths}` 🆕 (فیلد `installmentMonths` باید به `CreateOrderDto` اضافه شود).
3. بک‌اند (Feature-stage) باید رکورد `Installment` بسازد (فعلاً `orders.service.ts` این کار را نمی‌کند).
4. کاربر در **Profile** یا 🆕 صفحه‌ی «اقساط من» (`GET /installments` ✅) وضعیت را می‌بیند.

### J7. مشاهده اقساط

1. **Home Quick Actions** یا **Profile** → «اقساط من» → 🆕 صفحه‌ی فهرست اقساط (هنوز در فرانت ساخته نشده) → `GET /installments` ✅.
2. لمس یک قسط → جزئیات (تعداد پرداخت‌شده، مبلغ ماهانه، تاریخ سررسید بعدی).
3. *(پرداخت یک قسط معوق کاملاً Feature-stage است — در پروتوتایپ هم صفحه‌ی مجزا نداشت.)*

### J8. دریافت جایزه

1. **Rewards** → لمس یک محصول → **Reward Redeem Modal**.
2. سیستم مبلغ را بین کیف‌پول/درگاه تقسیم می‌کند → تأیید → 🆕 `POST /rewards/:id/claim`.
3. اگر مابه‌التفاوت لازم بود → مرحله‌ی درگاه → پرداخت → تأیید نهایی.
4. `RewardClaim` + `WalletTransaction` (اگر از کیف‌پول کسر شد) + `Payment` ثبت می‌شود.

### J9. استفاده از خدمات

1. **Home** (جست‌وجو/بنر) یا **Services** → **Service Category** (فیلتر) → **Service Detail** → یکی از J5/J6 (خرید اعتباری/اقساطی) یا خرید مستقیم/رایگان.
2. سفارش در **Profile → خریدها** پیگیری می‌شود.

---

## بخش C — MVP Development Plan (اولویت‌بندی)

معیار اولویت‌بندی: آیا بدون این قابلیت، مسیر اصلی محصول (ثبت‌نام → دیدن خدمات → یک نوع خرید → دیدن وضعیت) قابل نمایش/تست است یا نه.

### P0 — بدون این‌ها، محصول قابل‌نمایش نیست

| # | آیتم | نوع | یادداشت |
|---|---|---|---|
| 1 | صفحات Landing + Auth Modal (OTP کامل) | Frontend | J1/J2 |
| 2 | صفحه‌ی Home (نسخه‌ی ساده: کارت‌ها + دسته‌ها، بدون تیکر/اخبار متحرک) | Frontend | |
| 3 | Services + Service Category + Service Detail | Frontend | مسیر اصلی خرید |
| 4 | ثبت سفارش end-to-end واقعی (کسر واقعی از Wallet/CreditLine، نه فقط ساخت `Order`) | Backend | تکمیل منطق در `orders`/`wallet`/`credit` |
| 5 | Card Detail + فعال‌سازی Membership واقعی | Frontend+Backend | `POST /membership` |
| 6 | Profile پایه (اطلاعات حساب، کیف‌پول، خریدها، خروج) | Frontend | |
| 7 | Seed داده‌ی واقعی برای `Category`/`Service`/`MembershipPlan` | Backend/Data | بدون این، صفحات خالی‌اند |
| 8 | استقرار Staging واقعی (حداقل یک محیط قابل‌دسترس) | Infra | برای تست واقعی محصول |

### P1 — تجربه‌ی کامل ولی نه حیاتی برای اولین دمو

| # | آیتم | نوع |
|---|---|---|
| 1 | خرید اقساطی کامل (فیلد ماه، ساخت `Installment`، صفحه‌ی «اقساط من») | Backend+Frontend |
| 2 | Rewards + Redeem Modal + پرداخت ترکیبی (بدون درگاه واقعی، شبیه‌سازی) | Frontend+Backend |
| 3 | شارژ کیف‌پول (بدون درگاه واقعی، شبیه‌سازی) | Frontend+Backend |
| 4 | Story Strip / کاروسل کارت‌های اشتراک در Home | Frontend |
| 5 | اعلان‌ها (لیست + خوانده‌شده) | Frontend+Backend |
| 6 | Onboarding Tour (۶ اسلاید) | Frontend |
| 7 | اتصال درگاه بانکی واقعی (IPG) | Backend/Infra |
| 8 | Dockerfile Production + CD واقعی | Infra |

### P2 — ارزش‌افزوده، می‌تواند بعد از لانچ اول اضافه شود

| # | آیتم | نوع |
|---|---|---|
| 1 | مشاور هوشمند (چت واقعی متصل به LLM) | Backend/AI |
| 2 | ورودی/خروجی صوتی مشاور | Frontend |
| 3 | مأموریت‌ها/گیمیفیکیشن + دعوت دوستان با پاداش واقعی | Backend+Frontend |
| 4 | آدرس‌ها و مدیریت تحویل | Backend+Frontend |
| 5 | اخبار/مقالات (`NewsArticle`) | Backend+Frontend |
| 6 | تیکر خودکار خدمات + انیمیشن‌های پیشرفته‌ی Home | Frontend |
| 7 | معادل React Native کامپوننت‌های `packages/ui` (اپ موبایل واقعی) | Frontend/Mobile |
| 8 | ۲FA واقعی، تشخیص reuse توکن رفرش، CSP سفارشی | Security |

---

## جمع‌بندی برای شروع Development

مسیر پیشنهادی: **P0 آیتم‌های Backend (۴, ۷) موازی با Frontend (۱-۳) شروع شوند** — چون Frontend بدون داده‌ی seed شده قابل تست نیست، و Backend بدون UI قابل دمو نیست. صفحه‌ی اول برای شروع کدنویسی واقعی: **Auth Modal** (چون هم کوتاه‌ترین مسیر تا یک صفحه‌ی کارکردی است، هم API هایش کامل در Foundation آماده‌اند).
