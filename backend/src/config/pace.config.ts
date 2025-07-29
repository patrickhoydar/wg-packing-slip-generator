import { registerAs } from '@nestjs/config';

export interface PaceConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export default registerAs(
  'pace',
  (): PaceConfig => ({
    baseUrl:
      process.env.PACE_BASE_URL ||
      'https://pacestaging.wallacegraphics.com/rpc/rest/services',
    username: process.env.PACE_USERNAME || 'API',
    password: process.env.PACE_PASSWORD || '',
  }),
);
