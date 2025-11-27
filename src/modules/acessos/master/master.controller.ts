import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  MessageEvent,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UseInterceptors,
} from '@nestjs/common';
import { MasterService } from './master.service';
import { PreCadastroMasterDto } from './dto/pre-cadastro-master.dto';

import type { Request, Response } from 'express';
import type { ConfigType } from '@nestjs/config';

import cookiesConfig from 'src/config/cookies.config';
import { REDIS_VERIFICAR_EMAIL_COOKIE } from 'src/shared/constants/auth.constants';
import { CookieCheck } from 'src/common/interceptors/cookie-check.interceptor';
import { Observable } from 'rxjs';

@Controller('master')
export class MasterController {
  constructor(
    private readonly masterService: MasterService,
    @Inject(cookiesConfig.KEY)
    private readonly cookiesConfiguration: ConfigType<typeof cookiesConfig>,
  ) {}

  @UseInterceptors(CookieCheck(REDIS_VERIFICAR_EMAIL_COOKIE))
  @Sse('finalizar_cadastro')
  finalizarCadastro(
    @Query('codigo') codigo: string,
    @Req() req: Request,
  ): Observable<MessageEvent> {
    return this.masterService.finalizarCadastro(req, codigo);
  }

  @Post('pre_cadastro')
  @HttpCode(HttpStatus.OK)
  async preCadastro(
    @Body() preCadastroMasterDto: PreCadastroMasterDto,
    @Res() res: Response,
  ) {
    const resposta = await this.masterService.preCadastro(preCadastroMasterDto);

    if (resposta.cookies) {
      Object.entries(resposta.cookies).forEach(([cookieName, cookieData]) => {
        res.cookie(cookieName, cookieData.token as string, {
          maxAge: cookieData.maxAge,
          httpOnly: this.cookiesConfiguration.cookie_http_only,
          secure: this.cookiesConfiguration.cookie_secure,
          sameSite: this.cookiesConfiguration.cookie_same_site,
          path: this.cookiesConfiguration.cookie_path,
          ...(this.cookiesConfiguration.cookie_domain && {
            domain: this.cookiesConfiguration.cookie_domain,
          }),
        });
      });
    }

    return res.send('ok').end();
  }
}
