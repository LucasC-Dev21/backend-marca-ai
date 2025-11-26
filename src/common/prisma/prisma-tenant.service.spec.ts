// src/common/prisma/prisma-tenant.service.spec.ts
import { PrismaTenantService } from './prisma-tenant.service';
import type { PrismaClient } from '../../../db/prisma/clients/tenant/client';
import type databaseConfig from 'src/config/database.config';
import type { ConfigType } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as PrismaClientCtor } from '../../../db/prisma/clients/tenant/client';

/* =========================
 * Mocks globais
 * ========================= */

// Vamos interceptar o execAsync criado com util.promisify(exec)
let execMock: jest.Mock;

// mock de util.promisify para devolver uma função que delega para execMock
jest.mock('util', () => ({
  promisify:
    () =>
    (...args: any[]) =>
      execMock(...args),
}));

jest.mock('pg', () => {
  const PoolMock = jest.fn();
  return { Pool: PoolMock };
});

jest.mock('@prisma/adapter-pg', () => {
  const PrismaPgMock = jest.fn();
  return { PrismaPg: PrismaPgMock };
});

jest.mock('../../../db/prisma/clients/tenant/client', () => {
  const PrismaClientMock = jest.fn(() => ({
    $disconnect: jest.fn(),
  }));
  return { PrismaClient: PrismaClientMock };
});

describe('PrismaTenantService', () => {
  let service: PrismaTenantService;
  let mockConfig: ConfigType<typeof databaseConfig> | any;

  beforeEach(() => {
    execMock = jest.fn(); // zera o mock a cada teste

    mockConfig = {
      token_tenant_name_database: 'TOKEN_TENANT',
      tenant_database_url: 'postgres://user:pass@host:5432/master',
    } as any;

    service = new PrismaTenantService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /* ====================================
   * onApplicationShutdown
   * ==================================== */

  it('deve desconectar todos os clientes e limpar o mapa ao desligar a aplicação', async () => {
    const client1 = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaClient;

    const client2 = {
      $disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaClient;

    const clientsMap = (service as any).clients as Map<string, PrismaClient>;
    clientsMap.set('db_tenant_1', client1);
    clientsMap.set('db_tenant_2', client2);

    await service.onApplicationShutdown();

    expect(client1.$disconnect).toHaveBeenCalledTimes(1);
    expect(client2.$disconnect).toHaveBeenCalledTimes(1);
    expect(clientsMap.size).toBe(0);
  });

  it('não deve quebrar se não houver nenhum client no mapa ao desligar', async () => {
    const clientsMap = (service as any).clients as Map<string, PrismaClient>;
    expect(clientsMap.size).toBe(0);

    await expect(service.onApplicationShutdown()).resolves.not.toThrow();
  });

  /* ====================================
   * getClient
   * ==================================== */

  describe('getClient', () => {
    const mockCnpj = '12345678000199';
    const mockBaseInfo = 'BASE_INFO';

    beforeEach(() => {
      // Mocks básicos do Pool e PrismaPg
      (Pool as unknown as jest.Mock).mockReturnValue({} as any);
      (PrismaPg as unknown as jest.Mock).mockReturnValue({} as any);
    });

    it('deve criar um novo PrismaClient quando ainda não existir no cache', () => {
      const clientsMap = (service as any).clients as Map<string, PrismaClient>;
      expect(clientsMap.size).toBe(0);

      const client = service.getClient(mockCnpj, mockBaseInfo);

      const PrismaClientMock = PrismaClientCtor as unknown as jest.Mock;
      expect(PrismaClientMock).toHaveBeenCalledTimes(1);

      expect(Pool as unknown as jest.Mock).toHaveBeenCalledTimes(1);
      expect(PrismaPg as unknown as jest.Mock).toHaveBeenCalledTimes(1);

      const prismaCallArgs = PrismaClientMock.mock.calls[0][0];
      expect(prismaCallArgs).toHaveProperty('adapter');

      expect(clientsMap.size).toBe(1);
      const storedClient = Array.from(clientsMap.values())[0];
      expect(storedClient).toBe(client);
    });

    it('deve reutilizar o PrismaClient do cache quando já existir', () => {
      const PrismaClientMock = PrismaClientCtor as unknown as jest.Mock;

      const firstClient = service.getClient(mockCnpj, mockBaseInfo);
      const secondClient = service.getClient(mockCnpj, mockBaseInfo);

      expect(PrismaClientMock).toHaveBeenCalledTimes(1);
      expect(firstClient).toBe(secondClient);

      expect((Pool as unknown as jest.Mock).mock.calls.length).toBe(1);
      expect((PrismaPg as unknown as jest.Mock).mock.calls.length).toBe(1);

      const clientsMap = (service as any).clients as Map<string, PrismaClient>;
      expect(clientsMap.size).toBe(1);
    });
  });

  /* ====================================
   * migrarSchemaPrisma
   * ==================================== */

  describe('migrarSchemaPrisma', () => {
    const connectionString = 'postgres://user:pass@host:5432/tenant_db';
    const expectedCommand =
      'npx prisma migrate deploy --schema=prisma/tenant/schema.tenant.prisma --config=./prisma/tenant/prisma.config.ts';

    it('deve executar o comando de migrate e retornar o stdout em caso de sucesso', async () => {
      const fakeStdout = 'Migration applied successfully';
      execMock.mockResolvedValueOnce({ stdout: fakeStdout });

      const result = await service.migrarSchemaPrisma(connectionString);

      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith(expectedCommand, {
        env: {
          TENANT_DATABASE_URL: connectionString,
        },
      });
      expect(result).toBe(fakeStdout);
    });

    it('deve lançar InternalServerErrorException se o comando falhar', async () => {
      execMock.mockRejectedValueOnce(new Error('some error'));

      await expect(
        service.migrarSchemaPrisma(connectionString),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  /* ====================================
   * criarNovoBanco
   * ==================================== */

  describe('criarNovoBanco', () => {
    const dbName = 'tenant_db_name';

    it('deve criar o banco e fechar a conexão em caso de sucesso', async () => {
      const poolInstance = {
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
      };

      const PoolMock = Pool as unknown as jest.Mock;
      PoolMock.mockReturnValueOnce(poolInstance);

      await service.criarNovoBanco(dbName);

      expect(PoolMock).toHaveBeenCalledTimes(1);
      expect(PoolMock).toHaveBeenCalledWith({
        connectionString: mockConfig.tenant_database_url,
      });

      expect(poolInstance.query).toHaveBeenCalledTimes(1);
      expect(poolInstance.query).toHaveBeenCalledWith(
        `CREATE DATABASE "${dbName}"`,
      );

      expect(poolInstance.end).toHaveBeenCalledTimes(1);
    });

    it('deve lançar InternalServerErrorException se a criação do banco falhar e ainda assim encerrar o pool', async () => {
      const poolInstance = {
        query: jest.fn().mockRejectedValue(new Error('create db error')),
        end: jest.fn().mockResolvedValue(undefined),
      };

      const PoolMock = Pool as unknown as jest.Mock;
      PoolMock.mockReturnValueOnce(poolInstance);

      await expect(service.criarNovoBanco(dbName)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      expect(poolInstance.query).toHaveBeenCalledTimes(1);
      expect(poolInstance.end).toHaveBeenCalledTimes(1);
    });
  });

  /* ====================================
   * deletarBanco
   * ==================================== */

  describe('deletarBanco', () => {
    const dbName = 'tenant_db_name';

    it('deve encerrar conexões, dropar o banco e fechar o pool em caso de sucesso', async () => {
      const poolInstance = {
        query: jest.fn().mockResolvedValue(undefined),
        end: jest.fn().mockResolvedValue(undefined),
      };

      const PoolMock = Pool as unknown as jest.Mock;
      PoolMock.mockReturnValueOnce(poolInstance);

      await service.deletarBanco(dbName);

      // Criou pool com a connection string base
      expect(PoolMock).toHaveBeenCalledTimes(1);
      expect(PoolMock).toHaveBeenCalledWith({
        connectionString: mockConfig.tenant_database_url,
      });

      // 1ª query: pg_terminate_backend no banco alvo
      expect(poolInstance.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('pg_terminate_backend'),
        [dbName],
      );

      // 2ª query: DROP DATABASE IF EXISTS "nomeBanco"
      expect(poolInstance.query).toHaveBeenNthCalledWith(
        2,
        `DROP DATABASE IF EXISTS "${dbName}"`,
      );

      // Sempre encerra o pool
      expect(poolInstance.end).toHaveBeenCalledTimes(1);
    });

    it('deve lançar InternalServerErrorException se algum passo falhar e ainda assim encerrar o pool', async () => {
      const poolInstance = {
        query: jest.fn().mockRejectedValue(new Error('drop error')),
        end: jest.fn().mockResolvedValue(undefined),
      };

      const PoolMock = Pool as unknown as jest.Mock;
      PoolMock.mockReturnValueOnce(poolInstance);

      await expect(service.deletarBanco(dbName)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );

      // Pelo menos uma query foi chamada
      expect(poolInstance.query).toHaveBeenCalledTimes(1);

      // E o pool foi encerrado no finally
      expect(poolInstance.end).toHaveBeenCalledTimes(1);
    });
  });
});
