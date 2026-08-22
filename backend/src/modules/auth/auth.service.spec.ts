import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MembershipService } from '../membership/membership.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

const CONFIG: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-16-chars',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL_DAYS: 30,
  SIGNUP_TOKEN_TTL_SECONDS: 600,
};

describe('AuthService', () => {
  let service: AuthService;
  let otpService: { issue: jest.Mock; verify: jest.Mock };
  let usersService: {
    findByPhone: jest.Mock;
    findByIdOrThrow: jest.Mock;
    createUser: jest.Mock;
    markPhoneVerified: jest.Mock;
  };
  let profilesService: { createForUser: jest.Mock };
  let walletService: { initializeWalletsForUser: jest.Mock };
  let membershipService: { registerSubscriptionCode: jest.Mock };
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    otpService = { issue: jest.fn(), verify: jest.fn() };
    usersService = {
      findByPhone: jest.fn(),
      findByIdOrThrow: jest.fn(),
      createUser: jest.fn(),
      markPhoneVerified: jest.fn(),
    };
    profilesService = { createForUser: jest.fn() };
    walletService = { initializeWalletsForUser: jest.fn() };
    membershipService = { registerSubscriptionCode: jest.fn() };
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpService },
        { provide: UsersService, useValue: usersService },
        { provide: ProfilesService, useValue: profilesService },
        { provide: WalletService, useValue: walletService },
        { provide: MembershipService, useValue: membershipService },
        { provide: PrismaService, useValue: prisma },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => CONFIG[key] ?? fallback,
            getOrThrow: (key: string) => CONFIG[key],
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('requestOtp delegates to OtpService.issue', async () => {
    otpService.issue.mockResolvedValue({ expiresInSeconds: 120 });
    const result = await service.requestOtp('09121234567');
    expect(otpService.issue).toHaveBeenCalledWith('09121234567');
    expect(result).toEqual({ expiresInSeconds: 120 });
  });

  it('verifyOtp returns tokens for an existing user (login)', async () => {
    otpService.verify.mockResolvedValue(undefined);
    usersService.findByPhone.mockResolvedValue({
      id: 'u1',
      phone: '09121234567',
      phoneVerifiedAt: new Date(),
    });

    const result = await service.verifyOtp('09121234567', '123456', {});

    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    }
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('verifyOtp returns a signupToken for a new phone (no User row)', async () => {
    otpService.verify.mockResolvedValue(undefined);
    usersService.findByPhone.mockResolvedValue(null);

    const result = await service.verifyOtp('09129999999', '123456', {});

    expect(result.status).toBe('signup_required');
    if (result.status === 'signup_required') {
      expect(result.signupToken).toEqual(expect.any(String));
    }
    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('completeSignup creates the user/profile/wallets and never persists subscriptionCode on User', async () => {
    otpService.verify.mockResolvedValue(undefined);
    usersService.findByPhone.mockResolvedValueOnce(null); // at verify time
    const verifyResult = await service.verifyOtp('09121112222', '123456', {});
    if (verifyResult.status !== 'signup_required')
      throw new Error('expected signup_required');

    usersService.findByPhone.mockResolvedValueOnce(null); // re-check inside completeSignup
    usersService.createUser.mockResolvedValue({
      id: 'new-user',
      phone: '09121112222',
    });

    await service.completeSignup(
      {
        signupToken: verifyResult.signupToken,
        fullName: 'Test User',
        subscriptionCode: 'PROMO123',
      },
      {},
    );

    // Exact-args match below also proves subscriptionCode was NOT passed to
    // createUser (see UsersService.createUser signature) — it never touches User.
    expect(usersService.createUser).toHaveBeenCalledWith({
      phone: '09121112222',
    });
    expect(profilesService.createForUser).toHaveBeenCalledWith(
      'new-user',
      'Test User',
    );
    expect(walletService.initializeWalletsForUser).toHaveBeenCalledWith(
      'new-user',
    );
    expect(membershipService.registerSubscriptionCode).toHaveBeenCalledWith(
      'new-user',
      'PROMO123',
    );
  });

  it('completeSignup rejects a garbage/expired signupToken', async () => {
    await expect(
      service.completeSignup(
        { signupToken: 'not-a-real-token', fullName: 'X' },
        {},
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refresh rejects when the token hash is unknown', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('some-refresh-token', {})).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
