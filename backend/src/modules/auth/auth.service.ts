import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MembershipService } from '../membership/membership.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import type { CompleteSignupDto } from './dto/complete-signup.dto';
import { OtpService } from './otp.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type VerifyOtpResult =
  | ({ status: 'authenticated' } & AuthTokens)
  | { status: 'signup_required'; signupToken: string };

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

interface SignupTokenPayload {
  typ: 'signup';
  phone: string;
}

/**
 * Unified phone+OTP auth (see docs/03-api.md) — no email, no password anywhere.
 * The client never declares "login" vs "signup"; this service decides, right
 * after the OTP code is verified, based on whether the phone already has a User.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly profilesService: ProfilesService,
    private readonly walletService: WalletService,
    private readonly membershipService: MembershipService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(phone: string): Promise<{ expiresInSeconds: number }> {
    return this.otpService.issue(phone);
  }

  async verifyOtp(
    phone: string,
    code: string,
    meta: SessionMeta,
  ): Promise<VerifyOtpResult> {
    await this.otpService.verify(phone, code);

    const user = await this.usersService.findByPhone(phone);

    if (user) {
      if (!user.phoneVerifiedAt)
        await this.usersService.markPhoneVerified(user.id);
      const tokens = await this.issueTokens(user.id, user.phone, meta);
      return { status: 'authenticated', ...tokens };
    }

    return {
      status: 'signup_required',
      signupToken: this.signSignupToken(phone),
    };
  }

  async completeSignup(
    dto: CompleteSignupDto,
    meta: SessionMeta,
  ): Promise<AuthTokens> {
    const phone = this.verifySignupToken(dto.signupToken);

    const existing = await this.usersService.findByPhone(phone);
    if (existing) {
      throw new BadRequestException('این شماره قبلاً ثبت‌نام کرده است.');
    }

    const user = await this.usersService.createUser({ phone });
    await this.profilesService.createForUser(user.id, dto.fullName.trim());
    await this.walletService.initializeWalletsForUser(user.id);

    if (dto.subscriptionCode) {
      // Never blocks/breaks signup — real validation is Feature-stage (see MembershipService).
      try {
        await this.membershipService.registerSubscriptionCode(
          user.id,
          dto.subscriptionCode,
        );
      } catch (error) {
        this.logger.warn(
          `registerSubscriptionCode failed for user ${user.id}`,
          error as Error,
        );
      }
    }

    return this.issueTokens(user.id, user.phone, meta);
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired, please log in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findByIdOrThrow(record.userId);
    return this.issueTokens(user.id, user.phone, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signSignupToken(phone: string): string {
    const ttl = this.config.get<number>('SIGNUP_TOKEN_TTL_SECONDS', 600);
    const payload: SignupTokenPayload = { typ: 'signup', phone };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ttl,
    });
  }

  private verifySignupToken(token: string): string {
    let payload: SignupTokenPayload;
    try {
      payload = this.jwt.verify<SignupTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'signupToken نامعتبر یا منقضی شده است. دوباره شماره را تأیید کنید.',
      );
    }
    if (payload.typ !== 'signup' || !payload.phone) {
      throw new UnauthorizedException('signupToken نامعتبر است.');
    }
    return payload.phone;
  }

  private async issueTokens(
    userId: string,
    phone: string,
    meta: SessionMeta,
  ): Promise<AuthTokens> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessTtlSeconds = parseTtlToSeconds(accessTtl);
    const accessToken = await this.jwt.signAsync(
      { sub: userId, phone },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtlSeconds,
      },
    );

    const refreshTtlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn: accessTtlSeconds };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

/** Parses "15m" / "1h" / "30d" style TTL strings (as used by @nestjs/jwt) into seconds. */
function parseTtlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const [, value, unit] = match;
  const n = Number(value);
  const perUnit: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (perUnit[unit] ?? 1);
}
