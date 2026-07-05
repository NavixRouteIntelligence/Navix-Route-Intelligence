import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Application — vehicles
import { CreateVehicleUseCase } from './application/vehicles/create-vehicle.use-case';
import { DeleteVehicleUseCase } from './application/vehicles/delete-vehicle.use-case';
import { GetVehicleUseCase } from './application/vehicles/get-vehicle.use-case';
import { ListVehiclesUseCase } from './application/vehicles/list-vehicles.use-case';
import { UpdateVehicleUseCase } from './application/vehicles/update-vehicle.use-case';
// Application — drivers
import { CreateDriverUseCase } from './application/drivers/create-driver.use-case';
import { DeleteDriverUseCase } from './application/drivers/delete-driver.use-case';
import { GetDriverUseCase } from './application/drivers/get-driver.use-case';
import { ListDriversUseCase } from './application/drivers/list-drivers.use-case';
import { UpdateDriverUseCase } from './application/drivers/update-driver.use-case';
import { FLEET_LOOKUP, FleetLookupService } from './application/fleet-lookup.service';
// Domain ports
import { DRIVER_REPOSITORY } from './domain/ports/driver-repository.port';
import { VEHICLE_REPOSITORY } from './domain/ports/vehicle-repository.port';
// Infrastructure
import { DriverOrmEntity } from './infrastructure/persistence/driver.orm-entity';
import { DriverRepository } from './infrastructure/persistence/driver.repository';
import { VehicleOrmEntity } from './infrastructure/persistence/vehicle.orm-entity';
import { VehicleRepository } from './infrastructure/persistence/vehicle.repository';
// Interface
import { DriverController } from './interface/driver.controller';
import { VehicleController } from './interface/vehicle.controller';

/**
 * Módulo Fleet (veículos e motoristas). Segue Clean Architecture: controllers
 * → use cases → ports (domínio) ← repositórios (infra). Ver docs/architecture.md.
 */
@Module({
  imports: [TypeOrmModule.forFeature([VehicleOrmEntity, DriverOrmEntity])],
  controllers: [VehicleController, DriverController],
  providers: [
    CreateVehicleUseCase,
    GetVehicleUseCase,
    ListVehiclesUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
    CreateDriverUseCase,
    GetDriverUseCase,
    ListDriversUseCase,
    UpdateDriverUseCase,
    DeleteDriverUseCase,
    { provide: VEHICLE_REPOSITORY, useClass: VehicleRepository },
    { provide: DRIVER_REPOSITORY, useClass: DriverRepository },
    { provide: FLEET_LOOKUP, useClass: FleetLookupService },
  ],
  exports: [FLEET_LOOKUP],
})
export class FleetModule {}
