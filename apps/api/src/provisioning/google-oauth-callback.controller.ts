import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProvisioningService } from './provisioning.service';

@Controller('provisioning/providers/google')
export class GoogleOAuthCallbackController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = process.env.CORS_ORIGINS?.split(',')[0] || 'http://localhost:5173';
    try {
      await this.provisioning.handleGoogleOAuthCallback(code, state);
      res.redirect(`${frontendUrl}/cold-email/setup?oauth=success`);
    } catch {
      res.redirect(`${frontendUrl}/cold-email/setup?oauth=error`);
    }
  }
}
