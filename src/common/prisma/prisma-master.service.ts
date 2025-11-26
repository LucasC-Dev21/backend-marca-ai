import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'db/prisma/clients/master/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaMasterService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Cria pool de conexão PostgreSQL
    const pool = new Pool({
      connectionString: process.env.MASTER_DATABASE_URL,
    });

    // Adapter obrigatório para Prisma 7
    const adapter = new PrismaPg(pool);

    // Passa o adapter para o PrismaClient
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
