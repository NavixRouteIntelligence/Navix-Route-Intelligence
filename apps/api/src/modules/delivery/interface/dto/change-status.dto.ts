import { DELIVERY_STATUSES, type ChangeDeliveryStatusRequest, type DeliveryStatus } from '@navix/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ChangeStatusDto implements ChangeDeliveryStatusRequest {
  @ApiProperty({ enum: DELIVERY_STATUSES })
  @IsIn(DELIVERY_STATUSES as readonly string[])
  status!: DeliveryStatus;
}
