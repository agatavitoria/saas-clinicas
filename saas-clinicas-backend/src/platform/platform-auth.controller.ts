import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthCookiesService } from '../auth/auth-cookies.service.js';
import type {
  AuthPlatformAdmin,
  PlatformAdminProfile,
} from '../auth/auth-user.js';
import { PLATFORM_COOKIES } from '../auth/auth.constants.js';
import { CurrentPlatformAdmin } from '../auth/decorators/current-platform-admin.decorator.js';
import { PlatformRoute } from '../auth/decorators/platform-route.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PlatformLoginDto } from './dto/platform-login.dto.js';
import { PlatformAuthService } from './platform-auth.service.js';

@PlatformRoute()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly authService: PlatformAuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: PlatformLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ admin: PlatformAdminProfile }> {
    const session = await this.authService.login(dto.email, dto.password);
    this.cookies.set(res, PLATFORM_COOKIES, session);
    return { admin: session.admin };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ admin: PlatformAdminProfile }> {
    try {
      const session = await this.authService.refresh(
        this.cookies.read(req, PLATFORM_COOKIES.refresh.name),
      );
      this.cookies.set(res, PLATFORM_COOKIES, session);
      return { admin: session.admin };
    } catch (error) {
      this.cookies.clear(res, PLATFORM_COOKIES);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      this.cookies.read(req, PLATFORM_COOKIES.refresh.name),
    );
    this.cookies.clear(res, PLATFORM_COOKIES);
  }

  @Get('me')
  me(
    @CurrentPlatformAdmin() admin: AuthPlatformAdmin,
  ): Promise<PlatformAdminProfile> {
    return this.authService.getProfile(admin.adminId);
  }
}
