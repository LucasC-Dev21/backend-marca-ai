import { Test, TestingModule } from '@nestjs/testing';
import { PrismaMasterService } from './prisma-master.service';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Mock do módulo 'pg'
jest.mock('pg', () => {
  const PoolMock = jest.fn().mockImplementation(() => ({
    end: jest.fn(),
  }));

  return {
    Pool: PoolMock,
  };
});

// Mock do módulo '@prisma/adapter-pg'
jest.mock('@prisma/adapter-pg', () => {
  const PrismaPgMock = jest.fn().mockImplementation((_pool: any) => ({
    provider: 'postgres',
    adapterName: 'pg',
  }));

  return {
    PrismaPg: PrismaPgMock,
  };
});

describe('PrismaMasterService (TDD)', () => {
  let service: PrismaMasterService;

  const PoolMock = Pool as unknown as jest.Mock;
  const PrismaPgMock = PrismaPg as unknown as jest.Mock;

  beforeEach(async () => {
    // LIMPA ANTES de instanciar o service
    jest.clearAllMocks();

    process.env.MASTER_DATABASE_URL =
      'postgres://user:pass@localhost:5432/master_db_test';

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaMasterService],
    }).compile();

    service = module.get<PrismaMasterService>(PrismaMasterService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  it('deve criar um Pool com a MASTER_DATABASE_URL ao ser instanciado', () => {
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(PoolMock).toHaveBeenCalledWith({
      connectionString: process.env.MASTER_DATABASE_URL,
    });
  });

  it('deve criar um PrismaPg usando o Pool criado', () => {
    expect(PrismaPgMock).toHaveBeenCalledTimes(1);

    const poolInstance = PoolMock.mock.results[0].value;
    const adapterArgs = PrismaPgMock.mock.calls[0];
    const poolPassadoParaAdapter = adapterArgs[0];

    expect(poolPassadoParaAdapter).toBe(poolInstance);
  });

  it('onModuleInit deve chamar $connect do PrismaClient', async () => {
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined as any);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy deve chamar $disconnect do PrismaClient', async () => {
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined as any);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('deve implementar as interfaces OnModuleInit e OnModuleDestroy', () => {
    expect(typeof service.onModuleInit).toBe('function');
    expect(typeof service.onModuleDestroy).toBe('function');
  });
});
