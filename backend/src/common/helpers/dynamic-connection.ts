import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleDestroy,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import mongoose, { Connection } from 'mongoose';
import { tenantSchemas } from '../tenant/tenant-schemas';
import { supportsTransactions } from '../tenant/with-transaction';
import { TenantRecord, TenantRegistry } from '../tenant/tenant-registry';

/** How often each instance re-reads the registry, so edits made on another instance arrive. */
const REGISTRY_REFRESH_MS = 30_000;
/** Grace period before closing a connection a registry edit replaced, for requests still using it. */
const CONNECTION_DRAIN_MS = 30_000;

/** Per-tenant configuration, keyed by hostname in config.json / TENANT_MAP. */
export interface TenantConfig {
    /** Mongo connection string for this tenant's database. */
    mongoUri: string;
    /** Public frontend origin, e.g. "https://ranoshka.com". Used for CORS and
     *  for building links in emails (password reset, etc.). */
    frontendUrl: string;
    /**
     * Set on a second host for the same store (e.g. "www.example.com" with
     * aliasOf "example.com"). It must use the same database as that host.
     * Without it two hosts on one database are refused, because jobs that
     * visit each store would visit that one twice.
     */
    aliasOf?: string;
}

/**
 * Which database a URI points at, for spotting two hosts that share one:
 * the server list (sorted, lower-case) plus the database name. Only catches
 * identical spellings — "localhost" and "127.0.0.1" read as different.
 */
export function databaseKey(mongoUri: string): string {
    const match = /^mongodb(\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/i.exec(mongoUri.trim());
    if (!match) throw new Error(`Not a MongoDB connection string: ${mongoUri.slice(0, 20)}…`);
    const [, srv, hosts, db] = match;
    const servers = hosts.toLowerCase().split(',').sort().join(',');
    return `${srv ? 'srv:' : ''}${servers}/${decodeURIComponent(db || 'test')}`;
}

/**
 * Refuses a tenant map in which two stores would share a database, or an
 * alias points at a host that isn't there, uses another database, or is
 * itself an alias. Thrown at boot, so a bad map never serves a request.
 */
export function validateTenantMap(map: Record<string, TenantConfig>): void {
    const owners = new Map<string, string>();
    for (const [host, cfg] of Object.entries(map)) {
        if (cfg.aliasOf !== undefined) {
            const target = Object.prototype.hasOwnProperty.call(map, cfg.aliasOf) ? map[cfg.aliasOf] : undefined;
            if (!target) throw new Error(`Tenant map: ${host} is an alias of unknown host ${cfg.aliasOf}`);
            if (target.aliasOf !== undefined) throw new Error(`Tenant map: ${host} is an alias of an alias (${cfg.aliasOf})`);
            if (databaseKey(target.mongoUri) !== databaseKey(cfg.mongoUri)) {
                throw new Error(`Tenant map: ${host} is an alias of ${cfg.aliasOf} but uses a different database`);
            }
            continue;
        }
        const key = databaseKey(cfg.mongoUri);
        const owner = owners.get(key);
        if (owner) {
            throw new Error(
                `Tenant map: ${owner} and ${host} use the same database. ` +
                    `Give each store its own database, or mark one with "aliasOf".`,
            );
        }
        owners.set(key, host);
    }
}

/**
 * The live map: every enabled store, plus the aliases of enabled stores.
 * Validation runs on the whole registry first, disabled stores included.
 */
export function liveTenantMap(records: TenantRecord[]): Record<string, TenantConfig> {
    const all: Record<string, TenantConfig> = {};
    for (const { host, mongoUri, frontendUrl, aliasOf } of records) {
        all[host] = { mongoUri, frontendUrl, ...(aliasOf ? { aliasOf } : {}) };
    }
    validateTenantMap(all);
    const disabled = new Set(records.filter((r) => r.disabled).map((r) => r.host));
    return Object.fromEntries(
        Object.entries(all).filter(([host, cfg]) => !disabled.has(host) && !(cfg.aliasOf && disabled.has(cfg.aliasOf))),
    );
}

@Injectable()
export class TenantConnectionService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(TenantConnectionService.name);
    private connections = new Map<string, Connection>();
    private tenantMap: Record<string, TenantConfig> | null = null;
    private registry: TenantRegistry | null = null;
    private refreshTimer?: NodeJS.Timeout;

    /**
     * With PLATFORM_MONGO_URL set, the tenant map lives in that database and is
     * managed from the platform dashboard. An empty registry is filled once from
     * TENANT_MAP / config.json, which are ignored from then on.
     */
    async onModuleInit(): Promise<void> {
        const uri = process.env.PLATFORM_MONGO_URL;
        if (!uri) return;

        this.registry = await TenantRegistry.open(uri);
        if (await this.registry.isEmpty()) {
            const legacy = this.loadStaticMap();
            if (Object.keys(legacy).length) {
                await this.registry.importMap(legacy);
                this.logger.log(`Imported ${Object.keys(legacy).length} tenant(s) into the platform registry.`);
            }
        }
        await this.reload();
        this.refreshTimer = setInterval(() => {
            this.reload().catch((err) => this.logger.error(`Tenant registry refresh failed: ${err.message}`));
        }, REGISTRY_REFRESH_MS).unref();
    }

    async onModuleDestroy(): Promise<void> {
        clearInterval(this.refreshTimer);
        await this.registry?.close();
    }

    /** The platform registry, or 503 when this deployment still uses TENANT_MAP / config.json. */
    getRegistry(): TenantRegistry {
        if (!this.registry) {
            throw new ServiceUnavailableException(
                'Tenant registry is not configured. Set PLATFORM_MONGO_URL to manage tenants from the dashboard.',
            );
        }
        return this.registry;
    }

    /** Re-reads the registry into the live map and retires connections whose store changed. */
    async reload(): Promise<void> {
        const next = liveTenantMap(await this.getRegistry().list());
        for (const [host, connection] of this.connections) {
            if (next[host]?.mongoUri === this.tenantMap?.[host]?.mongoUri) continue;
            this.connections.delete(host);
            setTimeout(() => void connection.close(), CONNECTION_DRAIN_MS).unref();
        }
        this.tenantMap = next;
    }

    /** Whether this instance holds an open connection to the host's database. */
    isConnected(host: string): boolean {
        return this.connections.get(host)?.readyState === 1;
    }

    private loadTenantMap(): Record<string, TenantConfig> {
        if (this.tenantMap) return this.tenantMap;
        const map = this.loadStaticMap();
        if (Object.keys(map).length) this.tenantMap = map;
        return map;
    }

    /** TENANT_MAP, else src/config.json, else empty. */
    private loadStaticMap(): Record<string, TenantConfig> {
        // Prefer the env var so production connection strings (with credentials)
        // are never committed to source control. Fall back to the local file for
        // development only.
        const fromEnv = process.env.TENANT_MAP;
        if (fromEnv) {
            const map = JSON.parse(fromEnv);
            validateTenantMap(map);
            return map;
        }

        const configPath = join(process.cwd(), 'src', 'config.json');
        if (!existsSync(configPath)) {
            // No tenants configured yet (e.g. a fresh server before
            // `npm run add-tenant` has run). Don't crash the whole app at boot
            // or every request — return an empty map (so the app starts and CORS
            // builds) and let per-request lookups 404. Not cached, so it's picked
            // up automatically once the file is created.
            this.logger.warn(
                `No TENANT_MAP env var and no ${configPath} found. ` +
                'No tenants are configured yet.',
            );
            return {};
        }

        const map = JSON.parse(readFileSync(configPath, 'utf-8'));
        validateTenantMap(map);
        return map;
    }

    /** Returns the tenant config for a host, or throws 404 if unknown. */
    getTenantConfig(host: string): TenantConfig {
        const tenantMap = this.loadTenantMap();

        // `host` comes from the client-controlled Host header. Use an own-property
        // check so inherited keys ("constructor", "__proto__", "toString", ...)
        // can't resolve to something unexpected.
        if (!Object.prototype.hasOwnProperty.call(tenantMap, host)) {
            throw new NotFoundException('Unknown tenant');
        }

        return tenantMap[host];
    }

    /** Resolves a host to its frontend origin, or undefined if unknown. */
    getFrontendUrl(host: string): string | undefined {
        const tenantMap = this.loadTenantMap();
        return Object.prototype.hasOwnProperty.call(tenantMap, host)
            ? tenantMap[host].frontendUrl
            : undefined;
    }

    /** Every tenant's frontend origin — used to build the CORS allowlist. */
    getAllowedOrigins(): string[] {
        const tenantMap = this.loadTenantMap();
        return Object.values(tenantMap)
            .map((cfg) => cfg.frontendUrl?.replace(/\/+$/, ''))
            .filter((url): url is string => Boolean(url));
    }

    /** Every configured tenant host, aliases included. */
    getHosts(): string[] {
        return Object.keys(this.loadTenantMap());
    }

    /**
     * One host per store — aliases left out — for background jobs that visit
     * each store. Iterating every host would run a job twice for a store
     * reachable under two names.
     */
    getStoreHosts(): string[] {
        return Object.entries(this.loadTenantMap())
            .filter(([, cfg]) => cfg.aliasOf === undefined)
            .map(([host]) => host);
    }

    async getConnection(host: string): Promise<Connection> {
        if (this.connections.has(host)) {
            return this.connections.get(host)!;
        }

        const { mongoUri } = this.getTenantConfig(host);

        const connection = await mongoose
            .createConnection(mongoUri)
            .asPromise();

        // Register every model on this connection so cross-model
        // `.populate()` calls can always resolve referenced schemas.
        for (const { name, schema } of tenantSchemas) {
            connection.model(name, schema);
        }

        this.connections.set(host, connection);

        // Finance writes run as transactions and refuse a database that can't;
        // say so once, at connect, rather than at the first refused write.
        if (!(await supportsTransactions(connection))) {
            this.logger.warn(
                `${host}: database is not a replica set member, so transactions are unavailable. ` +
                    'See README → "MongoDB replica set".',
            );
        }

        return connection;
    }
}
