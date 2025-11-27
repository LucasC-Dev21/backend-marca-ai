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
import cookiesConfig from 'src/config/cookies.config';
import { AcessosModule } from 'src/modules/acessos/acessos.module';
import { RouterModule } from '@nestjs/core';
import { MailModule } from 'src/infra/mail/mail.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import jwtConfig from 'src/config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(__dirname, '..', '..', '.cookies.env'),
      ],
      load: [databaseConfig, redisConfig, smtpConfig, cookiesConfig, jwtConfig],
    }),
    PrismaModule,
    RedisModule,
    AcessosModule,
    MailModule,
    AuthModule,
    RouterModule.register([{ path: 'acessos', module: AcessosModule }]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
