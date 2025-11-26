import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './schema.master.prisma',
  migrations: {
    path: './migrations',
  },
  datasource: {
    url: env('MASTER_DATABASE_URL'),
  },
});
