import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProposalsService } from './proposals.service';
import { ProposalPdfService } from './proposal-pdf.service';

@Controller('proposals/public')
export class ProposalPublicController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly pdf: ProposalPdfService,
  ) {}

  @Get('track/:token')
  async track(@Param('token') token: string) {
    return this.proposals.trackView(token, {});
  }

  @Post('accept/:token')
  async accept(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.proposals.acceptByToken(token, body.signatureData as Record<string, unknown> | undefined);
  }

  @Post('reject/:token')
  async reject(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.proposals.rejectByToken(token, body.reason as string | undefined);
  }

  @Post('sign/:token')
  async sign(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.proposals.acceptByToken(token, body.signatureData as Record<string, unknown>);
  }

  @Get('download/:token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const proposal = await this.proposals.getByToken(token);
    const filePath = this.pdf.getFilePath(proposal.id);
    if (!filePath) return res.status(404).json({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'PDF not available' } });
    res.sendFile(filePath);
  }
}
