# Deployment Foundation

## محیط‌ها (Environments)

| محیط | هدف | منبع Config |
|---|---|---|
| `development` | لپ‌تاپ توسعه‌دهنده | `docker-compose.yml` (ریشه‌ی ریپو) + `backend/.env` محلی (کپی از `.env.example`) |
| `staging` | تست قبل از انتشار، با داده‌ی نمونه | متغیرهای محیطی از طریق Secret Manager هاست (نه فایل کامیت‌شده) |
| `production` | کاربر واقعی | متغیرهای محیطی از طریق Secret Manager هاست + مقادیر رمزنگاری‌شده در CI/CD |

`NODE_ENV` تعیین‌کننده‌ی رفتار است (`backend/src/config/env.validation.ts`) — یک مقدار از `development | staging | production | test`. **هیچ فایل `.env.staging` یا `.env.production` در ریپو کامیت نمی‌شود** — فقط `*.env.example` (بدون مقدار واقعی) کامیت می‌شوند؛ این یک تصمیم امنیتی عمدی است، نه فراموشی (بخش ۷ همین سند / `docs/07-security.md`).

## Domains & Environments (Production-ready از همین الان)

| محیط | Frontend | Backend | نکته |
|---|---|---|---|
| Development | `http://localhost:3000` | `http://localhost:4000/api/v1` | `apps/web/.env.local` |
| Production | `https://biawin.ir` | `https://api.biawin.ir/api/v1` | زیردامنه‌های آینده: `admin.biawin.ir`, `merchant.biawin.ir`, `cdn.biawin.ir` |

- تمام endpoint های بک‌اند زیر `/api/v1/*` هستند (بدون استثنا، به‌جز `/api/health` که `VERSION_NEUTRAL` است) — چه در dev چه در production.
- فرانت‌اند **هیچ‌جا `localhost` هاردکد ندارد** — `apps/web/src/lib/api-client.ts` مستقیماً از `NEXT_PUBLIC_API_URL` می‌خواند و اگر این متغیر ست نشده باشد، در همان لحظه‌ی import خطای صریح می‌دهد (fail-fast، هم‌راستا با فلسفه‌ی `env.validation.ts` بک‌اند) — نه یک fallback خاموش به یک آدرس محلی.
- `NEXT_PUBLIC_API_URL` باید در **هر** محیط صریحاً ست شود: `apps/web/.env.local` (dev)، `docker-compose.yml` (dev containerized)، `.github/workflows/ci.yml` (فقط برای build، چون در build-time inline می‌شود)، و متغیر deploy-time واقعی برای staging/production.
- یک متغیر دوم، `API_BASE_URL`، برای زمانی رزرو شده که فرانت از Server Component/Route Handler مستقیم (سمت سرور، نه مرورگر) به بک‌اند وصل شود — می‌تواند در production به یک آدرس داخلی شبکه (نه لزوماً دامنه‌ی عمومی) اشاره کند. فعلاً هیچ کد سمت سروری این را نمی‌خواند (همه‌چیز `"use client"` است) — رزرو شده برای Feature-stage.

## استراتژی Docker

- **Development:** `docker compose up -d` در ریشه‌ی ریپو — Postgres، Redis، MinIO به‌همراه `backend`/`web` (که سورس واقعی مونوریپو را با bind mount اجرا می‌کنند، بدون نیاز به build image). جزئیات در `docker-compose.yml`.
- **نکته‌ی مهم (باگ واقعی که پیدا و رفع شد):** چون کل ریپو (شامل `node_modules`) روی هاست Windows/macOS به کانتینر Linux bind-mount می‌شود، اگر `node_modules` هاست هم داخل کانتینر دیده شود، پکیج‌های native (مثل Next.js) با `MODULE_NOT_FOUND` خراب می‌شوند و pnpm روی یک پرامپت تعاملی «reinstall?» گیر می‌کند. راه‌حل: هر مسیر `node_modules` (ریشه + هر app/package) با یک named volume جداگانه پوشانده شده تا هر کانتینر `node_modules` لینوکسی مخصوص خودش را داشته باشد، مستقل از هاست.
- **Production (طراحی، هنوز Dockerfile نساخته‌ایم — Feature-stage):** هر اپ یک Multi-stage Dockerfile مستقل می‌گیرد:
  ```dockerfile
  # backend/Dockerfile (شکل نهایی، نمونه)
  FROM node:20-alpine AS base
  RUN corepack enable
  WORKDIR /app
  COPY . .
  RUN pnpm install --frozen-lockfile
  RUN pnpm --filter @biawin/backend prisma:generate
  RUN pnpm --filter @biawin/backend build

  FROM node:20-alpine AS runner
  WORKDIR /app
  COPY --from=base /app .
  ENV NODE_ENV=production
  CMD ["node", "backend/dist/main.js"]
  ```
  دلیل نساختن آن در همین مرحله: بدون یک محیط CD واقعی (رجیستری ایمیج، هاست هدف) تست‌کردن این Dockerfile فقط هزینه‌ی نگهداری اضافه می‌کند بدون فایده؛ ساخته می‌شود وقتی هدف deploy مشخص شد (Railway/Render/AWS/...).

## Migration در CD

- **دو migration واقعی از همین الان در `backend/prisma/migrations/` وجود دارند** (`init`, `add_service_icon`) — تولیدشده و اجراشده روی یک Postgres واقعی (نه فقط طراحی روی کاغذ).
- Development: `docker-compose.yml` خودش `prisma migrate deploy` (اعمال migration های موجود) و سپس `prisma db seed` را قبل از استارت بک‌اند اجرا می‌کند.
- Staging/Production: مرحله‌ی `prisma migrate deploy` باید **قبل از** جایگزینی نسخه‌ی قبلی backend، به‌عنوان یک Job جدا در CD اجرا شود (نه در فرآیند بوت اپ) تا اگر migration شکست بخورد، نسخه‌ی جدید اصلاً deploy نشود.

## Health Check

`GET /api/health` (بدون auth، بدون versioning) — برای Load Balancer/Docker healthcheck/Kubernetes readiness probe. پاسخ: `{ status: "ok", timestamp }`. بررسی اتصال واقعی به Postgres/Redis در همین اندپوینت، Feature-stage است (فعلاً فقط پروسه زنده بودن را تأیید می‌کند).

## CI/CD

`\.github/workflows/ci.yml` — روی هر push/PR: install → prisma generate → lint → typecheck → test → build (بدون نیاز به سرویس زنده‌ی Postgres/Redis/MinIO، چون تست‌های unit با Prisma/Redis mock شده‌اند؛ تست‌های e2e که به سرویس واقعی نیاز دارند از CI مستثنا هستند — `docs/05-development-guide.md`). مرحله‌ی Deploy (CD واقعی) در این فاز اضافه نشده؛ به هدف Hosting بستگی دارد.
