// prisma.service.ts
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaClient } from '../../../db/prisma/clients/tenant/client';
import databaseConfig from '../../config/database.config';
import {
  cnpjNomeBd,
  formatarNomeBanco,
  gerarStringConection,
} from 'src/shared/utils/auth.utils';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class PrismaTenantService implements OnApplicationShutdown {
  private clients = new Map<string, PrismaClient>();

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly databaseService: ConfigType<typeof databaseConfig>,
  ) {}

  /**
   * Cria ou retorna um PrismaClient cacheado para um tenant específico.
   *
   * @param cnpj - CNPJ do tenant.
   * @param baseinfo - Informações adicionais para definir o banco do tenant.
   * @returns PrismaClient conectado pronto para uso (pool gerenciado automaticamente).
   */
  getClient(cnpj: string, baseinfo: string): PrismaClient {
    const dbName = formatarNomeBanco(
      cnpjNomeBd(cnpj),
      baseinfo,
      this.databaseService.token_tenant_name_database,
    );

    if (this.clients.has(dbName)) {
      return this.clients.get(dbName)!;
    }

    const stringConexaoBanco = gerarStringConection(
      dbName,
      this.databaseService.tenant_database_url!,
    );

    // cria pool do Postgres para esse banco
    const pool = new Pool({
      connectionString: stringConexaoBanco,
    });

    const adapter = new PrismaPg(pool);

    const client = new PrismaClient({
      adapter,
    });

    this.clients.set(dbName, client);
    return client;
  }

  /**
   * Executa as migrations do Prisma para o banco de um tenant específico.
   *
   * @param stringConexaoBanco - String de conexão com o banco Postgres do tenant.
   * @returns string - Saída do comando de migration.
   *
   * Lança `InternalServerErrorException` se ocorrer algum erro durante a execução.
   */
  async migrarSchemaPrisma(stringConexaoBanco: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        'npx prisma migrate deploy --schema=prisma/tenant/schema.tenant.prisma --config=./prisma/tenant/prisma.config.ts',
        {
          env: {
            TENANT_DATABASE_URL: stringConexaoBanco,
          },
        },
      );

      return stdout;
    } catch (error: any) {
      console.log(error);
      void error;
      throw new InternalServerErrorException(
        `Erro ao preparar o ambiente do usuário.`,
      );
    }
  }

  /**
   * Cria um novo banco de dados para um tenant.
   *
   * @param nomeBanco - Nome do banco de dados a ser criado.
   * @returns Promise<void>
   *
   * Lança `InternalServerErrorException` se ocorrer algum erro durante a criação.
   * Garante que a conexão temporária seja encerrada ao final.
   */
  async criarNovoBanco(nomeBanco: string): Promise<void> {
    const tempPool = new Pool({
      connectionString: this.databaseService.tenant_database_url,
    });

    try {
      await tempPool.query(`CREATE DATABASE "${nomeBanco}"`);
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException(
        'Erro ao preparar o ambiente do usuário',
      );
    } finally {
      await tempPool.end();
    }
  }

  /**
   * Deleta um banco de dados de um tenant.
   *
   * Antes de deletar, encerra todas as conexões ativas com o banco.
   *
   * @param nomeBanco - Nome do banco de dados a ser removido.
   * @returns Promise<void>
   *
   * Lança `InternalServerErrorException` se ocorrer algum erro durante a exclusão.
   * Garante que a conexão temporária seja encerrada ao final.
   */
  async deletarBanco(nomeBanco: string): Promise<void> {
    const tempPool = new Pool({
      connectionString: this.databaseService.tenant_database_url,
    });

    try {
      await tempPool.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
      `,
        [nomeBanco],
      );

      await tempPool.query(`DROP DATABASE IF EXISTS "${nomeBanco}"`);
    } catch (error) {
      console.log(error);
      void error;
      throw new InternalServerErrorException(
        `Erro ao preparar o ambiente do usuário`,
      );
    } finally {
      await tempPool.end();
    }
  }

  async onApplicationShutdown() {
    for (const [dbName, client] of this.clients.entries()) {
      await client.$disconnect();
      this.clients.delete(dbName);
    }
  }
}
