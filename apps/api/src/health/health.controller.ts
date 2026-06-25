import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getHealth(@Res() res: Response) {
    const services: Record<string, string> = {};
    let overall: 'ok' | 'degraded' | 'down' = 'ok';

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = 'ok';
    } catch {
      services.database = 'down';
      overall = 'down';
    }

    // Redis check
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const IORedis = (await import('ioredis')).default;
        const client = new IORedis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
        await client.connect();
        await client.ping();
        services.redis = 'ok';
        await client.quit();
      } catch {
        services.redis = 'down';
        if (overall === 'ok') overall = 'degraded';
      }
    } else {
      services.redis = 'not_configured';
      if (overall === 'ok') overall = 'degraded';
    }

    // SendGrid check (lightweight — just check env var exists)
    services.email = process.env.SENDGRID_API_KEY ? 'configured' : 'not_configured';

    // Disk / uploads check
    try {
      const fs = await import('fs/promises');
      await fs.access(process.cwd());
      services.filesystem = 'ok';
    } catch {
      services.filesystem = 'down';
      if (overall === 'ok') overall = 'degraded';
    }

    const statusCode = overall === 'down' ? 503 : 200;
    const uptime = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);

    res.status(statusCode).json({
      status: overall,
      statusCode,
      service: 'nexushq-api',
      version: process.env.APP_VERSION ?? '1.0.0',
      environment: this.config.getOrThrow<string>('NODE_ENV'),
      uptime,
      services,
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ ready: true });
    } catch {
      res.status(503).json({ ready: false, reason: 'database unavailable' });
    }
  }

  @Get('live')
  liveness(@Res() res: Response) {
    res.status(200).json({ alive: true, uptime: Math.floor((Date.now() - this.startedAt.getTime()) / 1000) });
  }
}
