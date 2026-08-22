# معماری بیاوین — Backend Architecture

این سند دو بخش دارد: (۱) بازبینی معماری فعلی Scaffold شده و پیشنهاد اصلاح قبل از شروع توسعه، (۲) تصمیم‌های معماری Foundation که در این مرحله اضافه شدند.

---

## بخش ۱ — بازبینی معماری فعلی (Architecture Review)

### ساختار فعلی Repository (قبل از این مرحله)

```
biawin-app/
├── apps/
│   ├── web/       Next.js 16 — فقط یک صفحه placeholder
│   └── mobile/    Expo (تمپلیت پیش‌فرض tabs) — دست‌نخورده
├── backend/
│   ├── src/
│   │   ├── app.controller.ts   ← تک controller پیش‌فرض Nest
│   │   ├── app.service.ts
│   │   ├── app.module.ts       ← فقط ConfigModule + PrismaModule
│   │   ├── main.ts
│   │   └── prisma/              ← PrismaService سراسری
│   └── prisma/schema.prisma     ← فقط مدل User (حداقلی)
├── packages/
│   ├── ui/        فقط design tokens (بدون کامپوننت)
│   ├── config/    tsconfig + eslint پایه
│   └── types/     مدل‌های دامنه (به‌عنوان مرجع، نه منبع واقعی — منبع واقعی از این پس Prisma است)
└── docs/          تحلیل پروتوتایپ + تصمیم‌های scaffold
```

### نقاط قوت

1. **جداسازی درست لایه‌ها از روز اول**: مونوریپو با `apps/`، `backend/` و `packages/` مجزا، امکان توسعه مستقل web/mobile/backend را بدون تداخل می‌دهد.
2. **TypeScript سراسری**: نوع‌های دامنه در `packages/types` و توکن‌های طراحی در `packages/ui` از قبل به‌عنوان workspace dependency به هر سه اپ وصل شده‌اند — پایه‌ی خوبی برای هم‌راستایی Frontend/Backend.
3. **Prisma از ابتدا wire شده**: `PrismaService`/`PrismaModule` به‌صورت Global در NestJS ثبت شده، یعنی افزودن مدل‌های جدید فقط نیاز به تغییر schema دارد، نه ری‌فکتور معماری.
4. **بدون بدهی فنی پنهان**: چون فقط Scaffold ساختاری بود (نه کد Feature)، هیچ تصمیم اشتباهی هنوز قفل نشده است — زمان مناسبی برای اضافه‌کردن Foundation درست است.

### مشکلات/ریسک‌های شناسایی‌شده (قبل از این مرحله)

| # | مشکل | ریسک |
|---|---|---|
| 1 | همه چیز در `backend/src` تخت (flat) بود؛ بدون تفکیک Module دامنه‌ای | با اضافه‌شدن Featureها، `src/` شلوغ و غیرقابل‌نگهداری می‌شود |
| 2 | بدون Redis/Queue/Storage | OTP، rate-limit، session و کارهای async (پیامک، نوتیفیکیشن) راهی برای پیاده‌سازی صحیح نداشتند |
| 3 | Prisma schema فقط `User` داشت | نمی‌شد هیچ Module واقعی (wallet، credit، order، ...) را پیاده کرد |
| 4 | بدون Swagger/Versioning/Error format استاندارد | هر توسعه‌دهنده احتمالاً یک قرارداد API متفاوت می‌ساخت |
| 5 | بدون Docker Compose | وابستگی به نصب دستی PostgreSQL/Redis/MinIO روی سیستم هر توسعه‌دهنده |
| 6 | بدون CI | خطاهای lint/type/test فقط موقع build دیده می‌شدند، نه در PR |
| 7 | بدون استراتژی مشخص برای Secret/Env در محیط‌های مختلف | ریسک نشت اطلاعات حساس یا پیکربندی اشتباه staging/production |
| 8 | `packages/ui` فقط token داشت، بدون کامپوننت پایه | هر اپ مجبور بود دوباره Button/Card/Modal را از صفر بسازد → ناهم‌خوانی بصری |

### تصمیم گرفته‌شده: پذیرش کامل پیشنهاد کاربر + چند اصلاح

پیشنهاد شما (Modular Monolith، Redis، BullMQ، MinIO/S3، ۱۹ مدل Prisma، Swagger با versioning، Docker Compose، GitHub Actions، Security Foundation) از نظر معماری **منطقی، متعارف و مناسب مرحله‌ی فعلی محصول** است — نه over-engineered (مثل رفتن زودهنگام به Microservices) و نه under-engineered (مثل نادیده گرفتن Queue/Cache از ابتدا). هیچ‌کدام از این ۱۵ مورد رد نشد. با این حال، ۴ نکته‌ی اصلاحی/تکمیلی قبل از اجرا اضافه شد:

1. **قانون مرزبندی Module (Module Boundary Rule)**: در Modular Monolith، بزرگ‌ترین ریسک این است که ماژول‌ها مستقیماً به جدول‌های Prisma ماژول‌های دیگر دسترسی پیدا کنند و مرز بین آن‌ها محو شود (که بعداً جداسازی به Microservice را غیرممکن می‌کند). **قانون**: هر ماژول فقط از طریق `Service` صادرشده‌ی ماژول دیگر (نه مستقیم از `PrismaService`) به داده‌ی خارج از دامنه‌ی خودش دسترسی دارد. این قانون در پایین همین سند مستند شده.
2. **اعتبارسنجی Env در Bootstrap**: به‌جای اعتماد به `process.env` بدون بررسی، یک لایه‌ی اعتبارسنجی (Zod schema) در `ConfigModule` اضافه شد که اگر متغیر محیطی حیاتی (مثل `DATABASE_URL` یا `JWT_ACCESS_SECRET`) غایب باشد، اپ در Bootstrap خطا می‌دهد نه در وسط اجرا.
3. **تراکنش‌های مالی**: عملیات‌هایی که موجودی کیف‌پول/اعتبار را تغییر می‌دهند (`WalletTransaction`، `CreditUsage`) باید همیشه از طریق تراکنش اتمیک Prisma (`$transaction`) انجام شوند تا race condition در پرداخت هم‌زمان رخ ندهد. این الزام در `docs/02-database.md` و کامنت‌های سرویس مربوطه مستند شده (پیاده‌سازی کامل منطق در مرحله‌ی Feature است).
4. **جداسازی «عضویت فعال کاربر» از «کاتالوگ پلن‌ها»**: در درخواست شما دو ماژول `membership` و `subscriptions` هر دو ذکر شده بودند بدون تعریف دقیق تفاوت. تصمیم گرفته شد: `subscriptions` = کاتالوگ پلن‌های عضویت (مدیریتی/Admin، مدل `MembershipPlan`) و `membership` = وضعیت عضویت فعلی هر کاربر (مدل `Membership`، رابطه با `MembershipPlan`). این تفکیک در schema و ماژول‌ها اعمال شده — لطفاً تأیید کنید که با نیت شما هم‌خوانی دارد.

هیچ مورد دیگری از ۱۵ بخش درخواستی رد یا تغییر اساسی داده نشد.

---

## بخش ۲ — تصمیمات معماری Foundation

### 2.1 الگوی Modular Monolith

```
backend/src/
├── common/                 ← کراس-کاتینگ: فیلترها، اینترسپتورها، دکوریتورها، پایپ‌ها، گاردها
├── config/                 ← اعتبارسنجی و بارگذاری env
├── infra/
│   ├── prisma/             ← PrismaService (Global)
│   ├── redis/              ← RedisModule (Global) — OTP، cache، rate-limit، session
│   ├── queue/               ← BullMQ — تعریف صف‌ها و Processorهای پایه
│   └── storage/             ← StorageModule — MinIO (dev) / S3-compatible (prod)
└── modules/
    ├── auth/                ← OTP + JWT + Refresh Token (منطق واقعی از همین مرحله)
    ├── users/
    ├── profiles/
    ├── membership/          ← عضویت فعال کاربر
    ├── subscriptions/       ← کاتالوگ پلن‌های عضویت
    ├── wallet/
    ├── transactions/        ← تراکنش‌های کیف‌پول
    ├── credit/               ← خط اعتباری
    ├── installments/
    ├── services/            ← کاتالوگ خدمات/محصولات
    ├── categories/
    ├── merchants/
    ├── orders/
    ├── payments/
    ├── rewards/
    ├── notifications/
    └── advisor/              ← کاتالوگ پرسونای مشاور (بدون اتصال واقعی به LLM در این مرحله)
```

**قانون مرزبندی (Module Boundary Rule):**
- هر ماژول `Service` خودش را export می‌کند؛ ماژول‌های دیگر فقط از طریق آن Service به داده دسترسی دارند، نه مستقیم از `PrismaService`.
- استثنا: خواندن ساده و read-only بین ماژول‌های بسیار نزدیک (مثل `wallet` که مستقیم مدل `Wallet` خودش را می‌خواند) مجاز است؛ اما `orders` هرگز نباید مستقیم به جدول `Wallet` بنویسد — باید از `WalletService.debit()` استفاده کند.
- این قانون هزینه‌ی تقریباً صفر دارد الان، ولی اگر بعداً لازم شد یک ماژول (مثلاً `payments`) به یک سرویس مستقل (Microservice) منتقل شود، مرز از قبل مشخص است.

### 2.2 لایه‌های Infra مشترک

| لایه | ابزار | مصرف‌کننده‌ها |
|---|---|---|
| Cache/OTP/Session/Rate-limit | Redis (`ioredis`) | `auth` (OTP)، `common` (Throttler storage)، هر ماژولی که به cache نیاز دارد |
| Queue (Async Jobs) | BullMQ + Redis | SMS، Push، Email، پردازش تراکنش مالی، ایونت‌های مالی |
| Object Storage | MinIO (dev) / S3-compatible (prod) | آواتار کاربر، تصاویر خدمات/پذیرندگان، مدارک |
| Database | PostgreSQL + Prisma | همه‌ی ماژول‌ها (از طریق قانون مرزبندی بالا) |

### 2.3 چرا Modular Monolith و نه Microservice

- تیم و محصول در مرحله‌ی MVP هستند؛ Microservice هزینه‌ی عملیاتی (deploy، observability، network reliability بین سرویس‌ها) را زودهنگام تحمیل می‌کند بدون آنکه فایده‌ی مقیاس‌پذیری‌اش لازم باشد.
- مرزبندی داخلی (بخش 2.1) این امکان را حفظ می‌کند که در آینده، ماژول‌های پرترافیک/حساس (مثلاً `payments` یا `advisor`) به سرویس مستقل تبدیل شوند بدون بازنویسی کامل.

### 2.4 Provider Abstractions (SMS / Payment)

هر دو با یک الگوی یکسان طراحی شده‌اند: **Business logic فقط با یک Interface کار می‌کند، هرگز مستقیم با یک Gateway خاص.** انتخاب Implementation واقعی فقط در یک Factory Provider (تزریق‌شونده با `ConfigService`) اتفاق می‌افتد.

**SMS** (`backend/src/modules/notifications/sms/`):
```
NotificationsModule
  └─ SmsProcessor (BullMQ worker، صف QUEUE.SMS)
       └─ SMS_PROVIDER (token) ← smsProviderFactory (بر اساس env SMS_PROVIDER)
            ├─ MockSmsProvider   (پیش‌فرض — فقط لاگ می‌کند)
            └─ FarazSmsProvider  (REST client — نیاز به تأیید در برابر داکیومنت واقعی FarazSMS قبل از Production)
```
`auth`'s `OtpService` هیچ‌وقت مستقیم با SMS provider حرف نمی‌زند — فقط یک Job در صف `QUEUE.SMS` می‌گذارد؛ `SmsProcessor` (متعلق به دامنه‌ی Notifications، نه `infra/queue`) آن را با provider فعلی اجرا می‌کند.

**Payment** (`backend/src/modules/payments/providers/`):
```
PAYMENT_PROVIDER (token) ← paymentProviderFactory (بر اساس env PAYMENT_PROVIDER)
  ├─ ZibalProvider     implements PaymentProvider
  └─ ZarinpalProvider  implements PaymentProvider
```
`PaymentProvider` شامل `createPayment()`/`verifyPayment()` است. **هنوز به هیچ Feature (سفارش، شارژ کیف‌پول، دریافت جایزه) وصل نشده** — طبق دستور صریح، فقط Architecture آماده شده، نه Business Logic (`docs/07-security.md` "Payment Provider Architecture").
