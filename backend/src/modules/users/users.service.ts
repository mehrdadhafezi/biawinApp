import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(input: {
    phone: string;
    referredByCode?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone: input.phone,
        phoneVerifiedAt: new Date(),
        inviteCode: await this.generateUniqueInviteCode(),
        referredByCode: input.referredByCode,
      },
    });
  }

  async markPhoneVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `BIYA-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.user.findUnique({
        where: { inviteCode: code },
      });
      if (!exists) return code;
    }
    throw new Error('Could not generate a unique invite code');
  }
}
