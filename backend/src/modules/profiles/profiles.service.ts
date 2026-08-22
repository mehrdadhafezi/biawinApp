import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { Profile } from '@prisma/client';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string, fullName: string): Promise<Profile> {
    return this.prisma.profile.create({ data: { userId, fullName } });
  }

  async findByUserIdOrThrow(userId: string): Promise<Profile> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async update(
    userId: string,
    input: Partial<
      Pick<
        Profile,
        'fullName' | 'email' | 'nationalId' | 'birthDate' | 'avatarKey'
      >
    >,
  ): Promise<Profile> {
    return this.prisma.profile.update({ where: { userId }, data: input });
  }
}
