# تصمیمات فنی Scaffold (پروژه Production)

تاریخ: ۱۴۰۵/۰۵/۲۹ (2026-08-20)

بر اساس تحلیل پروتوتایپ ([01-prototype-analysis.md](01-prototype-analysis.md))، ساختار زیر برای پروژه Production بیاوین ایجاد شد. این تصمیم‌ها با تأیید مستقیم کاربر (از بین گزینه‌های پیشنهادی) گرفته شدند:

| تصمیم | انتخاب | دلیل |
|---|---|---|
| مدیریت مونوریپو | pnpm workspaces + Turborepo | استاندارد صنعت برای مونوریپوهای TypeScript؛ build cache سریع؛ مناسب برای web+mobile+backend مشترک |
| اپ وب (`apps/web`) | Next.js 16 (App Router) | SSR/SEO برای صفحات محصول/دسته‌بندی که ایندکس‌پذیری برایشان مهم است؛ RTL و فونت فارسی به‌خوبی پشتیبانی می‌شود |
| اپ موبایل (`apps/mobile`) | Expo (React Native) + expo-router | سریع‌ترین مسیر برای MVP موبایل؛ اشتراک کد و منطق (نوع‌ها، توکن‌های طراحی) با وب از طریق `packages/` |
| بک‌اند (`backend`) | NestJS + Prisma + PostgreSQL | معماری ماژولار مناسب دامنه‌های زیاد (auth، wallet، orders، advisor/AI)؛ TypeScript سراسری هم‌راستا با `packages/types` |

## ساختار نهایی

```
biawin-app/
├── apps/
│   ├── web/       Next.js 16، TypeScript، Tailwind v4، RTL/fa پیش‌فرض
│   └── mobile/    Expo (تمپلیت tabs)، TypeScript
├── backend/       NestJS، ConfigModule سراسری، PrismaModule سراسری
├── packages/
│   ├── ui/        توکن‌های طراحی (رنگ، radius، سایه، فونت) از بخش ۳ سند تحلیل
│   ├── config/    tsconfig پایه مشترک + eslint پایه مشترک
│   └── types/     مدل‌های دامنه مشترک (User, Membership, Catalog, Order, Wallet, Reward, Mission, Advisor, ...) از بخش ۵ سند تحلیل
└── docs/
```

## نکات مهم برای مراحل بعدی

- **این یک Scaffold ساختاری است، نه پیاده‌سازی کامل.** صفحات واقعی (خانه، خدمات، پروفایل و ...) در مرحله‌ی Frontend ساخته می‌شوند؛ فعلاً فقط یک صفحه‌ی placeholder در `apps/web` وجود دارد که اتصال فونت/RTL/پکیج‌های مشترک را تأیید می‌کند.
- **schema.prisma فعلاً حداقلی است** (فقط مدل `User`) تا دستورات `prisma generate`/`migrate` از همین حالا کار کنند. طراحی کامل دیتابیس (تمام Entity های بخش ۵ سند تحلیل) در مرحله‌ی «طراحی Database» انجام می‌شود.
- برای اجرای بک‌اند نیاز به PostgreSQL محلی و کپی `backend/.env.example` به `backend/.env` است.
- `packages/ui/src/tokens.ts` تنها منبع رسمی رنگ‌ها/radius/سایه‌ها است؛ هر تنظیمات Tailwind یا theme موبایل باید از همین‌جا مقدار بگیرد تا سیستم طراحی یکپارچه بماند.
