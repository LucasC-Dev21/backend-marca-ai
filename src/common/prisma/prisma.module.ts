import { Global, Module } from '@nestjs/common';
import { PrismaMasterService } from './prisma-master.service';
import { PrismaTenantService } from './prisma-tenant.service';

@Global()
@Module({
  providers: [PrismaMasterService, PrismaTenantService],
  exports: [PrismaMasterService, PrismaTenantService],
})
export class PrismaModule {}
