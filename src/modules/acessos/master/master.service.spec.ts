import { Test, TestingModule } from '@nestjs/testing';
import { MasterService } from './master.service';
import { PrismaMasterService } from 'src/common/prisma/prisma-master.service';
import { PrismaTenantService } from 'src/common/prisma/prisma-tenant.service';
import { MailService } from 'src/infra/mail/mail.service';
import { RedisService } from 'src/infra/redis/redis.service';
import databaseConfig from '../../../config/database.config';
import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock('src/shared/utils/auth.utils', () => ({
  cnpjNomeBd: jest.fn().mockReturnValue('cnpjinvertido'),
  enviarCodigoAcesso: jest.fn(),
  gerarCodigoAcessoEmail: jest.fn().mockReturnValue('999999'),
  gerarStringConection: jest.fn().mockReturnValue('connection-string'),
  hash: jest.fn().mockResolvedValue('senha-hash'),
}));

jest.mock('src/shared/utils/consultar-cnpj.utils', () => ({
  consultarCnpj: jest.fn().mockResolvedValue({ status: 'OK' }),
}));

const authUtils = require('src/shared/utils/auth.utils');
const consultarCnpj =
  require('src/shared/utils/consultar-cnpj.utils').consultarCnpj;

describe('Testes do MasterService', () => {
  let service: MasterService;
  let prismaMaster: any;
  let prismaTenant: any;
  let redis: any;
  let mailService: any;

  beforeEach(async () => {
    prismaMaster = {
      tenants: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      clientes_Redirect: {
        deleteMany: jest.fn(),
      },
    };

    prismaTenant = {
      criarNovoBanco: jest.fn(),
      migrarSchemaPrisma: jest.fn(),
      deletarBanco: jest.fn(),
    };

    redis = {
      set: jest.fn(),
      get: jest.fn(),
    };

    mailService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterService,
        { provide: PrismaMasterService, useValue: prismaMaster },
        { provide: PrismaTenantService, useValue: prismaTenant },
        { provide: MailService, useValue: mailService },
        { provide: RedisService, useValue: redis },
        {
          provide: databaseConfig.KEY,
          useValue: {
            tenant_database_url: 'db-url',
            token_tenant_name_database: 'tecnodash',
          },
        },
      ],
    }).compile();

    service = module.get(MasterService);

    prismaMaster.tenants.findFirst.mockResolvedValue(null);
    (consultarCnpj as jest.Mock).mockResolvedValue({ status: 'OK' });
  });

  afterEach(() => jest.restoreAllMocks());

  // =============================================
  //                   PRE CADASTRO
  // =============================================

  describe('preCadastro', () => {
    it('deve criar pré-cadastro, enviar email e registrar no Redis', async () => {
      const resposta = await service.preCadastro({
        nomeEmpresa: 'Empresa',
        email: 'empresa@teste.com',
        telefone: '(11) 99999-9999',
        cnpj: '11.111.111/1111-11',
        senha: '1234',
      });

      expect(resposta).toHaveProperty('cookies');
      expect(authUtils.enviarCodigoAcesso).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('deve lançar erro caso email ou CNPJ já existam', async () => {
      prismaMaster.tenants.findFirst.mockResolvedValue({ id: 1 });

      await expect(
        service.preCadastro({
          nomeEmpresa: 'Empresa',
          email: 'empresa@teste.com',
          telefone: '(11) 99999-9999',
          cnpj: '11.111.111/1111-11',
          senha: '1234',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve lançar erro caso o CNPJ seja inválido', async () => {
      (consultarCnpj as jest.Mock).mockResolvedValue({ status: 'ERROR' });

      await expect(
        service.preCadastro({
          nomeEmpresa: 'Empresa',
          email: 'empresa@teste.com',
          telefone: '(11) 99999-9999',
          cnpj: '11.111.111/1111-11',
          senha: '1234',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =============================================
  //             FINALIZAR CADASTRO
  // =============================================

  describe('finalizarCadastro', () => {
    it('deve finalizar o cadastro com sucesso (fluxo completo)', (done) => {
      redis.get.mockResolvedValue({
        nomeEmpresa: 'Empresa',
        email: 'empresa@teste.com',
        telefone: '11999999999',
        cnpj: '11111111111111',
        senha: '1234',
        codigoAcessoEmail: '999999',
      });

      prismaMaster.tenants.findFirst.mockResolvedValue(null);
      prismaTenant.criarNovoBanco.mockResolvedValue(undefined);
      prismaTenant.migrarSchemaPrisma.mockResolvedValue(undefined);

      prismaMaster.tenants.create.mockResolvedValue({
        tenantId: 'tenant-1',
        clientes_redirect: [{ userId: 10 }],
      });

      let agora = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => (agora += 2000));

      const req = {
        cookies: {
          REDIS_VERIFICAR_EMAIL_COOKIE: 'token123',
        },
      } as any;

      const obs = service.finalizarCadastro(req, '999999');
      const eventos: any[] = [];

      obs.subscribe({
        next: (e) => eventos.push(e),
        error: (err) => done(err),
        complete: () => {
          expect(eventos.length).toBeGreaterThan(0);
          expect(prismaTenant.criarNovoBanco).toHaveBeenCalled();
          expect(prismaTenant.migrarSchemaPrisma).toHaveBeenCalled();
          expect(prismaMaster.tenants.create).toHaveBeenCalled();
          done();
        },
      });
    });

    it('deve lançar erro quando o código de verificação estiver incorreto', (done) => {
      redis.get.mockResolvedValue({ codigoAcessoEmail: '111111' });

      const req = {
        cookies: { REDIS_VERIFICAR_EMAIL_COOKIE: 'token123' },
      } as any;
      const obs = service.finalizarCadastro(req, '999999');

      obs.subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(BadRequestException);
          done();
        },
      });
    });

    it('deve desfazer operações ao ocorrer erro no processo', (done) => {
      redis.get.mockResolvedValue({
        nomeEmpresa: 'Empresa',
        email: 'empresa@teste.com',
        telefone: '11999999999',
        cnpj: '11111111111111',
        senha: '1234',
        codigoAcessoEmail: '999999',
      });

      prismaMaster.tenants.findFirst.mockResolvedValue(null);

      prismaTenant.criarNovoBanco.mockResolvedValue(undefined);
      prismaTenant.migrarSchemaPrisma.mockRejectedValue(
        new Error('Falha no schema'),
      );

      const req = {
        cookies: {
          REDIS_VERIFICAR_EMAIL_COOKIE: 'token123',
        },
      } as any;

      const obs = service.finalizarCadastro(req, '999999');

      obs.subscribe({
        next: () => {},
        error: async () => {
          expect(prismaTenant.deletarBanco).toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
