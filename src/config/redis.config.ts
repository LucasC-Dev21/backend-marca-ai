import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  redis_host: process.env.REDIS_HOST,
  redis_port: Number(process.env.REDIS_PORT) || 6379,
}));
