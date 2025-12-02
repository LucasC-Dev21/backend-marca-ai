jest.mock('src/shared/utils/auth.utils', () => ({
  compare: jest.fn(() => Promise.resolve(true)),
}));

import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { REDIS_SESSION_COOKIE } from 'src/shared/constants/auth.constants';
import { PrismaMasterService } from 'src/common/prisma/prisma-master.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from 'src/config/jwt.config';
import cookiesConfig from 'src/config/cookies.config';

// ------------------------------
// MOCK: Prisma Master
// ------------------------------
class MockPrismaMaster {
  tenants = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  sessoes = {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  $transaction = jest.fn(async (cb) => {
    const tx = {
      tenants: this.tenants,
      sessoes: this.sessoes,
    };
    return await cb(tx);
  });
}

// ------------------------------
// MOCK: Redis
// ------------------------------
class MockRedis {
  get = jest.fn();
  set = jest.fn();
  update = jest.fn();
  del = jest.fn();
}

// ------------------------------
// MOCK: JWT Service
// ------------------------------
class MockJwt {
  signAsync = jest.fn();
  decode = jest.fn();
  verify = jest.fn();
}

// ------------------------------
// MOCK CONFIG
// ------------------------------
const mockJwtConfig = {
  secret: 'abc',
  issuer: 'issuer-x',
  audience: 'aud-x',
  jwtTtl: '1h',
};
(mockJwtConfig as any).KEY = jwtConfig.KEY;

const mockCookiesConfig = {
  cookie_http_only: true,
  cookie_secure: false,
  cookie_same_site: 'lax',
  cookie_path: '/',
  cookie_domain: undefined,
};
(mockCookiesConfig as any).KEY = cookiesConfig.KEY;

describe('AuthService', () => {
  let service: AuthService;
  let prismaMaster: MockPrismaMaster;
  let redis: MockRedis;
  let jwt: MockJwt;

  let req: any;
  let res: any;

  beforeEach(async () => {
    prismaMaster = new MockPrismaMaster();
    redis = new MockRedis();
    jwt = new MockJwt();

    req = { cookies: {} };
    res = { clearCookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaMasterService, useValue: prismaMaster },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwt },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
        { provide: cookiesConfig.KEY, useValue: mockCookiesConfig },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // -------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------
  describe('login', () => {
    it('lança erro se usuário não existe', async () => {
      prismaMaster.tenants.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ login: 'a', senha: 'b' }, '1.1.1.1', 'agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança erro se senha inválida', async () => {
      const { compare } = require('src/shared/utils/auth.utils');
      compare.mockResolvedValueOnce(false);

      prismaMaster.tenants.findFirst.mockResolvedValue({
        senha: 'hash',
      });

      await expect(
        service.login({ login: 'a', senha: 'errada' }, '1.1.1.1', 'agent'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('retorna cookie se login for válido', async () => {
      prismaMaster.tenants.findFirst.mockResolvedValue({
        tenantId: 1,
        senha: 'hash',
        cnpj: '11',
        nomeEmpresa: 'Empresa X',
        dbName: 'cli_teste_01',
        email: 'a@b.com',
      });

      prismaMaster.sessoes.create.mockResolvedValue({
        id: 'mock-session-id',
      });

      jwt.signAsync.mockResolvedValue('token123');
      jwt.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      redis.set.mockResolvedValue(true);

      const result = await service.login(
        { login: 'x', senha: '123' },
        '1.1.1.1',
        'agent',
      );

      expect(result.cookies).toBeDefined();
      expect(prismaMaster.sessoes.create).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------
  // REFRESH TOKEN
  // -------------------------------------------------------------
  describe('verificarUsuarioLogado', () => {
    it.skip('regenera token com refreshToken válido', async () => {
      req.cookies[REDIS_SESSION_COOKIE] = 'sess1';

      redis.get.mockResolvedValue({
        tenantId: 1,
        userId: 1,
        cnpj: '999',
        baseinfo: 'x_01',
        accessToken: null,
        refreshToken: 'refresh123',
        ip: '1.1.1.1',
        userAgent: 'agent',
      });

      jwt.verify.mockImplementationOnce(() => {
        throw new Error('expired');
      });

      jwt.verify.mockImplementationOnce(() => ({
        sub: 1,
        cnpj: '999',
      }));

      prismaMaster.sessoes.findFirst.mockResolvedValue({
        refreshToken: 'refresh123',
        tenantId: 1,
        ativo: true,
        tenant: {
          tenantId: 1,
          nomeEmpresa: 'Empresa X',
          email: 'mail',
          ativo: true,
          dbName: 'cli_x_01',
        },
      });

      prismaMaster.tenants.findUnique.mockResolvedValue({
        ativo: true,
      });

      jwt.signAsync.mockResolvedValue('novoTokenXYZ');
      jwt.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 99999,
      });

      prismaMaster.sessoes.update.mockResolvedValue({
        id: 'sess1',
        refreshToken: 'refresh123',
        token: 'novoTokenXYZ',
      });

      redis.update.mockResolvedValue(true);

      const result = await service.verificarUsuarioLogado(req, res);

      expect(result.auth).toBe(true);
      expect(prismaMaster.sessoes.update).toHaveBeenCalled();
      expect(redis.update).toHaveBeenCalled();
    });
  });
});
