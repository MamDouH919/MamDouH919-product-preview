/**
 * Interactive "add a new tenant" CLI.
 *
 *   npm run add-tenant
 *
 * Asks a few questions in the terminal, then:
 *   1. Writes the host -> Mongo URI mapping into src/config.json (the local
 *      tenant map). For production you instead put this line into the
 *      TENANT_MAP env var — the script prints it for you at the end.
 *   2. Optionally seeds the new tenant's database (roles + admin user) by
 *      running the existing seeder with the credentials you provide.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const CONFIG_PATH = join(process.cwd(), 'src', 'config.json');

interface TenantConfig {
  mongoUri: string;
  frontendUrl: string;
}

type TenantMap = Record<string, TenantConfig>;

function loadConfig(): TenantMap {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    throw new Error(`config.json exists but is not valid JSON: ${CONFIG_PATH}`);
  }
}

function saveConfig(map: TenantMap): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const ask = async (q: string, def?: string): Promise<string> => {
    const suffix = def ? ` (${def})` : '';
    const answer = (await rl.question(`${q}${suffix}: `)).trim();
    return answer || def || '';
  };
  const askYesNo = async (q: string, def = false): Promise<boolean> => {
    const answer = (await ask(`${q} [y/n]`, def ? 'y' : 'n')).toLowerCase();
    return answer.startsWith('y');
  };

  try {
    console.log('\n=== Add a new tenant ===\n');

    // 1. Hostname (the key used everywhere: DB routing, JWT, frontend).
    const host = await ask('Tenant hostname (no port, e.g. ranoshka.com)');
    if (!host) throw new Error('Hostname is required.');
    if (host.includes(':')) throw new Error('Do not include a port in the hostname.');

    const config = loadConfig();
    if (config[host]) {
      const overwrite = await askYesNo(
        `"${host}" already exists -> ${config[host].mongoUri}. Overwrite?`,
      );
      if (!overwrite) {
        console.log('Aborted. No changes made.');
        return;
      }
    }

    // 2. Mongo URI — paste a full one, or build a local one from a DB name.
    let mongoUri = await ask('Full Mongo URI (leave blank to build a local one)');
    if (!mongoUri) {
      const dbName = await ask('Local database name', `${host.split('.')[0]}-db`);
      mongoUri = `mongodb://127.0.0.1:27017/${dbName}`;
    }

    // 3. Frontend origin — used for CORS and password-reset email links.
    const frontendUrl = await ask('Frontend URL (origin)', `https://${host}`);

    const entry: TenantConfig = { mongoUri, frontendUrl };
    config[host] = entry;
    saveConfig(config);
    console.log(`\n✓ Saved to src/config.json:\n    "${host}": ${JSON.stringify(entry)}\n`);
    console.log('  For PRODUCTION, add this entry to the TENANT_MAP env var instead:');
    console.log(`    ${JSON.stringify({ [host]: entry })}\n`);

    // 4. Optionally seed the new database.
    const seedNow = await askYesNo('Seed this tenant now (roles + admin user)?', true);
    if (!seedNow) {
      console.log('\nDone. Run the seeder later with: npm run seed -- ' + host);
      return;
    }

    const adminName = await ask('Admin name', 'Admin');
    const adminEmail = await ask('Admin email');
    const adminPassword = await ask('Admin password');
    if (!adminEmail || !adminPassword) {
      throw new Error('Admin email and password are required to seed.');
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SEED_ADMIN_NAME: adminName,
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: adminPassword,
    };

    if (await askYesNo('Also create a super admin?', true)) {
      const superName = await ask('Super admin name', 'Super Admin');
      const superEmail = await ask('Super admin email');
      const superPassword = await ask('Super admin password');
      if (!superEmail || !superPassword) {
        throw new Error('Super admin email and password are required.');
      }
      env.SEED_SUPER_ADMIN_NAME = superName;
      env.SEED_SUPER_ADMIN_EMAIL = superEmail;
      env.SEED_SUPER_ADMIN_PASSWORD = superPassword;
    }

    console.log(`\nSeeding "${host}"...\n`);
    rl.close();
    const result = spawnSync('npm', ['run', 'seed', '--', host], {
      env,
      stdio: 'inherit',
    });
    process.exit(result.status ?? 0);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('\nFailed to add tenant:', err.message ?? err);
  process.exit(1);
});
