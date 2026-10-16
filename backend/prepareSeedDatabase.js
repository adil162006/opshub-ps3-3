import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { db, pool } from './src/db/index.js';

const migrationsFolder = './drizzle';
const baselineTables = [
  'site_members', 'users', 'sites', 'modules', 'site_modules', 'site_versions', 'deployments',
  'categories', 'items', 'stock_movements', 'request_items', 'requests', 'approvals',
  'assignment_items', 'assignments', 'consumption_records', 'return_items', 'returns',
  'repair_parts', 'repair_records', 'excel_jobs', 'audit_logs',
];

try {
  const [{ exists }] = (await pool.query(
    "select to_regclass('public.sites') is not null as exists",
  )).rows;

  if (exists) {
    const existingTables = await pool.query(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    const existing = new Set(existingTables.rows.map((row) => row.tablename));
    const missing = baselineTables.filter((table) => !existing.has(table));
    if (missing.length) {
      throw new Error(`Existing database is missing required schema tables: ${missing.join(', ')}.`);
    }

    await pool.query('create schema if not exists drizzle');
    await pool.query(`create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`);
    const [{ latest }] = (await pool.query(
      'select max(created_at) as latest from drizzle.__drizzle_migrations',
    )).rows;
    if (latest === null) {
      const [baseline] = readMigrationFiles({ migrationsFolder });
      await pool.query(
        'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)',
        [baseline.hash, baseline.folderMillis],
      );
      console.log('Existing schema detected; recorded the base migration and will apply pending upgrades.');
    }
  }

  await migrate(db, { migrationsFolder });
  console.log('Database schema is ready for seeding.');
} finally {
  await pool.end();
}
