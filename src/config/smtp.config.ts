import { registerAs } from '@nestjs/config';

export default registerAs('smtp', () => ({
  smtp_host: process.env.SMTP_HOST,
  smtp_port: process.env.SMTP_PORT,
  smtp_user: process.env.SMTP_USER,
  smtp_pass: process.env.SMTP_PASS,
  smtp_from: process.env.SMTP_FROM || '"Minha App" <no-reply@minhaapp.com>',
}));
