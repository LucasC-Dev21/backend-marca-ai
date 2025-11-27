import { Global, Module } from '@nestjs/common';
import { MasterController } from './master/master.controller';
import { MasterService } from './master/master.service';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from 'src/config/jwt.config';
import { MailService } from 'src/infra/mail/mail.service';

@Global()
@Module({
  imports: [JwtModule.registerAsync(jwtConfig.asProvider())],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [],
})
export class AcessosModule {}
