import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export function CookieCheck(cookieName: string): Type<NestInterceptor> {
  @Injectable()
  class CookieCheckInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const request = context.switchToHttp().getRequest();

      const cookieValue = request.cookies?.[cookieName];
      if (!cookieValue) {
        throw new BadRequestException(`Cookie de sessão não encontrado`);
      }

      return next.handle();
    }
  }

  return CookieCheckInterceptor;
}
