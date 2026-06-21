import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SERVICE_KEY = 'requiredService';

export const RequireService = (serviceKey: string) => SetMetadata(REQUIRED_SERVICE_KEY, serviceKey);
