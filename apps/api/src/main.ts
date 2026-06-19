import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim());

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}

void bootstrap();
