import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getHealth() {
    const services: Record<string, string> = {};
    let overall: 'ok' | 'degraded' | 'down' = 'ok';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = 'ok';
    } catch {
      services.database = 'down';
      overall = 'down';
    }

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

    const statusCode = overall === 'down' ? 503 : 200;
    return {
      status: overall,
      statusCode,
      service: 'nexushq-api',
      environment: this.config.getOrThrow<string>('NODE_ENV'),
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
