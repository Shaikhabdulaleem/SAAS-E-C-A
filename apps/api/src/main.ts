import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { csrfMiddleware, helmetMiddleware, rateLimitMiddleware, requestLoggingMiddleware } from './common/security.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const origins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim());

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.use(helmetMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(rateLimitMiddleware);
  app.use(csrfMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useStaticAssets(path.resolve(process.cwd(), '..', '..', 'uploads'), { prefix: '/uploads/' });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port, process.env.HOST ?? '::');
}

void bootstrap();
