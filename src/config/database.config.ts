import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  master_database_url: process.env.MASTER_DATABASE_URL,
  tenant_database_url: process.env.TENANT_DATABASE_URL,
  token_tenant_name_database: process.env.TOKEN_TENANT_NAME_DATABASE,
}));
