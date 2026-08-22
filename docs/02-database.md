# مستندسازی دیتابیس (Database Foundation)

منبع واقعی مدل داده: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). این سند هدف، ارتباط‌ها، ایندکس‌ها و Constraintهای هر جدول را توضیح می‌دهد. مدل‌های دقیقاً مطابق ۱۹ مدل درخواستی + یک مدل زیرساختی اضافه (`RefreshToken`) هستند — نه بیشتر. هیچ Migration کامل کسب‌وکاری (مثل منطق محاسبه‌ی اقساط) در این مرحله زده نشده؛ فقط ساختار جدول‌ها.

> **وضعیت Migration:** دو migration ساختاری واقعاً روی یک Postgres زنده تولید و اعمال شده‌اند (`backend/prisma/migrations/{init, add_service_icon}`) — هر دو با Seed کامل (۱۹ Category، ~۱۰۰ Service، ۱۱ MembershipPlan، ۱۶ Reward) verify شده‌اند، نه فقط طراحی روی کاغذ.

> **قرارداد مبلغ:** همه‌ی مبالغ (`balance`, `amount`, `cost`, ...) به‌صورت `Int` و بر حسب **ریال** ذخیره می‌شوند — هرگز float، برای جلوگیری از خطای گرد کردن.

---

## Auth / Identity

### `User`
- **هدف:** رکورد هویتی اصلی و کمینه؛ شماره موبایل تنها شناسه‌ی ورود است (بدون ایمیل، بدون رمز عبور — مطابق فلوی یکپارچه‌ی OTP در پروتوتایپ، `docs/03-api.md`).
- **ارتباط‌ها:** 1—1 با `Profile`؛ 1—N با `Membership`, `Wallet`, `CreditLine`, `Installment`, `Order`, `RewardClaim`, `Notification`, `RefreshToken`, `PhoneVerification`.
- **Constraint:** `phone` و `inviteCode` هر دو `@unique`.
- **چرا Profile جداست:** اطلاعات هویتی حیاتی (phone, status) از اطلاعات قابل‌تغییر پروفایل (نام، آواتار) جدا نگه داشته می‌شود تا تغییرات پروفایل هیچ‌وقت رکورد امنیتی اصلی را دست نزند.
- **عمداً `subscriptionCode` روی این مدل نیست:** کدی که در ثبت‌نام وارد می‌شود، هرگز اینجا ذخیره نمی‌شود — مستقیم به `MembershipService.registerSubscriptionCode` پاس داده می‌شود (`docs/07-security.md` "Subscription Code — Not an Auth Credential"). به همین ترتیب، پذیرش قوانین (`terms`) هم مدل‌سازی نشده — یک `UserConsent` آینده آن را پوشش می‌دهد.

### `Profile`
- **هدف:** اطلاعات نمایشی/قابل‌ویرایش کاربر.
- **ارتباط‌ها:** 1—1 با `User` (`onDelete: Cascade`).
- **نکته:** `avatarKey` یک object key در Storage است، نه URL عمومی مستقیم — URL نهایی موقع serve از طریق presigned URL ساخته می‌شود (بخش ۵ همین سند در `03-api.md`).

### `PhoneVerification`
- **هدف:** ذخیره‌ی چالش OTP برای فلوی یکپارچه‌ی ورود/ثبت‌نام (`purpose` فعلاً همیشه `auth` — enum برای گسترش آینده مثل ۲FA نگه داشته شده، `docs/03-api.md`). کد پیامکی هرگز plaintext ذخیره نمی‌شود — فقط `codeHash`.
- **چرا `userId` nullable است:** چالش OTP قبل از مشخص‌شدن اینکه شماره متعلق به کاربر موجود است یا جدید، صادر می‌شود.
- **ایندکس:** `[phone, purpose]` — برای یافتن سریع آخرین چالش فعال هنگام verify/resend.
- **نکته امنیتی:** `attemptsRemaining` برای جلوگیری از brute-force کد ۶ رقمی؛ در کنار Rate Limit سطح Redis (`docs/07-security.md`).

### `RefreshToken`
- **هدف:** این مدل جزو ۱۹ مدل درخواستی نبود اما برای پیاده‌سازی واقعی «JWT Strategy + Refresh Token» (بخش ۱۳ درخواست شما) ضروری است. Access Token اصلاً پرسیست نمی‌شود (stateless JWT کوتاه‌عمر)؛ فقط هش رفرش‌توکن ذخیره می‌شود تا در صورت لو رفتن دیتابیس، توکن‌ها قابل استفاده نباشند.
- **ایندکس:** `userId` — برای revoke سریع همه‌ی سشن‌های یک کاربر (مثلاً هنگام تغییر رمز/۲FA).

---

## Membership / Subscriptions

### `MembershipPlan` («subscriptions» module)
- **هدف:** کاتالوگ مدیریتی پلن‌های عضویت (۳ کارت اصلی Earn/Core/Reward + ۸ تیر اشتراک Start...Organizational — دقیقاً مطابق تحلیل پروتوتایپ بخش ۵).
- **ارتباط‌ها:** N—N با `Category` (کدام دسته‌ها با این پلن در دسترس‌اند)؛ 1—N با `Membership`.
- **فیلد `benefits`/`terms`:** `Json` چون ساختار لیستی-متغیر است (مطابق `membershipCards` در پروتوتایپ) و در این مرحله نیازی به کوئری تک‌تک آیتم‌های benefit نیست.
- **Seed data (`backend/prisma/seed.ts`):** ۳ کارت اصلی با محتوای کامل واقعی از پروتوتایپ. ۸ تیر اشتراک فقط نام واقعی دارند (از story strip پروتوتایپ) — توضیحات/مزایا placeholder است تا محتوای بازاریابی واقعی برسد.
- **مسیر فعال‌سازی با کد اشتراک:** `subscriptionCode` وارد‌شده در ثبت‌نام از طریق `MembershipService.registerSubscriptionCode(userId, code)` به این دامنه می‌رسد (نه از طریق `User`) — منطق واقعی اتصال کد به یک `MembershipPlan`/`Membership` مشخص، Feature-stage است.

### `Membership` («membership» module)
- **هدف:** فعال‌سازی یک پلن توسط یک کاربر مشخص (وضعیت فعلی عضویت او).
- **ارتباط‌ها:** N—1 با `User` و N—1 با `MembershipPlan`.
- **ایندکس:** `[userId, status]` — برای کوئری متداول «عضویت‌های فعال کاربر».
- **چرا از `MembershipPlan` جداست:** یک کاربر می‌تواند چند بار یک پلن را در طول زمان فعال/منقضی کرده باشد (تاریخچه)، در حالی که خود پلن یک رکورد کاتالوگ ثابت است.

---

## Wallet / Credit / Installments

### `Wallet`
- **هدف:** دو کیف‌پول مجزا به‌ازای هر کاربر: `main` (کیف‌پول اصلی) و `reward` (کیف‌پول جایزه) — دقیقاً مطابق پروتوتایپ که این دو را جدا نشان می‌داد.
- **Constraint:** `@@unique([userId, kind])` — یک کاربر نمی‌تواند دو کیف‌پول همنوع داشته باشد.

### `WalletTransaction`
- **هدف:** لاگ غیرقابل‌تغییر (append-only) هر تغییر موجودی، با `balanceAfter` برای Audit بدون نیاز به بازمحاسبه.
- **ایندکس:** `[walletId, createdAt]` — برای صفحه‌ی «گردش حساب».
- **قانون پیاده‌سازی (برای مرحله‌ی Feature):** هر نوشتن در این جدول باید همراه با به‌روزرسانی `Wallet.balance` در یک `prisma.$transaction` اتمیک باشد تا در پرداخت هم‌زمان (race condition) موجودی نادرست نشود.

### `CreditLine` / `CreditUsage`
- **هدف:** خط اعتباری قابل‌استفاده (`limitAmount`/`usedAmount`) و لاگ هر برداشت از آن (`CreditUsage`) — مجزا از Order چون یک برداشت اعتباری لزوماً به یک سفارش گره نمی‌خورد (مثلاً تعدیل دستی پشتیبانی).
- **ارتباط:** `CreditUsage.orderId` اختیاری (`onDelete: SetNull`) — حذف سفارش نباید لاگ مالی را از بین ببرد.
- **ایندکس:** `[userId, status]` روی `CreditLine`، `[creditLineId, createdAt]` روی `CreditUsage`.

### `Installment`
- **هدف:** برنامه‌ی بازپرداخت اقساطی متعلق به یک سفارش مشخص.
- **Constraint:** `orderId @unique` — رابطه‌ی ۱—۱ با `Order` (هر سفارش حداکثر یک برنامه‌ی قسط دارد).
- **ایندکس:** `[userId, status]` — برای صفحه‌ی «اقساط من».

---

## Catalog

### `Category`
- **هدف:** ۱۸+ دسته‌ی خدمات شناسایی‌شده در پروتوتایپ (خودرو، لوازم خانگی، طلا، ...).
- **Constraint:** `name @unique`.
- **ارتباط N—N با `MembershipPlan`:** کدام پلن‌های عضویت این دسته را پوشش می‌دهند.

### `Merchant`
- **هدف:** پذیرنده/فروشنده‌ی ارائه‌دهنده‌ی یک خدمت (اختیاری — بعضی خدمات پذیرنده‌ی مشخص ندارند).

### `Service`
- **هدف:** کاتالوگ محصول/خدمت (مطابق `categoryCatalog` در پروتوتایپ) — هر آیتم به یک `Category` و اختیاراً یک `Merchant` وصل است.
- **فیلد `availableMethods`:** `Json` شامل زیرمجموعه‌ای از ۴ روش خرید (`credit`/`installment`/`cash`/`free`) — نه enum تکی، چون هر خدمت می‌تواند چند روش را هم‌زمان پشتیبانی کند.
- **ایندکس:** `categoryId` — برای لیست‌کردن سریع خدمات یک دسته.

---

## Orders / Payments

### `Order`
- **هدف:** یک خرید مشخص از یک `Service` توسط یک `User`، با یکی از ۴ `PurchaseMethod`.
- **Constraint:** `orderNumber @unique` (شماره‌ی سفارش قابل‌نمایش، مثل نمونه‌ی `BW-14058` در پروتوتایپ).
- **ارتباط‌ها:** اختیاراً 1—1 با `Installment`، 1—N با `CreditUsage` و `Payment`.
- **ایندکس:** `[userId, status]`.

### `Payment`
- **هدف:** رکورد تسویه — یا برای یک `Order` یا برای یک `RewardClaim` (نه هر دو هم‌زمان؛ این قید در سطح Service اعمال می‌شود، نه DB، چون Prisma constraint شرطی چندجدولی ندارد).
- **`provider`:** `wallet` (کسر از کیف‌پول) یا `gateway` (درگاه بانکی) — مطابق مدل پرداخت ترکیبی جایزه در پروتوتایپ.

---

## Rewards

### `Reward`
- **هدف:** کاتالوگ کالای جایزه (۱۶ آیتم نمونه در پروتوتایپ).

### `RewardClaim`
- **هدف:** درخواست دریافت یک جایزه توسط کاربر، با تفکیک `paidFromWallet`/`paidFromGateway` — دقیقاً مطابق مودال «پرداخت ترکیبی» پروتوتایپ.
- **ایندکس:** `[userId, status]`.

---

## Notifications / Advisor

### `Notification`
- **هدف:** اعلان درون‌برنامه‌ای per-user (وضعیت سفارش، پیشنهاد، امنیتی، سیستمی).
- **ایندکس:** `[userId, readAt]` — برای شمارش/نمایش سریع اعلان‌های خوانده‌نشده.

### `AdvisorPersona`
- **هدف:** کاتالوگ سه پرسونای مشاور (وینا/وین‌یاد/آروین) — فقط داده‌ی نمایشی و `systemPrompt`؛ **اتصال واقعی به LLM و تاریخچه‌ی چت در این مرحله ساخته نشده** (خارج از scope مرحله‌ی Foundation، طبق تحلیل پروتوتایپ بخش ۷).
- **Constraint:** `key @unique` (`viana` | `winyar` | `arvin`).

---

## آنچه در این مرحله عمداً ساخته نشده

این‌ها نیاز به تصمیم Product دارند و در schema اضافه نشدند (فهرست کامل در `docs/01-architecture.md` و انتهای گزارش نهایی):

- `Address` (آدرس‌های تحویل)
- `Mission` / `LoyaltyPointsLedgerEntry` (گیمیفیکیشن)
- `ChatMessage` (تاریخچه‌ی چت مشاور)
- `NewsArticle` (اخبار/مقالات)
- `UserConsent` (پذیرش قوانین و شرایط — `docs/07-security.md`)
- منطق محاسبه‌ی خودکار قسط، جریمه دیرکرد، یا امتیازدهی وفاداری
- کاتالوگ کدهای اشتراک/تخفیف و منطق واقعی اعتبارسنجی آن‌ها (`MembershipService.registerSubscriptionCode` فعلاً stub است)
