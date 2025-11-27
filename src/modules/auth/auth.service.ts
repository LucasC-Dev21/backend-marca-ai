import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';

import jwtConfig from 'src/config/jwt.config';

import { PrismaMasterService } from 'src/common/prisma/prisma-master.service';

import { compare } from 'src/shared/utils/auth.utils';

import { REDIS_SESSION_COOKIE } from 'src/shared/constants/auth.constants';

import { RedisService } from 'src/infra/redis/redis.service';

import { PREFIXO_REDIS_SESSION_ID } from 'src/shared/constants/redis.constants';
import { Tenants } from 'db/prisma/clients/master/client';
import { LoginDto } from './dto/login.dto';
import {
  LoginResponse,
  VerificarUsuarioResponse,
} from 'src/shared/types/auth.types';
import { CookieOptions, Request, Response } from 'express';
import cookiesConfig from 'src/config/cookies.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaMaster: PrismaMasterService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    @Inject(cookiesConfig.KEY)
    private readonly cookiesConfiguration: ConfigType<typeof cookiesConfig>,
  ) {}

  async login(
    loginDto: LoginDto,
    ip: string,
    userAgent: string,
  ): Promise<LoginResponse> {
    const { login, senha } = loginDto;

    const usuario = await this.prismaMaster.tenants.findFirst({
      where: {
        email: login,
      },
    });

    if (!usuario)
      throw new UnauthorizedException('Usuário ou senha incorretos');

    const compararSenhas = await compare(senha, usuario.senha as string);

    if (!compararSenhas)
      throw new UnauthorizedException('Usuário ou senha incorretos');

    return await this.prismaMaster.$transaction(async (tx) => {
      const { token: accessToken, expires } = await this.gerarAccessToken(
        usuario,
        usuario.cnpj,
      );
      void expires;

      const { token: refreshToken, expires: expiresRefresh } =
        await this.gerarRefreshToken(usuario, usuario.cnpj);

      const sessao = await tx.sessoes.create({
        data: {
          token: accessToken,
          expiraEm: new Date(expiresRefresh),
          refreshToken: refreshToken,
          ativo: true,
          ip,
          userAgent,
          tenant: {
            connect: {
              tenantId: usuario.tenantId,
            },
          },
        },
      });

      const sessionId = sessao.id;

      await this.redisService.set(
        `${PREFIXO_REDIS_SESSION_ID}:${sessao.id}`,
        {
          tenantId: usuario.tenantId,
          userId: usuario.tenantId,
          cnpj: usuario.cnpj,
          baseinfo: usuario.dbName.split('_').slice(-2).join('_'),
          accessToken,
          refreshToken,
          ip,
          userAgent,
        },
        Math.floor(expiresRefresh / 1000),
      );

      return {
        cookies: {
          [REDIS_SESSION_COOKIE]: {
            token: sessionId,
            maxAge: expiresRefresh,
          },
        },
      };
    });
  }

  async logout(req: Request) {
    const sessId = req.cookies?.[REDIS_SESSION_COOKIE];

    if (!sessId) {
      return 'ok';
    }

    try {
      const result = await this.prismaMaster.$transaction(async (tx: any) => {
        await tx.sessoes.updateMany({
          where: {
            id: sessId,
          },
          data: {
            ativo: false,
            encerradoEm: new Date(),
            revogadoPor: 'Derrubado pelo usuário ao deslogar',
          },
        });

        await this.redisService.delete(`${PREFIXO_REDIS_SESSION_ID}:${sessId}`);

        return 'ok';
      });

      return result;
    } catch (error) {
      void error;
      return 'ok';
    }
  }

  async verificarUsuarioLogado(
    req: Request,
    res: Response,
  ): Promise<VerificarUsuarioResponse> {
    const sessId: string = req.cookies?.[REDIS_SESSION_COOKIE];

    if (!sessId) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const payload_redis = await this.redisService.get(
      `${PREFIXO_REDIS_SESSION_ID}:${sessId}`,
    );

    if (!payload_redis) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    if (payload_redis.accessToken) {
      try {
        const payload = this.jwtService.verify(
          payload_redis.accessToken as string,
        );

        const retorno = {
          auth: true,
          user: {
            id: payload.sub,
            nomeEmpresa: payload.nomeEmpresa,
            email: payload.email,
          },
        };

        return retorno;
      } catch {
        // (noop)
        // oi
      }
    }

    const refreshCookie = payload_redis.refreshToken;
    if (!refreshCookie) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    try {
      const payload = this.jwtService.verify(refreshCookie as string);

      const usuarioId = payload.sub;
      const cnpj = payload.cnpj;

      const sessaoAtiva = await this.prismaMaster.sessoes.findFirst({
        where: {
          refreshToken: refreshCookie,
          tenantId: usuarioId,
          ativo: true,
        },
        include: {
          tenant: true,
        },
      });

      if (!sessaoAtiva || !sessaoAtiva.tenant) {
        throw new UnauthorizedException(
          'Sua sessão expirou. Por favor faça o login novamente',
        );
      }

      const tenant = await this.prismaMaster.tenants.findUnique({
        where: { tenantId: sessaoAtiva.tenant.tenantId },
        select: { ativo: true },
      });

      if (tenant && !tenant.ativo) {
        throw new UnauthorizedException(
          'Sua conta está suspensa. Entre em contato para mais informações',
        );
      }

      const { token: accessToken, expires } = await this.gerarAccessToken(
        sessaoAtiva.tenant,
        cnpj as string,
      );
      void expires;

      const result = await this.prismaMaster.$transaction(async (tx: any) => {
        await tx.sessoes.update({
          where: { refreshToken: refreshCookie },
          data: { token: accessToken },
        });

        await this.redisService.update(
          `${PREFIXO_REDIS_SESSION_ID}:${sessId}`,
          {
            ...payload_redis,
            accessToken: accessToken,
          },
        );

        return {
          auth: true,
          user: {
            id: sessaoAtiva.tenant.tenantId,
            nomeEmpresa: sessaoAtiva.tenant.nomeEmpresa,
            email: sessaoAtiva.tenant.email ?? undefined,
          },
        };
      });

      return result;
    } catch (error) {
      const cookieOptions: CookieOptions = {
        httpOnly: this.cookiesConfiguration.cookie_http_only,
        secure: this.cookiesConfiguration.cookie_secure,
        sameSite: this.cookiesConfiguration.cookie_same_site,
        path: this.cookiesConfiguration.cookie_path,
        ...(this.cookiesConfiguration.cookie_domain && {
          domain: this.cookiesConfiguration.cookie_domain,
        }),
      };

      res.clearCookie(REDIS_SESSION_COOKIE, cookieOptions);

      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }
  }

  /**
   * Retorna informações do tenant (dbName e CNPJ) a partir do login informado.
   * Pode buscar tanto pelo sufixo do e-mail (ex: "@empresa.com") quanto pelo e-mail do usuário.
   *
   * @param login - Valor informado no login (e-mail completo ou domínio/sufixo).
   * @returns Objeto contendo o dbName e o cnpj do cliente associado.
   */
  async obterDbNameCnpj(
    login: string,
  ): Promise<{ dbName: string; cnpj: string }> {
    const usuario = await this.prismaMaster.tenants.findUnique({
      where: { email: login },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }

    return { dbName: usuario.dbName, cnpj: usuario.cnpj };
  }

  /**
   * Gera e assina um JWT para o usuário informado, incluindo id, nome, email,
   * cargo, permissões, URL da foto, CNPJ e base de dados.
   *
   * O token é assinado com as configurações da aplicação (issuer, audience, secret, expiração)
   * e o retorno inclui o token e o timestamp absoluto de expiração em ms.
   *
   * @param usuario - dados do usuário
   * @param cnpj - CNPJ associado
   * @returns objeto contendo:
   *   - token: JWT assinado
   *   - expires: expiração em ms (timestamp absoluto)
   */
  async gerarAccessToken(
    usuario: Tenants,
    cnpj: string,
  ): Promise<{ token: string; expires: number }> {
    const token = await this.jwtService.signAsync(
      {
        sub: usuario.tenantId,
        nomeEmpresa: usuario.nomeEmpresa,
        email: usuario.email,
        cnpj,
        baseinfo: usuario.dbName.split('_').slice(-2).join('_'),
        tenantId: usuario.tenantId,
      },
      {
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        secret: this.jwtConfiguration.secret,
        expiresIn: this.jwtConfiguration.jwtTtl,
      },
    );

    const decoded = this.jwtService.decode(token);

    // exp é timestamp em segundos, convertemos para milissegundos
    const expires = decoded.exp * 1000;

    return { token, expires };
  }

  /**
   * Gera e assina um JWT de refresh para o usuário, contendo id, CNPJ e base de dados.
   *
   * O token é configurado para expirar exatamente às 03:00 da próxima ocorrência desse horário,
   * calculando dinamicamente o tempo restante até lá e aplicando-o como `expiresIn`.
   *
   * @param usuario - dados do usuário
   * @param cnpj - CNPJ associado
   * @returns objeto contendo:
   *   - token: JWT de refresh assinado
   *   - expires: timestamp absoluto de expiração em ms (para uso em new Date() ou cookies)
   */
  async gerarRefreshToken(
    usuario: Tenants,
    cnpj: string,
  ): Promise<{ token: string; expires: number }> {
    const now = new Date();
    const next3am = new Date(now);

    if (now.getHours() >= 3) {
      next3am.setDate(now.getDate() + 1);
    }
    next3am.setHours(3, 0, 0, 0);

    const diffMs = next3am.getTime() - now.getTime();
    const expiresIn = Math.floor(diffMs / 1000);

    const token = await this.jwtService.signAsync(
      {
        sub: usuario.tenantId,
        cnpj,
        baseinfo: usuario.dbName.split('_').slice(-2).join('_'),
      },
      {
        audience: this.jwtConfiguration.audience,
        issuer: this.jwtConfiguration.issuer,
        secret: this.jwtConfiguration.secret,
        expiresIn,
      },
    );

    return {
      token,
      expires: now.getTime() + diffMs,
    };
  }
}
