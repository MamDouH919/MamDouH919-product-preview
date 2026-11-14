import type { Request } from 'express';

/**
 * The API's public origin as this request reached it. A gateway notifies on
 * the same host, and the host is what tells the API which store it is for.
 * https unless it is a local address: behind a proxy `req.protocol` can read
 * "http" even though the public side is https.
 */
export function apiOrigin(req: Pick<Request, 'hostname' | 'get'>): string {
  const host = req.get('host') ?? req.hostname;
  const local = /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}
