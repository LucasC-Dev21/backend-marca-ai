// src/mail/mail.module.ts
import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import smtpConfig from 'src/config/smtp.config';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(smtpConfig),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('smtp.smtp_host'),
          port: Number(configService.get<string>('smtp.smtp_port')),
          secure: true,
          auth: {
            user: configService.get<string>('smtp.smtp_user'),
            pass: configService.get<string>('smtp.smtp_pass'),
          },
        },
        defaults: {
          from: configService.get<string>('smtp.smtp_from'),
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
