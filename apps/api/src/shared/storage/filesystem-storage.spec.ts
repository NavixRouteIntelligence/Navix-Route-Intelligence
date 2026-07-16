import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AppConfigService } from '../config/app-config.service';
import { FilesystemStorage } from './filesystem-storage';
import { MediaUrlSigner } from './media-url-signer';

function configFor(dir: string): AppConfigService {
  return {
    storage: {
      driver: 'local',
      localDir: dir,
      publicBaseUrl: 'http://localhost:3001/api/v1/files',
      mediaUrlSecret: 'test-secret',
      mediaUrlTtlSeconds: 900,
      s3: {},
    },
  } as unknown as AppConfigService;
}

const saveInput = (id: string, field: 'photo' | 'signature') => ({
  scope: 'pod',
  tenantId: 't1',
  id,
  field,
  buffer: Buffer.from('bytes'),
  contentType: 'image/png',
  extension: 'png',
});

describe('FilesystemStorage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'navix-storage-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('grava em disco e retorna a REFERÊNCIA (key), não a URL', async () => {
    const storage = new FilesystemStorage(configFor(dir));
    const { ref } = await storage.save(saveInput('p1', 'photo'));

    expect(ref).toBe('pod/t1/p1-photo.png');
    const onDisk = await readFile(join(dir, 'pod', 't1', 'p1-photo.png'));
    expect(onDisk.toString('utf8')).toBe('bytes');
  });

  it('readUrl devolve URL assinada (exp + sig) verificável (ADR-0046)', async () => {
    const storage = new FilesystemStorage(configFor(dir));
    const { ref } = await storage.save(saveInput('p1', 'photo'));
    const url = await storage.readUrl(ref);

    expect(url.startsWith('http://localhost:3001/api/v1/files/pod/t1/p1-photo.png?')).toBe(true);
    const params = new URL(url).searchParams;
    const signer = new MediaUrlSigner('test-secret', 900);
    expect(signer.verify(ref, Number(params.get('exp')), params.get('sig') ?? '')).toBe(true);
  });

  it('delete remove o arquivo pela referência (best-effort)', async () => {
    const storage = new FilesystemStorage(configFor(dir));
    const { ref } = await storage.save(saveInput('p2', 'signature'));
    await storage.delete(ref);
    await expect(readFile(join(dir, 'pod', 't1', 'p2-signature.png'))).rejects.toThrow();
  });
});
