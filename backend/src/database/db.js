import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let prismaInstance = null;
let pgliteInstance = null;

export async function getPrismaClient() {
  if (prismaInstance) {
    return prismaInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isPostgresRemote = databaseUrl && 
    (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) &&
    !databaseUrl.includes('localhost:5432/kanban_db');

  const migrationFile = path.join(__dirname, '../../prisma/migrations/0_init/migration.sql');
  const ddlSql = fs.existsSync(migrationFile) ? fs.readFileSync(migrationFile, 'utf8') : null;

  if (isPostgresRemote) {
    console.log('[DB] Connecting to remote PostgreSQL via @prisma/adapter-pg...');
    const pool = new pg.Pool({ connectionString: databaseUrl });

    // Check if tables exist, if not run DDL
    try {
      const res = await pool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations');"
      );
      if (!res.rows[0]?.exists && ddlSql) {
        console.log('[DB] Tables missing in remote PostgreSQL. Running initial DDL migration...');
        await pool.query(ddlSql);
        console.log('[DB] Remote PostgreSQL tables successfully created.');
      } else {
        console.log('[DB] Remote PostgreSQL tables verified.');
      }
    } catch (migErr) {
      console.warn('[DB] Migration verification warning:', migErr.message);
    }

    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  } else {
    const dataDir = process.env.NODE_ENV === 'test' 
      ? undefined 
      : (process.env.DATABASE_DIR || path.join(__dirname, '../../pglite-data'));

    console.log(`[DB] Initializing PGlite embedded PostgreSQL (dir: ${dataDir || 'in-memory'})...`);
    pgliteInstance = new PGlite(dataDir);

    if (ddlSql) {
      await pgliteInstance.exec(ddlSql);
      console.log('[DB] Core tables and constraints verified in PGlite.');
    }

    const adapter = new PrismaPGlite(pgliteInstance);
    prismaInstance = new PrismaClient({ adapter });
  }

  return prismaInstance;
}

export const prisma = await getPrismaClient();
export default prisma;
