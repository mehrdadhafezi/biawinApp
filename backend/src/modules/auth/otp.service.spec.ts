import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE } from '../../infra/queue/queue.constants';
import { RedisService } from '../../infra/redis/redis.service';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  let redis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    del: jest.Mock;
    ttl: jest.Mock;
    incrWithTtl: jest.Mock;
  };
  let prisma: {
    phoneVerification: { create: jest.Mock; updateMany: jest.Mock };
  };
  let smsQueue: { add: jest.Mock };
  let nodeEnv: string;
  let stagingTestAuth: boolean;

  async function buildService(): Promise<OtpService> {
    redis = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn().mockResolvedValue(60),
      incrWithTtl: jest.fn().mockResolvedValue(1),
    };
    prisma = {
      phoneVerification: { create: jest.fn(), updateMany: jest.fn() },
    };
    smsQueue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: redis },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE.SMS), useValue: smsQueue },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              if (key === 'NODE_ENV') return nodeEnv;
              if (key === 'STAGING_TEST_AUTH')
                return stagingTestAuth ?? fallback;
              return fallback;
            },
          },
        },
      ],
    }).compile();

    return module.get(OtpService);
  }

  beforeEach(() => {
    stagingTestAuth = false;
  });

  describe('development test bypass', () => {
    it('accepts the fixed test phone/code when NODE_ENV=development, without touching Redis', async () => {
      nodeEnv = 'development';
      const service = await buildService();

      await expect(
        service.verify('09121111111', '123456'),
      ).resolves.toBeUndefined();
      expect(redis.getJson).not.toHaveBeenCalled();
    });

    it('rejects the test phone/code when NODE_ENV=production (falls through to the real check)', async () => {
      nodeEnv = 'production';
      const service = await buildService();
      redis.getJson.mockResolvedValue(null);

      await expect(service.verify('09121111111', '123456')).rejects.toThrow(
        BadRequestException,
      );
      expect(redis.getJson).toHaveBeenCalled();
    });

    it('rejects the test phone/code when NODE_ENV is unset (falls through to the real check)', async () => {
      nodeEnv = undefined as unknown as string;
      const service = await buildService();
      redis.getJson.mockResolvedValue(null);

      await expect(service.verify('09121111111', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does NOT bypass a different phone even in development', async () => {
      nodeEnv = 'development';
      const service = await buildService();
      redis.getJson.mockResolvedValue(null);

      await expect(service.verify('09120000000', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts the fixed test phone/code when NODE_ENV=production and STAGING_TEST_AUTH=true', async () => {
      nodeEnv = 'production';
      stagingTestAuth = true;
      const service = await buildService();

      await expect(
        service.verify('09121111111', '123456'),
      ).resolves.toBeUndefined();
      expect(redis.getJson).not.toHaveBeenCalled();
    });

    it('rejects the test phone/code when NODE_ENV=production and STAGING_TEST_AUTH is unset (falls through to the real check)', async () => {
      nodeEnv = 'production';
      stagingTestAuth = false;
      const service = await buildService();
      redis.getJson.mockResolvedValue(null);

      await expect(service.verify('09121111111', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('real OTP flow', () => {
    beforeEach(() => {
      nodeEnv = 'production';
    });

    it('issues a code, hashes it, and enqueues an SMS job', async () => {
      const service = await buildService();
      const result = await service.issue('09121234567');

      expect(result.expiresInSeconds).toEqual(expect.any(Number));
      expect(redis.setJson).toHaveBeenCalled();
      expect(prisma.phoneVerification.create).toHaveBeenCalled();
      expect(smsQueue.add).toHaveBeenCalledWith(
        'send-otp',
        expect.objectContaining({ phone: '09121234567' }),
      );
    });

    it('rejects verification when no code was issued', async () => {
      const service = await buildService();
      redis.getJson.mockResolvedValue(null);
      await expect(service.verify('09121234567', '000000')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
