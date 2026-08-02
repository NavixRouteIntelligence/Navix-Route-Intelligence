import { lookup } from 'node:dns/promises';
import { request } from 'node:https';

import { Injectable } from '@nestjs/common';

import { canonicalHostname, isPrivateOrReservedAddress } from './webhook-url-security';

@Injectable()
export class WebhookHttpClient {
  async post(url: string, body: string, headers: Record<string, string>): Promise<number> {
    const target = new URL(url);
    const hostname = canonicalHostname(target.hostname);
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isPrivateOrReservedAddress(address))
    ) {
      throw new Error('Destino do webhook resolveu para uma rede privada ou reservada.');
    }

    // O lookup customizado fixa a conexão no endereço que acabámos de validar.
    // Assim não existe um segundo DNS lookup entre a verificação e o uso.
    const selected = addresses[0];
    return new Promise<number>((resolve, reject) => {
      const req = request(target, {
        method: 'POST',
        headers: { ...headers, 'content-length': Buffer.byteLength(body).toString() },
        lookup: (_host, _options, callback) => callback(null, selected.address, selected.family),
      });
      req.setTimeout(10_000, () => req.destroy(new Error('Timeout ao enviar webhook.')));
      req.on('error', reject);
      req.on('response', (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      });
      req.end(body);
    });
  }
}
