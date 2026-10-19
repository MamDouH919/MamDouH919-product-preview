import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Symmetric encryption for secrets stored in tenant databases (SMTP passwords,
 * API keys). AES-256-GCM, so a tampered value fails to decrypt rather than
 * yielding garbage. Stored as `v1:<iv>:<tag>:<ciphertext>` (base64 parts).
 *
 * The key comes from ENCRYPTION_KEY. Changing it makes stored secrets
 * unreadable — admins would have to re-enter them.
 */
const PREFIX = 'v1';

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('ENCRYPTION_KEY is not set');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv, tag, data].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
}

export function decryptSecret(stored: string): string {
  const [prefix, iv, tag, data] = stored.split(':');
  if (prefix !== PREFIX || !iv || !tag || !data) throw new Error('Unrecognised secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
