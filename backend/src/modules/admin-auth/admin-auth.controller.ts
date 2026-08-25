import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdminUser } from '../../common/decorators/current-admin-user.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import type { AuthenticatedAdminUser } from './types/authenticated-admin-user.type';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh-token.dto';

function sessionMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/**
 * `@Public()` at the controller level opts every route here out of the
 * *customer* global JwtAuthGuard (see AdminJwtAuthGuard's doc comment for
 * why that's correct, not an oversight). `login`/`refresh`/`logout` stay
 * unguarded beyond that — they're what ISSUE admin credentials, so they
 * can't themselves require a pre-existing admin session. `me` is the one
 * protected route, guarded explicitly by `AdminJwtAuthGuard`.
 */
@ApiTags('admin-auth')
@Public()
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Throttle({ default: { limit: 10, ttl: 600_000 } }) // 10 attempts / 10 min / IP — see docs/admin-architecture-decision-record.md §12.5
  @Post('login')
  login(@Body() dto: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(
      dto.email,
      dto.password,
      sessionMeta(req),
    );
  }

  @Post('refresh')
  refresh(@Body() dto: AdminRefreshTokenDto, @Req() req: Request) {
    return this.adminAuthService.refresh(dto.refreshToken, sessionMeta(req));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: AdminRefreshTokenDto): Promise<void> {
    return this.adminAuthService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  me(@CurrentAdminUser() admin: AuthenticatedAdminUser) {
    return this.adminAuthService.getProfile(admin.adminUserId);
  }
}
