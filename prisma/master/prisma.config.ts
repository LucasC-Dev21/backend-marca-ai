import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: '../../prisma/master/schema.master.prisma',
  migrations: {
    path: '../../prisma/master/migrations',
  },
  datasource: {
    url: env('MASTER_DATABASE_URL'),
  },
});
