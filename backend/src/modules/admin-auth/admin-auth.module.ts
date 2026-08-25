import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuditLogModule } from '../admin-audit-log/admin-audit-log.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), AdminAuditLogModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
