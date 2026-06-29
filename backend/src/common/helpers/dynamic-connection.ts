import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import mongoose, { Connection } from 'mongoose';
import { tenantSchemas } from '../tenant/tenant-schemas';

/** Per-tenant configuration, keyed by hostname in config.json / TENANT_MAP. */
export interface TenantConfig {
    /** Mongo connection string for this tenant's database. */
    mongoUri: string;
    /** Public frontend origin, e.g. "https://ranoshka.com". Used for CORS and
     *  for building links in emails (password reset, etc.). */
    frontendUrl: string;
}

@Injectable()
export class TenantConnectionService {
    private readonly logger = new Logger(TenantConnectionService.name);
    private connections = new Map<string, Connection>();
    private tenantMap: Record<string, TenantConfig> | null = null;

    private loadTenantMap(): Record<string, TenantConfig> {
        if (this.tenantMap) return this.tenantMap;

        // Prefer the env var so production connection strings (with credentials)
        // are never committed to source control. Fall back to the local file for
        // development only.
        const fromEnv = process.env.TENANT_MAP;
        if (fromEnv) {
            this.tenantMap = JSON.parse(fromEnv);
            return this.tenantMap!;
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

        this.tenantMap = JSON.parse(readFileSync(configPath, 'utf-8'));
        return this.tenantMap!;
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
            .map((cfg) => cfg.frontendUrl)
            .filter((url): url is string => Boolean(url));
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

        return connection;
    }
}
