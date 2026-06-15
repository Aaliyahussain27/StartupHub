/**
 * StartupHub — Database Migration Runner
 *
 * Usage:
 *   npm run db:migrate             # run all pending migrations
 *   npm run db:migrate -- --dry-run # preview without executing
 *   npm run db:migrate -- --rollback <version>  # rollback to version N
 *
 * Migrations are numbered sequentially (001, 002, …) and tracked in the
 * `schema_migrations` table so each runs exactly once.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// ─── Connection ────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const log = (level: string, msg: string) =>
  console.log(`[${new Date().toISOString().slice(0, 19).replace('T', ' ')}] [${level}] [MIGRATE] ${msg}`);

// ─── Migration Definitions ─────────────────────────────────────────────────
interface Migration {
  version: string;
  name: string;
  up: string;
  down?: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: '001',
    name: 'initial_schema',
    up: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        source TEXT,
        channel TEXT,
        sender TEXT,
        text TEXT,
        embedding VECTOR(1536),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        decision_text TEXT,
        source_message_id UUID,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS action_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        owner TEXT,
        task TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_digests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        date DATE,
        summary_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ideas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        source TEXT,
        status TEXT DEFAULT 'inbox',
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        owner TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        assigned_to TEXT,
        status TEXT DEFAULT 'todo',
        dependencies TEXT[] DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS github_prs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        pr_number INT,
        title TEXT,
        description TEXT,
        linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS onboarding_pdfs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        new_hire_name TEXT,
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_members (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, project_id)
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
    `,
    down: `
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS project_members CASCADE;
      DROP TABLE IF EXISTS onboarding_pdfs CASCADE;
      DROP TABLE IF EXISTS github_prs CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS ideas CASCADE;
      DROP TABLE IF EXISTS daily_digests CASCADE;
      DROP TABLE IF EXISTS action_items CASCADE;
      DROP TABLE IF EXISTS decisions CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS workspaces CASCADE;
    `
  },

  {
    version: '002',
    name: 'seed_default_workspace',
    up: `
      INSERT INTO workspaces (id, name)
      VALUES ('00000000-0000-0000-0000-000000000000', 'Default Startup Workspace')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO users (id, workspace_id, email, password)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'founder@startuphub.ai',
        'password'
      )
      ON CONFLICT (id) DO NOTHING;
    `,
    down: `
      DELETE FROM users  WHERE id = '00000000-0000-0000-0000-000000000001';
      DELETE FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000000';
    `
  },

  {
    version: '003',
    name: 'add_meeting_transcripts',
    up: `
      CREATE TABLE IF NOT EXISTS meeting_transcripts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT,
        raw_transcript TEXT NOT NULL,
        duration_seconds INT,
        processed BOOLEAN DEFAULT FALSE,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS meeting_transcripts_workspace_idx
        ON meeting_transcripts(workspace_id);
    `,
    down: `DROP TABLE IF EXISTS meeting_transcripts CASCADE;`
  },

  {
    version: '004',
    name: 'add_idea_merged_from',
    up: `
      ALTER TABLE ideas ADD COLUMN IF NOT EXISTS merged_from_ids TEXT[] DEFAULT '{}';
      ALTER TABLE ideas ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `,
    down: `
      ALTER TABLE ideas DROP COLUMN IF EXISTS merged_from_ids;
      ALTER TABLE ideas DROP COLUMN IF EXISTS archived_at;
      ALTER TABLE projects DROP COLUMN IF EXISTS created_by;
    `
  }
];

// ─── Migration Table Bootstrap ──────────────────────────────────────────────
async function ensureMigrationTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getApplied(client: any): Promise<Set<string>> {
  const res = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(res.rows.map((r: any) => r.version));
}

// ─── Runner ────────────────────────────────────────────────────────────────
async function runMigrations(opts: { dryRun?: boolean; rollbackTo?: string } = {}) {
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);
    const applied = await getApplied(client);

    if (opts.rollbackTo !== undefined) {
      // ROLLBACK: undo everything after rollbackTo version
      const toRollback = [...MIGRATIONS]
        .reverse()
        .filter(m => m.version > opts.rollbackTo! && applied.has(m.version));

      if (toRollback.length === 0) {
        log('INFO', 'Nothing to rollback.');
        return;
      }

      for (const m of toRollback) {
        if (!m.down) {
          log('WARN', `Migration ${m.version} has no DOWN sql — skipping`);
          continue;
        }
        if (opts.dryRun) {
          log('DRY-RUN', `Would rollback ${m.version} — ${m.name}`);
          continue;
        }
        await client.query('BEGIN');
        try {
          await client.query(m.down);
          await client.query('DELETE FROM schema_migrations WHERE version = $1', [m.version]);
          await client.query('COMMIT');
          log('INFO', `↩  Rolled back ${m.version} — ${m.name}`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          log('ERROR', `Rollback failed on ${m.version}: ${err.message}`);
          throw err;
        }
      }
    } else {
      // FORWARD: apply pending migrations
      const pending = MIGRATIONS.filter(m => !applied.has(m.version));

      if (pending.length === 0) {
        log('INFO', '✅ Database is up to date — no pending migrations.');
        return;
      }

      log('INFO', `Found ${pending.length} pending migration(s):`);
      pending.forEach(m => log('INFO', `  → ${m.version}: ${m.name}`));

      for (const m of pending) {
        if (opts.dryRun) {
          log('DRY-RUN', `Would apply ${m.version} — ${m.name}`);
          continue;
        }

        await client.query('BEGIN');
        try {
          await client.query(m.up);
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
            [m.version, m.name]
          );
          await client.query('COMMIT');
          log('INFO', `✅ Applied ${m.version} — ${m.name}`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          log('ERROR', `Migration ${m.version} failed: ${err.message}`);
          throw err;
        }
      }
    }

    log('INFO', 'Migration run complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

// ─── CLI Entry ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rollbackIdx = args.indexOf('--rollback');
const rollbackTo = rollbackIdx !== -1 ? args[rollbackIdx + 1] : undefined;

if (!process.env.DATABASE_URL) {
  log('ERROR', 'DATABASE_URL env var not set. Cannot run migrations against a real DB.');
  log('INFO', 'The app uses an in-memory/JSON fallback when DATABASE_URL is absent.');
  process.exit(0);
}

runMigrations({ dryRun, rollbackTo }).catch(err => {
  log('ERROR', err.message);
  process.exit(1);
});
