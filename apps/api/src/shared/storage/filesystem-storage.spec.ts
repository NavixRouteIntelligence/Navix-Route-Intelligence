import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AppConfigService } from '../config/app-config.service';
import { FilesystemStorage } from './filesystem-storage';

function configFor(dir: string): AppConfigService {
  return {
    storage: {
      driver: 'local',
      localDir: dir,
      publicBaseUrl: 'http://localhost:3001/api/v1/files',
      s3: {},
    },
  } as unknown as AppConfigService;
}

describe('FilesystemStorage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'navix-storage-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('grava o objeto em disco e retorna a URL estável (fora do banco)', async () => {
    const storage = new FilesystemStorage(configFor(dir));
    const { url } = await storage.save({
      scope: 'pod',
      tenantId: 't1',
      id: 'p1',
      field: 'photo',
      buffer: Buffer.from('bytes'),
      contentType: 'image/png',
      extension: 'png',
    });

    expect(url).toBe('http://localhost:3001/api/v1/files/pod/t1/p1-photo.png');
    const onDisk = await readFile(join(dir, 'pod', 't1', 'p1-photo.png'));
    expect(onDisk.toString('utf8')).toBe('bytes');
  });

  it('delete remove o arquivo (best-effort) e ignora URL de outro base', async () => {
    const storage = new FilesystemStorage(configFor(dir));
    const { url } = await storage.save({
      scope: 'pod',
      tenantId: 't1',
      id: 'p2',
      field: 'signature',
      buffer: Buffer.from('x'),
      contentType: 'image/png',
      extension: 'png',
    });
    await expect(storage.delete('https://outro/base/x.png')).resolves.toBeUndefined();
    await storage.delete(url);
    await expect(readFile(join(dir, 'pod', 't1', 'p2-signature.png'))).rejects.toThrow();
  });
});
