import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE } from '../../infra/queue/queue.constants';
import type { SmsJobData } from '../notifications/processors/sms.processor';
import { RedisService } from '../../infra/redis/redis.service';

interface OtpRecord {
  codeHash: string;
  attemptsRemaining: number;
}

/** Fixed purpose for the unified login/signup OTP flow (see docs/03-api.md). */
const PURPOSE = 'auth' as const;

/**
 * Test credentials that bypass real OTP verification (docs/07-security.md
 * "Development OTP Test Mode") — lets a frontend log in without a real SMS
 * provider. Fires when EITHER:
 *  - `NODE_ENV === 'development'` (local dev, always on), or
 *  - `STAGING_TEST_AUTH === 'true'` (staging only, opt-in per deployment —
 *    the staging .env simply omits/falsifies this to turn it off).
 * Both are checked fresh on every call, never cached. A real production .env
 * must never set STAGING_TEST_AUTH=true — see docs/08-staging-deployment.md.
 */
const DEV_TEST_PHONE = '09121111111';
const DEV_TEST_CODE = '123456';

/**
 * OTP hot-path state lives in Redis (fast, TTL-based expiry, hashed code — see
 * docs/07-security.md "OTP Security"). A PhoneVerification row is also written
 * for audit/analytics — Redis is the source of truth for "is this code still
 * valid", the DB row is the durable record of what happened.
 *
 * Layered abuse protection (docs/07-security.md):
 *  1. Route-level IP throttle (`@Throttle` on the controller, not here).
 *  2. Per-phone hourly cap (`OTP_MAX_PER_HOUR`) — protects against SMS-cost abuse
 *     targeting one phone number, independent of the attacker's IP.
 *  3. Per-phone resend lock — at most one live code per phone at a time.
 *  4. Per-code attempt cap (`OTP_MAX_ATTEMPTS`) — protects against guessing.
 *  5. Short TTL expiration (`OTP_TTL_SECONDS`).
 */
@Injectable()
export class OtpService {
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly maxPerHour: number;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE.SMS) private readonly smsQueue: Queue<SmsJobData>,
  ) {
    this.ttlSeconds = this.config.get<number>('OTP_TTL_SECONDS', 120);
    this.maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 5);
    this.maxPerHour = this.config.get<number>('OTP_MAX_PER_HOUR', 5);
  }

  private redisKey(phone: string): string {
    return `otp:${PURPOSE}:${phone}`;
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async issue(phone: string): Promise<{ expiresInSeconds: number }> {
    // Layer 2: per-phone hourly cap (independent of the caller's IP).
    const hourlyKey = `otp:hourly:${phone}`;
    const issuedThisHour = await this.redis.incrWithTtl(hourlyKey, 3600);
    if (issuedThisHour > this.maxPerHour) {
      throw new HttpException(
        'تعداد درخواست‌های کد در این ساعت برای این شماره تمام شده است.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Layer 3: at most one live code per phone at a time.
    const resendKey = `otp:resend-lock:${phone}`;
    const attempts = await this.redis.incrWithTtl(resendKey, this.ttlSeconds);
    if (attempts > 1) {
      throw new HttpException(
        'کد قبلی هنوز معتبر است، کمی صبر کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const record: OtpRecord = {
      codeHash: this.hashCode(code),
      attemptsRemaining: this.maxAttempts,
    };
    await this.redis.setJson(this.redisKey(phone), record, this.ttlSeconds);

    await this.prisma.phoneVerification.create({
      data: {
        phone,
        purpose: PURPOSE,
        codeHash: record.codeHash,
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
        attemptsRemaining: this.maxAttempts,
      },
    });

    await this.smsQueue.add('send-otp', {
      phone,
      message: `کد ورود بیاوین: ${code}`,
    });

    return { expiresInSeconds: this.ttlSeconds };
  }

  async verify(phone: string, code: string): Promise<void> {
    const testBypassEnabled =
      this.config.get<string>('NODE_ENV') === 'development' ||
      this.config.get<boolean>('STAGING_TEST_AUTH', false) === true;
    if (
      testBypassEnabled &&
      phone === DEV_TEST_PHONE &&
      code === DEV_TEST_CODE
    ) {
      return;
    }

    const key = this.redisKey(phone);
    const record = await this.redis.getJson<OtpRecord>(key);
    if (!record) {
      throw new BadRequestException('کد منقضی شده یا ارسال نشده است.');
    }
    // Layer 4: per-code attempt cap.
    if (record.attemptsRemaining <= 0) {
      await this.redis.del(key);
      throw new BadRequestException('تعداد تلاش‌های مجاز تمام شده است.');
    }

    if (this.hashCode(code) !== record.codeHash) {
      record.attemptsRemaining -= 1;
      const ttl = await this.redis.ttl(key);
      await this.redis.setJson(key, record, ttl > 0 ? ttl : this.ttlSeconds);
      throw new BadRequestException('کد وارد شده صحیح نیست.');
    }

    await this.redis.del(key);
    await this.prisma.phoneVerification.updateMany({
      where: { phone, purpose: PURPOSE, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
