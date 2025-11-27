import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  MessageEvent,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import databaseConfig from '../../../config/database.config';
import {
  cnpjNomeBd,
  enviarCodigoAcesso,
  gerarCodigoAcessoEmail,
  gerarStringConection,
  hash,
} from 'src/shared/utils/auth.utils';
import { PreCadastroMasterDto } from './dto/pre-cadastro-master.dto';
import { PrismaMasterService } from 'src/common/prisma/prisma-master.service';
import { consultarCnpj } from 'src/shared/utils/consultar-cnpj.utils';
import { MailService } from 'src/infra/mail/mail.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { PREFIXO_REDIS_VERIFICAR_EMAIL_COOKIE } from 'src/shared/constants/redis.constants';
import { REDIS_VERIFICAR_EMAIL_COOKIE } from 'src/shared/constants/auth.constants';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { PrismaTenantService } from 'src/common/prisma/prisma-tenant.service';

@Injectable()
export class MasterService {
  constructor(
    private readonly prismaMaster: PrismaMasterService,
    private readonly prismaTenant: PrismaTenantService,
    @Inject(databaseConfig.KEY)
    private readonly databaseService: ConfigType<typeof databaseConfig>,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) {}

  async preCadastro(preCadastroMasterDto: PreCadastroMasterDto) {
    const { nomeEmpresa, email, telefone, cnpj, senha } = preCadastroMasterDto;

    const cnpjNumber: string = cnpj.replace(/\D/g, '');
    const celularNumber: string = telefone.replace(/\D/g, '');
    void celularNumber;

    // Nome do banco de dados do novo Tenant

    // Verifica se já existe um cadastro no banco master com email e senha
    const exists = await this.prismaMaster.tenants.findFirst({
      where: {
        OR: [{ email: email }, { cnpj: cnpjNumber }],
      },
    });

    // Se já existe, retorna um erro
    if (exists) {
      throw new ConflictException(
        'Já existe um cliente com esse email ou CNPJ',
      );
    }

    // busca dados da empresa pelo cnpj
    const dadosEmpresa = await consultarCnpj(cnpjNumber);

    if (dadosEmpresa.status === 'ERROR') {
      throw new BadRequestException('O Cnpj é inválido !');
    }

    const codigoAcessoEmail = gerarCodigoAcessoEmail();

    await enviarCodigoAcesso(
      email,
      this.mailService,
      codigoAcessoEmail,
      nomeEmpresa,
    );

    const idCookieRedis = randomUUID();

    await this.redisService.set(
      `${PREFIXO_REDIS_VERIFICAR_EMAIL_COOKIE}:${idCookieRedis}`,
      {
        nomeEmpresa,
        email,
        telefone,
        cnpj,
        senha,
        codigoAcessoEmail,
      },
      300,
    );

    return {
      cookies: {
        [REDIS_VERIFICAR_EMAIL_COOKIE]: {
          token: idCookieRedis,
          maxAge: 10 * 60 * 1000,
        },
      },
    };
  }

  finalizarCadastro(req: Request, codigo: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        let dbName: string | null = null;
        let bancoCriado = false;
        let usuarioCriado: string | null = null;
        let usuarioRedirecCriado: number[] | null = null;

        const ensureMinTime = async (start: number, minMs: number) => {
          const elapsed = Date.now() - start;
          if (elapsed < minMs)
            await new Promise((res) => setTimeout(res, minMs - elapsed));
        };

        const send = (msg: string, id: number) =>
          subscriber.next({ data: { message: msg, id } });

        try {
          let start = Date.now();
          const verificarCookie = req.cookies[REDIS_VERIFICAR_EMAIL_COOKIE];
          const payload_redis = await this.redisService.get(
            `${PREFIXO_REDIS_VERIFICAR_EMAIL_COOKIE}:${verificarCookie}`,
          );
          const {
            nomeEmpresa,
            email,
            telefone,
            cnpj,
            senha,
            codigoAcessoEmail,
          } = payload_redis;

          if (String(codigoAcessoEmail) !== codigo)
            throw new BadRequestException('⚠️ Código incorreto!');

          send('Email confirmado!', 1);
          await ensureMinTime(start, 1000);

          start = Date.now();
          dbName = this.gerarNomeBanco(cnpj);
          const stringConexaoBanco = gerarStringConection(
            dbName,
            this.databaseService.tenant_database_url!,
          );
          const senhaHash = await hash(senha);

          send('Verificando dados do cadastro...', 2);
          await ensureMinTime(start, 1000);

          const exists = await this.prismaMaster.tenants.findFirst({
            where: { OR: [{ email }, { cnpj }] },
          });
          if (exists)
            throw new ConflictException(
              'Já existe um cliente com este e-mail ou CNPJ.',
            );

          start = Date.now();
          send('Consultando informações da empresa...', 3);
          const dadosEmpresa = await consultarCnpj(cnpj);
          if (dadosEmpresa.status === 'ERROR')
            throw new BadRequestException('❌ CNPJ inválido!');
          await ensureMinTime(start, 1000);

          start = Date.now();
          send('Criando ambiente da empresa...', 4);
          await this.prismaTenant.criarNovoBanco(dbName);
          bancoCriado = true;
          await this.prismaTenant.migrarSchemaPrisma(stringConexaoBanco);
          await ensureMinTime(start, 1000);

          const clientMaster = await this.prismaMaster.tenants.create({
            data: {
              cnpj,
              email,
              dbName,
              nomeEmpresa,
              telefone,
              senha: senhaHash,
              clientes_redirect: { create: [{ email, dbName }] },
            },
            include: { clientes_redirect: true },
          });
          usuarioCriado = clientMaster.tenantId;
          usuarioRedirecCriado = clientMaster.clientes_redirect.map(
            (u) => u.userId,
          );

          start = Date.now();
          send('Cadastro finalizado com sucesso!', 6);
          await ensureMinTime(start, 1000);

          send('Redirecionando para o login', 7);

          subscriber.complete();
        } catch (error) {
          if (bancoCriado && dbName)
            await this.prismaTenant.deletarBanco(dbName);
          if (usuarioRedirecCriado) {
            await this.prismaMaster.clientes_Redirect.deleteMany({
              where: { userId: { in: usuarioRedirecCriado } },
            });
          }
          if (usuarioCriado) {
            await this.prismaMaster.tenants.delete({
              where: { tenantId: usuarioCriado },
            });
          }
          send('Erro', 8);

          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Gera o nome do banco no formato:
   * `${cnpj invertido}_tecnodash_${timestamp atual}_${numero aleatorio pra evitar colisao}`
   *
   * @param cnpjNumber - O CNPJ em formato numérico (string)
   * @returns Nome único do banco
   */
  private gerarNomeBanco(cnpjNumber: string): string {
    const randomSuffix: number = Math.floor(Math.random() * 5000);
    return `${cnpjNomeBd(cnpjNumber)}_${this.databaseService.token_tenant_name_database}_${Date.now()}_${randomSuffix}`.toLowerCase();
  }
}
