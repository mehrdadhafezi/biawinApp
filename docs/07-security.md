# Security Foundation

## JWT Strategy

- **Access token:** JWT، امضاشده با `JWT_ACCESS_SECRET`، عمر پیش‌فرض `15m` (`JWT_ACCESS_TTL`). Payload فقط `{ sub: userId, phone }` — بدون داده‌ی حساس. اعتبارسنجی توسط `JwtStrategy` (`backend/src/modules/auth/strategies/jwt.strategy.ts`, passport-jwt، از هدر `Authorization: Bearer`).
- **گارد سراسری:** `JwtAuthGuard` به‌عنوان `APP_GUARD` سراسری ثبت شده — یعنی هر route به‌صورت پیش‌فرض نیاز به توکن معتبر دارد؛ فقط با دکوریتور `@Public()` می‌توان مستثنا کرد (`backend/src/common/decorators/public.decorator.ts`). این یعنی فراموش‌کردن guard روی یک endpoint جدید غیرممکن است — پیش‌فرض امن (secure by default)، نه برعکس.

## Signup Token

- `POST /auth/otp/verify` for a phone with no existing `User` returns a **`signupToken`** instead of full auth tokens — a short-lived (`SIGNUP_TOKEN_TTL_SECONDS`, default 600s) stateless JWT (`{ typ: 'signup', phone }`, signed with `JWT_ACCESS_SECRET`), verified by `AuthService.verifySignupToken`. This lets `POST /auth/signup/complete` trust "this phone was just OTP-verified" without re-sending the code or persisting any server-side session state for the in-between step.
- Not a DB row, so it can't be revoked before expiry — acceptable given its 10-minute lifetime and single use (the phone-existence re-check in `completeSignup` prevents a replayed token from creating a second account).

## Refresh Token

- توکن رفرش یک رشته‌ی تصادفی ۴۸ بایتی (`crypto.randomBytes`) است، **نه JWT** — چون باید قابل Revoke باشد (JWT stateless را نمی‌شود قبل از انقضا باطل کرد).
- در دیتابیس فقط **هش SHA-256** آن ذخیره می‌شود (`RefreshToken.tokenHash`)؛ لو رفتن دیتابیس به‌تنهایی برای جعل نشست کافی نیست.
- **Rotation:** هر بار `POST /auth/refresh` صدا زده شود، توکن قدیم بلافاصله `revokedAt` می‌شود و یک جفت جدید صادر می‌شود — اگر یک توکن رفرش سرقت‌شده دوبار استفاده شود، صاحب اصلی متوجه می‌شود چون نشستش قطع می‌شود (نشانه‌ی سرقت). پیاده‌سازی «invalidate همه‌ی نشست‌ها هنگام تشخیص reuse» یک تقویت Feature-stage است.
- `POST /auth/logout` توکن رفرش را `revokedAt` می‌کند؛ لاگ‌اوت از همه‌ی دستگاه‌ها (revoke همه‌ی `RefreshToken` های کاربر) یک عملیات ساده روی همین جدول است، در نسخه‌ی فعلی endpoint جدا ندارد.

## OTP Security

پنج لایه‌ی مستقل حفاظت (`backend/src/modules/auth/otp.service.ts`، `auth.controller.ts`):

1. **Route-level IP throttle:** `@Throttle()` روی خود endpoint — `POST /auth/otp/request` حداکثر ۵ بار در ۱۰ دقیقه به‌ازای هر IP، `POST /auth/otp/verify` حداکثر ۱۰ بار در ۱۰ دقیقه به‌ازای هر IP (فراتر از سقف سراسری ۱۰۰/۶۰s).
2. **محدودیت ساعتی به‌ازای شماره** (`OTP_MAX_PER_HOUR`، پیش‌فرض ۵): مستقل از IP مهاجم — جلوی هزینه‌ی پیامک روی یک شماره‌ی مشخص را می‌گیرد حتی اگر مهاجم IP عوض کند.
3. **قفل ارسال مجدد:** یک قفل Redis (`otp:resend-lock:...`) مانع از صدور بیش از یک OTP زنده هم‌زمان برای یک شماره می‌شود.
4. **محدودیت تلاش روی خود کد:** `OTP_MAX_ATTEMPTS` (پیش‌فرض ۵) — بعد از اتمام، کد بلافاصله باطل می‌شود.
5. **انقضای کوتاه:** `OTP_TTL_SECONDS` (پیش‌فرض ۱۲۰ ثانیه).

کد ۶ رقمی هرگز plaintext ذخیره نمی‌شود — فقط `sha256(code)` در Redis و در `PhoneVerification.codeHash` (audit trail).

## Rate Limiting

- `@nestjs/throttler` با storage روی Redis (`@nest-lab/throttler-storage-redis`) — به این معنی که محدودیت بین چند instance بک‌اند هم مشترک است (نه in-memory جداگانه به‌ازای هر process).
- پیش‌فرض سراسری: ۱۰۰ درخواست در ۶۰ ثانیه به‌ازای هر کلاینت.
- Override های per-route فعلی: `POST /auth/otp/request` و `POST /auth/otp/verify` (بالا). بقیه‌ی endpoint های حساس (مثلاً `POST /orders`) هنوز روی سقف سراسری‌اند — تنظیم per-route اضافه، Feature-stage.

## Input Validation

- `ValidationPipe` سراسری با `whitelist: true` + `forbidNonWhitelisted: true` + `transform: true` (`backend/src/main.ts`) — هر فیلد خارج از DTO رد می‌شود، نه نادیده گرفته.
- همه‌ی DTOها با `class-validator` (هر ماژول، پوشه‌ی `dto/`).

## Secure Headers / CORS

- `helmet()` روی کل اپ (CSP پیش‌فرض هلمت؛ سفارشی‌سازی CSP دقیق برای دامنه‌های واقعی، Feature-stage).
- CORS با allow-list صریح از `CORS_ORIGINS` (کاما-جدا)، نه `origin: '*'`.
- مقدار Development: `http://localhost:3000`. مقدار Production: `https://biawin.ir` (وقتی زیردامنه‌های آینده مثل `admin.biawin.ir` هم نیاز به دسترسی داشتند، به همین مقدار کاما اضافه می‌شود — `docs/04-deployment.md` "Domains & Environments").

## Development OTP Test Mode

- فقط وقتی **دقیقاً** `NODE_ENV === 'development'` باشد، `OtpService.verify()` یک مسیر میان‌بر دارد: شماره‌ی ثابت `09121111111` + کد ثابت `123456` بدون هیچ بررسی Redis/تلاش/انقضا موفق تلقی می‌شود — برای تست محلی بدون نیاز به SMS واقعی.
- **گارد امنیتی:** این شرط هر بار «تازه» از `ConfigService` خوانده می‌شود (نه cache شده)، و دقیقاً برابری رشته‌ای با `'development'` است — نه `!== 'production'` (که staging/test را هم به‌اشتباه مجاز می‌کرد). یعنی در `staging`/`production`/`test` این مسیر اصلاً اجرا نمی‌شود، حتی اگر کسی این شماره/کد را حدس بزند.
- تست پوشش این رفتار: `backend/src/modules/auth/otp.service.spec.ts` — شامل یک تست صریح که تأیید می‌کند وقتی `NODE_ENV=production` باشد، همین شماره/کد رد می‌شود (نه فقط تست مسیر مثبت).
- خارج از این یک شرط، هیچ تغییری در مسیر OTP واقعی اعمال نشده — همان ۵ لایه‌ی حفاظتی بالا برای هر شماره‌ی دیگر (و برای همین شماره در غیر-development) کامل برقرار است.

## SMS Provider Architecture

Business logic (`OtpService` و آینده: اعلان‌های سفارش) هرگز مستقیم با یک SMS Gateway خاص کار نمی‌کند — فقط با `SmsProvider` interface (`backend/src/modules/notifications/sms/sms-provider.interface.ts`). انتخاب Implementation از `SMS_PROVIDER` (`mock` | `faraz`) در یک Factory Provider اتفاق می‌افتد؛ اگر `faraz` انتخاب شده ولی `FARAZ_USERNAME`/`FARAZ_PASSWORD` ست نشده باشند، خودکار به `MockSmsProvider` (فقط لاگ) سقوط می‌کند — یعنی `pnpm dev`/CI هرگز به خاطر نبود Credential واقعی خراب نمی‌شوند. جزئیات معماری کامل در `docs/01-architecture.md` §2.4.

⚠️ `FarazSmsProvider` بر اساس الگوی معمول مستندشده‌ی API فراز نوشته شده، ولی **در برابر یک حساب واقعی فراز تست نشده** — قبل از فعال‌سازی در staging/production باید shape دقیق request/response در برابر داکیومنت فعلی FarazSMS تأیید شود.

## Payment Provider Architecture

مشابه SMS: `PaymentProvider` interface (`backend/src/modules/payments/providers/`) با دو Implementation (`ZibalProvider`, `ZarinpalProvider`)، انتخاب‌شده از `PAYMENT_PROVIDER` env. **این لایه هنوز به هیچ Business Flow (سفارش، شارژ کیف‌پول، دریافت جایزه) وصل نشده** — طبق دستور صریح، فقط Architecture آماده شده در این مرحله؛ اتصال واقعی (و رعایت الزامات امنیتی پرداخت مثل تأیید مبلغ سمت سرور، idempotency روی verify، جلوگیری از double-spend) Feature-stage است.

## Consent (Terms & Conditions)

- فرم تکمیل پروفایل (`POST /auth/signup/complete`) هیچ فیلد مربوط به پذیرش قوانین ندارد — پذیرش صرفاً یک گیت UI سمت کلاینت است (دکمه تا تیک‌نخوردن چک‌باکس فعال نمی‌شود)، هیچ رکوردی در بک‌اند ثبت نمی‌شود.
- این یک تصمیم عمدی برای محدود نگه‌داشتن Scope در Sprint 0-A است، **نه فراموشی**. وقتی نیاز واقعی (الزام قانونی/انطباق) پیش بیاید، یک مدل `UserConsent` باید اضافه شود: `{ id, userId, version, acceptedAt, ip }` — با نسخه‌بندی متن قوانین، تا تغییر بعدی قوانین قابل ردیابی باشد که هر کاربر کدام نسخه را پذیرفته.

## Subscription Code — Not an Auth Credential

- `subscriptionCode` که در مرحله‌ی تکمیل پروفایل دریافت می‌شود، **هرگز روی `User` ذخیره نمی‌شود** و در تصمیم موفقیت ثبت‌نام نقشی ندارد (نبودش/غلط‌بودنش auth را fail نمی‌کند). مستقیماً به `MembershipService.registerSubscriptionCode(userId, code)` پاس داده می‌شود.
- فعلاً این متد فقط یک stub (لاگ) است — کاتالوگ کدهای معتبر و منطق فعال‌سازی واقعی (اتصال `Membership`/`Wallet`) Feature-stage است؛ اما مرز فراخوانی (Auth → Membership) از همین الان درست است، پس افزودن منطق واقعی بعداً فقط داخل همان یک متد انجام می‌شود، بدون تغییر در `AuthService`.

## Secret Management

- هیچ Secret واقعی در ریپو کامیت نمی‌شود — فقط `*.env.example` با مقادیر placeholder.
- **Development:** `.env` محلی (در `.gitignore`) یا مقادیر inline در `docker-compose.yml` (که خودش placeholder توسعه است، نه رمز واقعی).
- **Staging/Production:** از طریق Secret Manager هاست (مثلاً GitHub Actions Secrets → env تزریق‌شده در زمان deploy). این یک تصمیم Product/Infra معلق است — کدام پلتفرم هاستینگ، کدام Secret Manager (بخش ۴ گزارش نهایی).
- `env.validation.ts` (Zod) هر Secret حیاتی را در Bootstrap اجبار می‌کند — اگر غایب/خیلی کوتاه باشد، اپ اصلاً بالا نمی‌آید (fail fast).

## آنچه هنوز Feature-stage است (عمداً پیاده‌سازی نشد)

- ۲FA واقعی (فیلد `User.twoFactorEnabled` در schema هست، اما فلوی TOTP/SMS دوم پیاده نشده).
- مدل `UserConsent` (پذیرش قوانین) — بالا.
- منطق واقعی `MembershipService.registerSubscriptionCode` (کاتالوگ کد، اعتبارسنجی، فعال‌سازی) — بالا.
- Per-route throttling روی بقیه‌ی endpoint های حساس (غیر از OTP).
- Refresh-token reuse detection فعال (revoke خودکار همه‌ی نشست‌ها).
- CSP سفارشی برای دامنه‌های واقعی production.
- Audit log سطح اپلیکیشن (فراتر از `PhoneVerification`).
- تأیید `FarazSmsProvider` در برابر یک حساب واقعی فراز (بالا).
- اتصال واقعی `PaymentProvider` (Zibal/Zarinpal) به یک Business Flow — بالا.
- بستن Development OTP Test Mode (حذف شماره/کد تست) پیش از هر deploy به staging/production — چون خودش را `NODE_ENV` گارد می‌کند، نیازی به حذف دستی کد نیست؛ فقط باید مطمئن شد `NODE_ENV=production` واقعاً روی هر محیط غیر-dev ست است.
