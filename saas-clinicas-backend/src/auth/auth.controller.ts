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
import { AuthCookiesService } from './auth-cookies.service.js';
import type { AuthUser, UserProfile } from './auth-user.js';
import { TENANT_COOKIES } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { AllowDuringDeletion } from './decorators/allow-during-deletion.decorator.js';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserProfile }> {
    const session = await this.authService.login(dto.email, dto.password);
    this.cookies.set(res, TENANT_COOKIES, session);
    return { user: session.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserProfile }> {
    try {
      const session = await this.authService.refresh(
        this.cookies.read(req, TENANT_COOKIES.refresh.name),
      );
      this.cookies.set(res, TENANT_COOKIES, session);
      return { user: session.user };
    } catch (error) {
      this.cookies.clear(res, TENANT_COOKIES);
      throw error;
    }
  }

  /** Público para permitir sair mesmo com o access token expirado. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(
      this.cookies.read(req, TENANT_COOKIES.refresh.name),
    );
    this.cookies.clear(res, TENANT_COOKIES);
  }

  @AllowPendingPasswordChange()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.authService.getProfile(user.userId, user.tenantId);
  }

  @AllowPendingPasswordChange()
  @AllowDuringDeletion()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserProfile }> {
    const session = await this.authService.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
    this.cookies.set(res, TENANT_COOKIES, session);
    return { user: session.user };
  }
}
