import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { r2 } from '../common/helpers/r2-storage';

/**
 * Store backups live in a private R2 bucket (R2_BACKUP_BUCKET), never the
 * public images bucket: a backup holds password hashes and customer data.
 *
 *   <host>/backup/<YYYY-MM-DDTHH-mm-ssZ>_<kind>.json.gz
 *
 * The file name is the backup's id. It sorts by time, and the kind says why
 * it was taken.
 */
export type BackupKind = 'daily' | 'manual' | 'pre-restore';

export interface BackupInfo {
  id: string;
  kind: BackupKind;
  createdAt: string;
  /** Compressed size in bytes. */
  size: number;
}

const ID_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)_(daily|manual|pre-restore)\.json\.gz$/;

export function backupsEnabled(): boolean {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET } = process.env;
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BACKUP_BUCKET);
}

const bucket = () => process.env.R2_BACKUP_BUCKET!;
const prefix = (host: string) => `${host}/backup/`;

/** Parses an id, or null when it isn't one of ours (which also rules out path tricks). */
export function parseBackupId(id: string): { kind: BackupKind; createdAt: Date } | null {
  const match = ID_PATTERN.exec(id);
  if (!match) return null;
  const [date, time] = match[1].slice(0, -1).split('T');
  const createdAt = new Date(`${date}T${time.replace(/-/g, ':')}Z`);
  return Number.isNaN(createdAt.getTime()) ? null : { kind: match[2] as BackupKind, createdAt };
}

export function backupId(kind: BackupKind, at = new Date()): string {
  return `${at.toISOString().slice(0, 19).replace(/:/g, '-')}Z_${kind}.json.gz`;
}

export async function putBackup(host: string, id: string, body: Buffer): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: prefix(host) + id,
      Body: body,
      ContentType: 'application/gzip',
    }),
  );
}

/** Newest first. */
export async function listBackups(host: string): Promise<BackupInfo[]> {
  const backups: BackupInfo[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix(host), ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      const id = object.Key!.slice(prefix(host).length);
      const parsed = parseBackupId(id);
      if (!parsed) continue;
      backups.push({ id, kind: parsed.kind, createdAt: parsed.createdAt.toISOString(), size: object.Size ?? 0 });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return backups.sort((a, b) => b.id.localeCompare(a.id));
}

export async function getBackup(host: string, id: string): Promise<Buffer> {
  const object = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: prefix(host) + id }));
  return Buffer.from(await object.Body!.transformToByteArray());
}

export async function deleteBackup(host: string, id: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: prefix(host) + id }));
}
