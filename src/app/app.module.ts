import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from 'src/config/database.config';
import { join } from 'path';
import redisConfig from 'src/config/redis.config';
import { RedisModule } from 'src/infra/redis/redis.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import smtpConfig from 'src/config/smtp.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(__dirname, '..', '..', '.cookies.env'),
      ],
      load: [databaseConfig, redisConfig, smtpConfig],
    }),
    PrismaModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
