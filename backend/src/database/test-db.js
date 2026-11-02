import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDb() {
  console.log('Testing PGlite database setup...');
  const pglite = new PGlite();
  const migrationPath = path.join(__dirname, '../../prisma/migrations/0_init/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  await pglite.exec(sql);
  console.log('Schema executed successfully on PGlite!');

  const adapter = new PrismaPGlite(pglite);
  const prisma = new PrismaClient({ adapter });

  const org = await prisma.organization.create({
    data: { name: 'Test Org' },
  });
  console.log('Created organization via Prisma:', org);

  const orgs = await prisma.organization.findMany();
  console.log('Queried organizations:', orgs);

  await prisma.$disconnect();
  console.log('Test completed successfully!');
}

testDb().catch(console.error);
