import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { CookieOptions, Request, Response } from 'express';

import cookiesConfig from 'src/config/cookies.config';
import type { ConfigType } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { REDIS_SESSION_COOKIE } from 'src/shared/constants/auth.constants';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(cookiesConfig.KEY)
    private readonly cookiesConfiguration: ConfigType<typeof cookiesConfig>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res() res: Response,
  ) {
    const resposta = await this.authService.login(loginDto, ip, userAgent);

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

      delete resposta.cookies;
    }

    if ((resposta.sessoesAtivas?.length ?? 0) > 0) {
      return res.json(resposta).end();
    }

    return res.send('ok').end();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req);

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

    return 'ok';
  }

  @Get('verificar_usuario_logado')
  async verificarUsuarioLogado(@Req() req: Request, @Res() res: Response) {
    try {
      const resposta = await this.authService.verificarUsuarioLogado(req, res);
      return res.json(resposta).end();
    } catch (err) {
      void err;

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
      res.status(401).end();
    }
  }
}
