import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AUDIT_LOG } from '../src/shared/audit/audit-log.port';
import { DomainExceptionFilter } from '../src/shared/interface/domain-exception.filter';
import { JwtAuthGuard } from '../src/shared/security/jwt-auth.guard';
import { RolesGuard } from '../src/shared/security/roles.guard';
import { ChangeDeliveryStatusUseCase } from '../src/modules/delivery/application/change-delivery-status.use-case';
import { CreateDeliveryUseCase } from '../src/modules/delivery/application/create-delivery.use-case';
import { DeleteDeliveryUseCase } from '../src/modules/delivery/application/delete-delivery.use-case';
import { GetDeliveryUseCase } from '../src/modules/delivery/application/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../src/modules/delivery/application/list-deliveries.use-case';
import { SyncDeliveriesUseCase } from '../src/modules/delivery/application/sync-deliveries.use-case';
import { UpdateDeliveryUseCase } from '../src/modules/delivery/application/update-delivery.use-case';
import { FLEET_GATEWAY } from '../src/modules/delivery/application/ports/fleet-gateway.port';
import type { ListDeliveriesQuery } from '../src/modules/delivery/application/queries/list-deliveries.query';
import { Delivery } from '../src/modules/delivery/domain/delivery';
import { DELIVERY_REPOSITORY } from '../src/modules/delivery/domain/ports/delivery-repository.port';
import type {
  DeliveryChanges,
  DeliveryRepositoryPort,
} from '../src/modules/delivery/domain/ports/delivery-repository.port';
import type { NormalizedSync } from '../src/shared/kernel/sync';
import { DeliveryController } from '../src/modules/delivery/interface/delivery.controller';

/** Repositório em memória — permite testar o HTTP sem banco. */
class InMemoryDeliveryRepository implements DeliveryRepositoryPort {
  private readonly store = new Map<string, Delivery>();

  async save(delivery: Delivery): Promise<void> {
    this.store.set(delivery.snapshot().id, delivery);
  }

  async findById(tenantId: string, id: string): Promise<Delivery | null> {
    const d = this.store.get(id);
    if (!d) return null;
    const s = d.snapshot();
    return s.tenantId === tenantId && !s.deletedAt ? d : null;
  }

  async findByIds(tenantId: string, ids: string[]): Promise<Delivery[]> {
    return ids
      .map((id) => this.store.get(id))
      .filter((d): d is Delivery => {
        if (!d) return false;
        const s = d.snapshot();
        return s.tenantId === tenantId && !s.deletedAt;
      });
  }

  async findAll(tenantId: string, query: ListDeliveriesQuery) {
    const items = [...this.store.values()].filter((d) => {
      const s = d.snapshot();
      if (s.tenantId !== tenantId || s.deletedAt) return false;
      if (query.filters.status && s.status !== query.filters.status) return false;
      return true;
    });
    return { items, total: items.length };
  }

  async findChangedSince(tenantId: string, params: NormalizedSync): Promise<DeliveryChanges> {
    // Inclui tombstones (soft delete), ordenado por (updatedAt, id) — keyset.
    const ordered = [...this.store.values()]
      .filter((d) => d.snapshot().tenantId === tenantId)
      .sort((a, b) => {
        const sa = a.snapshot();
        const sb = b.snapshot();
        const t = sa.updatedAt.getTime() - sb.updatedAt.getTime();
        return t !== 0 ? t : sa.id < sb.id ? -1 : sa.id > sb.id ? 1 : 0;
      });
    const filtered = ordered.filter((d) => {
      const s = d.snapshot();
      if (params.cursor) {
        const diff = s.updatedAt.getTime() - params.cursor.updatedAt.getTime();
        return diff > 0 || (diff === 0 && s.id > params.cursor.id);
      }
      if (params.since) return s.updatedAt.getTime() >= params.since.getTime();
      return true;
    });
    const hasMore = filtered.length > params.limit;
    return { items: hasMore ? filtered.slice(0, params.limit) : filtered, hasMore };
  }
}

const TENANT = '019f335f-a2ae-7dd9-bcda-d458fe138c98';

const validBody = {
  address: {
    street: 'Av. Paulista',
    number: '1000',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01310-100',
    country: 'BR',
    latitude: -23.561,
    longitude: -46.656,
  },
  timeWindow: { start: '2026-07-06T09:00:00Z', end: '2026-07-06T12:00:00Z' },
  priority: 'high',
};

describe('Delivery (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DeliveryController],
      providers: [
        CreateDeliveryUseCase,
        GetDeliveryUseCase,
        ListDeliveriesUseCase,
        SyncDeliveriesUseCase,
        UpdateDeliveryUseCase,
        ChangeDeliveryStatusUseCase,
        DeleteDeliveryUseCase,
        { provide: DELIVERY_REPOSITORY, useClass: InMemoryDeliveryRepository },
        {
          provide: FLEET_GATEWAY,
          useValue: { vehicleExists: async () => true, driverExists: async () => true },
        },
        { provide: AUDIT_LOG, useValue: { record: async () => undefined } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = {
            id: '019f335f-a2de-7dd9-bcda-d97de1d9ca11',
            tenantId: TENANT,
            email: 'admin@navix.test',
            roles: ['admin', 'dispatcher'],
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let createdId: string;

  it('POST /api/v1/deliveries cria (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/deliveries')
      .send(validBody)
      .expect(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.priority).toBe('high');
    createdId = res.body.data.id;
  });

  it('GET /api/v1/deliveries lista (200)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/deliveries').expect(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('rejeita payload inválido (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/deliveries')
      .send({ ...validBody, address: { ...validBody.address, latitude: 999 } })
      .expect(400);
  });

  it('bloqueia transição de status inválida (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/deliveries/${createdId}/status`)
      .send({ status: 'delivered' })
      .expect(409);
  });

  it('404 ao consultar id inexistente', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/deliveries/019f3364-50d8-7665-bcb4-2cc75f065d6c')
      .expect(404);
  });

  it('soft delete responde 204', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/deliveries/${createdId}`)
      .expect(204);
  });

  describe('sincronização incremental', () => {
    const server = () => request(app.getHttpServer());
    const create = async (): Promise<string> =>
      (await server().post('/api/v1/deliveries').send(validBody).expect(201)).body.data.id;

    it('pagina por cursor de keyset e sinaliza hasMore', async () => {
      await create();
      await create();

      const p1 = await server().get('/api/v1/deliveries/sync?limit=1').expect(200);
      expect(p1.body.data).toHaveLength(1);
      expect(p1.body.meta.hasMore).toBe(true);
      expect(p1.body.meta.nextCursor).toBeTruthy();
      // O campo tombstone é sempre serializado (null em linhas ativas).
      expect(p1.body.data[0]).toHaveProperty('deletedAt');

      const cursor = encodeURIComponent(p1.body.meta.nextCursor);
      const p2 = await server().get(`/api/v1/deliveries/sync?limit=1&cursor=${cursor}`).expect(200);
      expect(p2.body.data[0].id).not.toBe(p1.body.data[0].id);
      expect(new Date(p2.body.meta.syncedAt).getTime()).not.toBeNaN();
    });

    it('entrega tombstone após soft delete respeitando a marca d’água', async () => {
      const watermark = new Date(Date.now() - 1000).toISOString();
      const id = await create();
      await server().delete(`/api/v1/deliveries/${id}`).expect(204);

      const res = await server()
        .get(`/api/v1/deliveries/sync?updatedSince=${encodeURIComponent(watermark)}&limit=500`)
        .expect(200);
      const tombstone = res.body.data.find((d: { id: string }) => d.id === id);
      expect(tombstone).toBeDefined();
      expect(tombstone.deletedAt).not.toBeNull();
    });

    it('rejeita cursor malformado (400)', async () => {
      await server().get('/api/v1/deliveries/sync?cursor=invalidcursor').expect(400);
    });
  });
});
