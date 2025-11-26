import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './schema.tenant.prisma',
  migrations: {
    path: './migrations',
  },
  datasource: {
    url: env('TENANT_DATABASE_URL'),
  },
});
