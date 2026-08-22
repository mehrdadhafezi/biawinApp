# راهنمای توسعه (Development Guide)

## شروع سریع

**گزینه ۱ — همه‌چیز با Docker (پیشنهادی، Verify شده به‌صورت زنده):**

```bash
docker compose up -d
```
- Web: http://localhost:3000
- Backend: http://localhost:4000/api (Swagger: http://localhost:4000/api/docs)
- MinIO Console: http://localhost:9001 (کاربر/رمز: `biawin` / `biawin12345`)

اولین اجرا کمی طول می‌کشد (نصب `node_modules` داخل کانتینر + اعمال Migration ها + Seed). دفعات بعد سریع‌تر است چون `node_modules` هر سرویس در یک named volume جدا نگه داشته می‌شود (نه از هاست) — به همین دلیل هیچ‌وقت با باینری‌های ناسازگار هاست/کانتینر تداخل نمی‌کند (`docs/04-deployment.md`).

**گزینه ۲ — اجرای دستی روی هاست (سریع‌تر برای توسعه‌ی فعال، فقط زیرساخت در Docker):**

```bash
pnpm install
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
docker compose up -d postgres redis minio minio-init   # فقط زیرساخت

pnpm --filter @biawin/backend prisma:generate
pnpm --filter @biawin/backend prisma:migrate   # migration های موجود را اعمال می‌کند؛ برای مدل جدید --name می‌خواهد
pnpm --filter @biawin/backend prisma:seed
pnpm dev   # همه‌ی اپ‌ها را با turbo موازی اجرا می‌کند (backend + web)
```

⚠️ اگر روی Windows، پورت ۵۴۳۲ توسط یک نصب PostgreSQL محلی (غیر از Docker) اشغال شده باشد، اتصال هاست به کانتینر ممکن است به‌جای آن به همان Postgres محلی برود. اگر `prisma migrate`/`prisma:seed` روی هاست با خطای Authentication مواجه شد، یا پورت ۵۴۳۲ را آزاد کنید یا از گزینه‌ی ۱ (کامل Docker) استفاده کنید — داخل شبکه‌ی Docker این تداخل وجود ندارد.

## دستورات پرکاربرد

| دستور | کار |
|---|---|
| `pnpm dev` | همه‌ی اپ‌ها (turbo) |
| `pnpm --filter @biawin/web dev` | فقط وب |
| `pnpm --filter @biawin/backend dev` | فقط بک‌اند |
| `pnpm --filter @biawin/mobile dev` | فقط موبایل (Expo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | روی کل مونوریپو (turbo) |
| `pnpm --filter @biawin/backend test` | تست‌های unit بک‌اند |
| `pnpm --filter @biawin/backend test:e2e` | تست e2e — نیاز به `docker compose up` واقعی دارد |
| `pnpm --filter @biawin/backend prisma:studio` | مرورگر گرافیکی دیتابیس |

## قانون مرزبندی Module (تکرار از `docs/01-architecture.md`)

هر ماژول در `backend/src/modules/*` فقط از طریق `Service` صادرشده‌ی ماژول دیگر به داده‌ی خارج از دامنه‌ی خودش دسترسی پیدا می‌کند، نه مستقیم از `PrismaService`. مثال درست: `orders` برای کم‌کردن موجودی کیف‌پول، `WalletService.debit(...)` را صدا می‌زند؛ مثال غلط: `orders` مستقیم `prisma.wallet.update(...)` بزند.

## افزودن یک Module جدید

هر ماژول در `backend/src/modules/<name>/` این فایل‌ها را دارد:
```
<name>.module.ts
<name>.controller.ts
<name>.service.ts
dto/*.dto.ts
<name>.controller.spec.ts
```
سپس در `backend/src/app.module.ts` به آرایه‌ی `imports` اضافه شود. برای مدل‌های داده، ابتدا در `backend/prisma/schema.prisma` تعریف و `pnpm --filter @biawin/backend prisma:migrate` اجرا شود، سپس در `docs/02-database.md` مستند شود.

## تست

- Unit: هر `*.controller.spec.ts` / `*.service.spec.ts` با `PrismaService` mock‌شده (نمونه‌ها را در ماژول‌های تولیدشده ببینید).
- e2e: کل `AppModule` واقعی بالا می‌آید — نیاز به Postgres/Redis/MinIO واقعی (`docker compose up`)، به همین دلیل در CI اجرا نمی‌شود.

## Lint/Format

- `pnpm lint` (eslint، هر پکیج کانفیگ خودش را دارد، پایه از `packages/config/eslint.config.mjs`).
- `pnpm format` (Prettier، در ریشه).

## Import پکیج‌های مشترک

```ts
import { color, radius, Button, Card } from "@biawin/ui";
import type { User, Order } from "@biawin/types"; // مرجع نوع دامنه سمت فرانت — منبع واقعی روی بک‌اند خود مدل‌های Prisma است
```
