import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types';

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: LoginBody, @Req() request: Request) {
    return this.auth.login(body.email, body.password, this.getRequestMeta(request));
  }

  @Post('refresh')
  refresh(@Body() body: RefreshBody, @Req() request: Request) {
    return this.auth.refresh(body.refreshToken, this.getRequestMeta(request));
  }

  @Post('logout')
  logout(@Body() body: Partial<RefreshBody>, @Headers('authorization') authorization?: string) {
    return this.auth.logout(body.refreshToken, authorization);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: { currentPassword?: string; nextPassword?: string }) {
    return this.auth.changePassword(user, body.currentPassword, body.nextPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.sessions(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke')
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Body() body: { sessionId?: string }) {
    return this.auth.revokeSession(user, body.sessionId ?? '');
  }

  @Post('password-reset/request')
  requestReset(@Body() body: { email?: string }) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  confirmReset(@Body() body: { token?: string; nextPassword?: string }) {
    return this.auth.confirmPasswordReset(body.token, body.nextPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupTwoFactor(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() body: { code?: string }) {
    return this.auth.enableTwoFactor(user, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() body: { password?: string }) {
    return this.auth.disableTwoFactor(user, body.password);
  }

  @Post('2fa/verify')
  verifyTwoFactor(@Body() body: { userId?: string; code?: string }, @Req() request: Request) {
    return this.auth.verifyTwoFactor(body.userId ?? '', body.code, this.getRequestMeta(request));
  }

  @Post('register')
  register(@Body() body: { name?: string; email?: string; password?: string }, @Req() request: Request) {
    return this.auth.register(body.name, body.email, body.password, this.getRequestMeta(request));
  }

  private getRequestMeta(request: Request) {
    return {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    };
  }
}
