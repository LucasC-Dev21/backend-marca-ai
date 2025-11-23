import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: '../../prisma/tenant/schema.tenant.prisma',
  migrations: {
    path: '../../prisma/tenant/migrations',
  },
  datasource: {
    url: env('TENANT_DATABASE_URL'),
  },
});
