// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async enviarEmail(options: MailOptions) {
    const { to, subject, text, html, from } = options;

    await this.mailerService.sendMail({
      to,
      subject,
      text: text || 'Sem conteúdo de texto',
      html: html || `<p>Sem conteúdo HTML</p>`,
      from: from || 'NestJS App <no-reply@meuapp.com>',
    });
  }
}
