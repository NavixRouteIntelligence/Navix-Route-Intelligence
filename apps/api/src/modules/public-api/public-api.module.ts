import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { OptimizerModule } from '../optimizer/optimizer.module';
import { PodModule } from '../pod/pod.module';

import { ApiKeyQuotaService } from './application/api-key-quota.service';
import { ApiKeyService } from './application/api-key.service';
import { ApiKeyOrmEntity } from './infrastructure/persistence/api-key.orm-entity';
import { ApiKeyAuthGuard } from './interface/api-key-auth.guard';
import { ApiKeyController } from './interface/api-key.controller';
import { PublicDeliveryController } from './interface/public-delivery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyOrmEntity]),
    DeliveryModule,
    PodModule,
    OptimizerModule,
  ],
  controllers: [ApiKeyController, PublicDeliveryController],
  providers: [ApiKeyService, ApiKeyQuotaService, ApiKeyAuthGuard],
})
export class PublicApiModule {}
