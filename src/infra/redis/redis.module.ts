import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import redisConfig from 'src/config/redis.config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('redis.redis_host');
        const port = configService.get<number>('redis.redis_port');

        const client = new Redis({ host, port });

        client.on('connect', () =>
          console.log(`✅ Redis conectado em ${host}:${port}`),
        );
        client.on('error', (err) => console.error('❌ Redis erro:', err));

        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
