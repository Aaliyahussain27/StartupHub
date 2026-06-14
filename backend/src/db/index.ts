import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Default Hardcoded IDs for fallback & seed
export const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';
export const DEFAULT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Interfaces for tables
export interface Workspace {
  id: string;
  name: string;
  created_at: Date | string;
}

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  password?: string;
  created_at: Date | string;
}

export interface ProjectMember {
  user_id: string;
  project_id: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface UserSession {
  token: string;
  user_id: string;
  expires_at: Date | string;
}


export interface Message {
  id: string;
  workspace_id: string;
  source: 'whatsapp' | 'slack' | 'github';
  channel: string;
  sender: string;
  text: string;
  embedding: number[];
  timestamp: Date | string;
  created_at: Date | string;
}

export interface Decision {
  id: string;
  workspace_id: string;
  decision_text: string;
  source_message_id?: string | null;
  embedding: number[];
  created_at: Date | string;
}

export interface ActionItem {
  id: string;
  workspace_id: string;
  owner: string;
  task: string;
  deadline: string;
  status: 'pending' | 'completed';
  created_at: Date | string;
}

export interface DailyDigest {
  id: string;
  workspace_id: string;
  date: string;
  summary_text: string;
  created_at: Date | string;
}

export interface Idea {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  source: 'whatsapp' | 'slack';
  status: 'inbox' | 'project' | 'archived';
  embedding: number[];
  created_at: Date | string;
}

export interface Project {
  id: string;
  workspace_id: string;
  idea_id: string;
  title: string;
  description: string;
  owner: string;
  deadline: string;
  status: string;
  created_at: Date | string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  assigned_to: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  created_at: Date | string;
  dependencies?: string[]; // waiting on task IDs
  updated_at?: Date | string;
}

export interface GitHubPR {
  id: string;
  workspace_id: string;
  pr_number: number;
  title: string;
  description: string;
  linked_project_id?: string | null;
  embedding: number[];
  created_at: Date | string;
}

export interface OnboardingPDF {
  id: string;
  workspace_id: string;
  new_hire_name: string;
  pdf_url: string;
  created_at: Date | string;
}

// In-Memory Fallback DB State
interface FallbackDatabase {
  workspaces: Workspace[];
  users: User[];
  messages: Message[];
  decisions: Decision[];
  action_items: ActionItem[];
  daily_digests: DailyDigest[];
  ideas: Idea[];
  projects: Project[];
  tasks: Task[];
  github_prs: GitHubPR[];
  onboarding_pdfs: OnboardingPDF[];
  project_members: ProjectMember[];
  user_sessions: UserSession[];
}

const FALLBACK_DB_PATH = path.join(__dirname, '../../db_fallback.json');

let pgPool: Pool | null = null;
let isFallbackMode = false;
let fallbackData: FallbackDatabase = {
  workspaces: [],
  users: [],
  messages: [],
  decisions: [],
  action_items: [],
  daily_digests: [],
  ideas: [],
  projects: [],
  tasks: [],
  github_prs: [],
  onboarding_pdfs: [],
  project_members: [],
  user_sessions: []
};

// Log helper
const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [DATABASE] - ${message}`);
};

// Initialize DB Client
export async function initializeDatabase() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    log('WARN', 'DATABASE_URL environment variable is missing. Operating in JSON Fallback Mode.');
    setupFallbackMode();
    return;
  }

  try {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined
    });
    
    // Test connection
    const client = await pgPool.connect();
    log('INFO', 'Connected to PostgreSQL database successfully.');
    
    // Create schema
    await runPostgresMigrations(client);
    client.release();
  } catch (err: any) {
    log('ERROR', `Failed to connect to PostgreSQL: ${err.message}. Falling back to JSON Database.`);
    isFallbackMode = true;
    setupFallbackMode();
  }
}

// Run PostgreSQL migrations to set up tables if they don't exist
async function runPostgresMigrations(client: any) {
  try {
    log('INFO', 'Running PostgreSQL migrations...');
    
    // Enable pgvector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        source TEXT,
        channel TEXT,
        sender TEXT,
        text TEXT,
        embedding VECTOR(1536),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS decisions (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        decision_text TEXT,
        source_message_id UUID,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS action_items (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        owner TEXT,
        task TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS daily_digests (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        date DATE,
        summary_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS ideas (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        title TEXT,
        description TEXT,
        source TEXT,
        status TEXT DEFAULT 'inbox',
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        idea_id UUID,
        title TEXT,
        description TEXT,
        owner TEXT,
        deadline TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT,
        assigned_to TEXT,
        status TEXT,
        dependencies TEXT[] DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS github_prs (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        pr_number INT,
        title TEXT,
        description TEXT,
        linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS onboarding_pdfs (
        id UUID PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id),
        new_hire_name TEXT,
        pdf_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
      
      CREATE TABLE IF NOT EXISTS project_members (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        role TEXT CHECK (role IN ('owner', 'editor', 'viewer')),
        PRIMARY KEY (user_id, project_id)
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP
      );
    `);

    // Create unique index for user email after adding columns
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
    `);
    
    // Seed default workspace and user if they don't exist
    await client.query(`
      INSERT INTO workspaces (id, name)
      VALUES ('${DEFAULT_WORKSPACE_ID}', 'Default Startup Workspace')
      ON CONFLICT (id) DO NOTHING;
      
      INSERT INTO users (id, workspace_id, email, password)
      VALUES ('${DEFAULT_USER_ID}', '${DEFAULT_WORKSPACE_ID}', 'founder@startuphub.ai', 'password')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    log('INFO', 'Migrations completed successfully.');
  } catch (err: any) {
    log('ERROR', `Migration execution failed: ${err.message}`);
    throw err;
  }
}

// Fallback DB setup and seed
function setupFallbackMode() {
  isFallbackMode = true;
  if (fs.existsSync(FALLBACK_DB_PATH)) {
    try {
      const dataStr = fs.readFileSync(FALLBACK_DB_PATH, 'utf-8');
      fallbackData = JSON.parse(dataStr);
      if (!fallbackData.project_members) fallbackData.project_members = [];
      if (!fallbackData.user_sessions) fallbackData.user_sessions = [];
      log('INFO', `Loaded local JSON database from: ${FALLBACK_DB_PATH}`);
      return;
    } catch (err) {
      log('ERROR', 'Error reading fallback database JSON. Initializing a clean seed...');
    }
  }

  // Seed default data structure
  fallbackData = {
    workspaces: [
      { id: DEFAULT_WORKSPACE_ID, name: 'Default Startup Workspace', created_at: new Date() }
    ],
    users: [
      { id: DEFAULT_USER_ID, workspace_id: DEFAULT_WORKSPACE_ID, email: 'founder@startuphub.ai', password: 'password', created_at: new Date() }
    ],
    messages: [],
    decisions: [],
    action_items: [],
    daily_digests: [],
    ideas: [],
    projects: [],
    tasks: [],
    github_prs: [],
    onboarding_pdfs: [],
    project_members: [],
    user_sessions: []
  };

  saveFallbackData();
  log('INFO', 'Initialized and seeded local JSON fallback database.');
}

function saveFallbackData() {
  try {
    fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(fallbackData, null, 2), 'utf-8');
  } catch (err: any) {
    log('ERROR', `Failed to write fallback database: ${err.message}`);
  }
}

// Vector operations
function dotProduct(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function magnitude(arr: number[]): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i] * arr[i];
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// Database helper queries wrapper
export const db = {
  isFallback: () => isFallbackMode,

  // General query (only works for PG mode, will throw if fallback - use custom helpers below instead for tables!)
  query: async (text: string, params?: any[]) => {
    if (isFallbackMode || !pgPool) {
      throw new Error('Database is in fallback mode. Use direct table methods instead of raw SQL queries.');
    }
    return pgPool.query(text, params);
  },

  // WORKSPACES
  getWorkspaces: async (): Promise<Workspace[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.workspaces;
    }
    const res = await pgPool.query('SELECT * FROM workspaces');
    return res.rows;
  },

  // MESSAGES
  getMessages: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<Message[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.messages.filter(m => m.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM messages WHERE workspace_id = $1 ORDER BY timestamp DESC', [workspaceId]);
    return res.rows;
  },

  insertMessage: async (message: Omit<Message, 'created_at'>): Promise<Message> => {
    const fullMsg: Message = { ...message, created_at: new Date() };
    if (isFallbackMode || !pgPool) {
      fallbackData.messages.push(fullMsg);
      saveFallbackData();
      return fullMsg;
    }
    await pgPool.query(
      'INSERT INTO messages (id, workspace_id, source, channel, sender, text, embedding, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [fullMsg.id, fullMsg.workspace_id, fullMsg.source, fullMsg.channel, fullMsg.sender, fullMsg.text, fullMsg.embedding, fullMsg.timestamp]
    );
    return fullMsg;
  },

  // DECISIONS
  getDecisions: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<Decision[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.decisions.filter(d => d.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM decisions WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertDecision: async (decision: Omit<Decision, 'id' | 'created_at'>): Promise<Decision> => {
    const fullDec: Decision = { 
      id: uuidv4(),
      ...decision, 
      created_at: new Date() 
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.decisions.push(fullDec);
      saveFallbackData();
      return fullDec;
    }
    await pgPool.query(
      'INSERT INTO decisions (id, workspace_id, decision_text, source_message_id, embedding) VALUES ($1, $2, $3, $4, $5)',
      [fullDec.id, fullDec.workspace_id, fullDec.decision_text, fullDec.source_message_id, fullDec.embedding]
    );
    return fullDec;
  },

  // ACTION ITEMS
  getActionItems: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<ActionItem[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.action_items.filter(a => a.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM action_items WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertActionItem: async (actionItem: Omit<ActionItem, 'id' | 'created_at'>): Promise<ActionItem> => {
    const fullItem: ActionItem = {
      id: uuidv4(),
      ...actionItem,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.action_items.push(fullItem);
      saveFallbackData();
      return fullItem;
    }
    await pgPool.query(
      'INSERT INTO action_items (id, workspace_id, owner, task, deadline, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [fullItem.id, fullItem.workspace_id, fullItem.owner, fullItem.task, fullItem.deadline, fullItem.status]
    );
    return fullItem;
  },

  updateActionItemStatus: async (id: string, status: 'pending' | 'completed'): Promise<boolean> => {
    if (isFallbackMode || !pgPool) {
      const idx = fallbackData.action_items.findIndex(a => a.id === id);
      if (idx > -1) {
        fallbackData.action_items[idx].status = status;
        saveFallbackData();
        return true;
      }
      return false;
    }
    const res = await pgPool.query('UPDATE action_items SET status = $1 WHERE id = $2', [status, id]);
    return (res.rowCount ?? 0) > 0;
  },

  // DAILY DIGESTS
  getDailyDigests: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<DailyDigest[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.daily_digests.filter(d => d.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM daily_digests WHERE workspace_id = $1 ORDER BY date DESC', [workspaceId]);
    return res.rows;
  },

  insertDailyDigest: async (digest: Omit<DailyDigest, 'id' | 'created_at'>): Promise<DailyDigest> => {
    const fullDigest: DailyDigest = {
      id: uuidv4(),
      ...digest,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.daily_digests.push(fullDigest);
      saveFallbackData();
      return fullDigest;
    }
    await pgPool.query(
      'INSERT INTO daily_digests (id, workspace_id, date, summary_text) VALUES ($1, $2, $3, $4)',
      [fullDigest.id, fullDigest.workspace_id, fullDigest.date, fullDigest.summary_text]
    );
    return fullDigest;
  },

  // IDEAS
  getIdeas: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<Idea[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.ideas.filter(i => i.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM ideas WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertIdea: async (idea: Omit<Idea, 'id' | 'created_at'>): Promise<Idea> => {
    const fullIdea: Idea = {
      id: uuidv4(),
      ...idea,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.ideas.push(fullIdea);
      saveFallbackData();
      return fullIdea;
    }
    await pgPool.query(
      'INSERT INTO ideas (id, workspace_id, title, description, source, status, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fullIdea.id, fullIdea.workspace_id, fullIdea.title, fullIdea.description, fullIdea.source, fullIdea.status, fullIdea.embedding]
    );
    return fullIdea;
  },

  getIdeaById: async (id: string): Promise<Idea | null> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.ideas.find(i => i.id === id) ?? null;
    }
    const res = await pgPool.query('SELECT * FROM ideas WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  },

  findSimilarIdeas: async (
    workspaceId: string,
    embedding: number[],
    options: {
      excludeId?: string;
      minScore?: number;
      limit?: number;
      status?: Idea['status'] | Idea['status'][];
    } = {}
  ): Promise<Array<{ idea: Idea; score: number }>> => {
    const { excludeId, minScore = 0.35, limit = 5, status } = options;
    const statusFilter = status
      ? (Array.isArray(status) ? status : [status])
      : null;

    const scoreIdea = (idea: Idea) => ({
      idea,
      score: cosineSimilarity(embedding, idea.embedding)
    });

    if (isFallbackMode || !pgPool) {
      return fallbackData.ideas
        .filter(i => i.workspace_id === workspaceId && i.embedding)
        .filter(i => i.id !== excludeId)
        .filter(i => !statusFilter || statusFilter.includes(i.status))
        .map(scoreIdea)
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    const statusClause = statusFilter
      ? `AND status IN (${statusFilter.map((_, i) => `$${i + 4}`).join(', ')})`
      : '';
    const params: any[] = [`[${embedding.join(',')}]`, workspaceId, excludeId ?? null];
    if (statusFilter) params.push(...statusFilter);

    const res = await pgPool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS score
       FROM ideas
       WHERE workspace_id = $2
         AND ($3::uuid IS NULL OR id != $3)
         ${statusClause}
       ORDER BY score DESC
       LIMIT ${limit}`,
      params
    );

    return res.rows
      .map((row: any) => ({
        idea: row as Idea,
        score: Number(row.score)
      }))
      .filter(r => r.score >= minScore);
  },

  updateIdea: async (
    id: string,
    fields: Partial<Pick<Idea, 'title' | 'description' | 'embedding' | 'status'>>
  ): Promise<Idea | null> => {
    if (isFallbackMode || !pgPool) {
      const idx = fallbackData.ideas.findIndex(i => i.id === id);
      if (idx === -1) return null;
      fallbackData.ideas[idx] = { ...fallbackData.ideas[idx], ...fields };
      saveFallbackData();
      return fallbackData.ideas[idx];
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return db.getIdeaById(id);

    const setQuery = keys.map((k, index) => `${k} = $${index + 1}`).join(', ');
    const params = keys.map(k => {
      const val = (fields as any)[k];
      return k === 'embedding' ? `[${(val as number[]).join(',')}]` : val;
    });
    params.push(id);

    await pgPool.query(`UPDATE ideas SET ${setQuery} WHERE id = $${params.length}`, params);
    return db.getIdeaById(id);
  },

  mergeIdeas: async (keepId: string, mergeId: string): Promise<Idea | null> => {
    if (keepId === mergeId) return null;

    const keep = await db.getIdeaById(keepId);
    const merge = await db.getIdeaById(mergeId);
    if (!keep || !merge) return null;
    if (merge.status === 'archived') return null;

    const mergeDate = new Date(merge.created_at).toLocaleDateString();
    const combinedDescription = [
      keep.description,
      `\n\n--- Merged from "${merge.title}" (${mergeDate}) ---\n`,
      merge.description
    ].join('').trim();

    await db.updateIdea(keepId, { description: combinedDescription });
    await db.updateIdeaStatus(mergeId, 'archived');

    return db.getIdeaById(keepId);
  },

  updateIdeaStatus: async (id: string, status: 'inbox' | 'project' | 'archived'): Promise<boolean> => {
    if (isFallbackMode || !pgPool) {
      const idx = fallbackData.ideas.findIndex(i => i.id === id);
      if (idx > -1) {
        fallbackData.ideas[idx].status = status;
        saveFallbackData();
        return true;
      }
      return false;
    }
    const res = await pgPool.query('UPDATE ideas SET status = $1 WHERE id = $2', [status, id]);
    return (res.rowCount ?? 0) > 0;
  },

  // PROJECTS
  getProjects: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<Project[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.projects.filter(p => p.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertProject: async (project: Omit<Project, 'id' | 'created_at'>): Promise<Project> => {
    const fullProj: Project = {
      id: uuidv4(),
      ...project,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.projects.push(fullProj);
      saveFallbackData();
      return fullProj;
    }
    await pgPool.query(
      'INSERT INTO projects (id, workspace_id, idea_id, title, description, owner, deadline, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [fullProj.id, fullProj.workspace_id, fullProj.idea_id, fullProj.title, fullProj.description, fullProj.owner, fullProj.deadline, fullProj.status]
    );
    return fullProj;
  },

  updateProject: async (id: string, fields: Partial<Pick<Project, 'deadline' | 'owner' | 'status' | 'title' | 'description'>>): Promise<boolean> => {
    if (isFallbackMode || !pgPool) {
      const idx = fallbackData.projects.findIndex(p => p.id === id);
      if (idx > -1) {
        fallbackData.projects[idx] = {
          ...fallbackData.projects[idx],
          ...fields
        };
        saveFallbackData();
        return true;
      }
      return false;
    }
    const keys = Object.keys(fields);
    if (keys.length === 0) return false;
    const setQuery = keys.map((k, index) => `${k} = $${index + 1}`).join(', ');
    const params = keys.map(k => (fields as any)[k]);
    params.push(id);
    const res = await pgPool.query(`UPDATE projects SET ${setQuery} WHERE id = $${params.length}`, params);
    return (res.rowCount ?? 0) > 0;
  },

  // TASKS
  getTasks: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<Task[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.tasks.filter(t => t.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM tasks WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertTask: async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> => {
    const fullTask: Task = {
      id: uuidv4(),
      ...task,
      created_at: new Date(),
      updated_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.tasks.push(fullTask);
      saveFallbackData();
      return fullTask;
    }
    await pgPool.query(
      'INSERT INTO tasks (id, workspace_id, project_id, title, assigned_to, status, dependencies) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fullTask.id, fullTask.workspace_id, fullTask.project_id, fullTask.title, fullTask.assigned_to, fullTask.status, fullTask.dependencies || []]
    );
    return fullTask;
  },

  updateTask: async (id: string, fields: Partial<Pick<Task, 'status' | 'dependencies' | 'assigned_to' | 'title'>>): Promise<boolean> => {
    if (isFallbackMode || !pgPool) {
      const idx = fallbackData.tasks.findIndex(t => t.id === id);
      if (idx > -1) {
        fallbackData.tasks[idx] = {
          ...fallbackData.tasks[idx],
          ...fields,
          updated_at: new Date()
        };
        saveFallbackData();
        return true;
      }
      return false;
    }
    
    // Construct dynamic set query for Postgres
    const keys = Object.keys(fields);
    if (keys.length === 0) return false;
    
    const setQuery = keys.map((k, index) => `${k} = $${index + 1}`).join(', ');
    const params = keys.map(k => (fields as any)[k]);
    params.push(id);
    
    const res = await pgPool.query(`UPDATE tasks SET ${setQuery}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`, params);
    return (res.rowCount ?? 0) > 0;
  },

  // GITHUB PRS
  getGithubPRs: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<GitHubPR[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.github_prs.filter(pr => pr.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM github_prs WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertGithubPR: async (pr: Omit<GitHubPR, 'id' | 'created_at'>): Promise<GitHubPR> => {
    const fullPR: GitHubPR = {
      id: uuidv4(),
      ...pr,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.github_prs.push(fullPR);
      saveFallbackData();
      return fullPR;
    }
    await pgPool.query(
      'INSERT INTO github_prs (id, workspace_id, pr_number, title, description, linked_project_id, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [fullPR.id, fullPR.workspace_id, fullPR.pr_number, fullPR.title, fullPR.description, fullPR.linked_project_id, fullPR.embedding]
    );
    return fullPR;
  },

  // ONBOARDING PDFS
  getOnboardingPDFs: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<OnboardingPDF[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.onboarding_pdfs.filter(pdf => pdf.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM onboarding_pdfs WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
    return res.rows;
  },

  insertOnboardingPDF: async (pdf: Omit<OnboardingPDF, 'id' | 'created_at'>): Promise<OnboardingPDF> => {
    const fullPDF: OnboardingPDF = {
      id: uuidv4(),
      ...pdf,
      created_at: new Date()
    };
    if (isFallbackMode || !pgPool) {
      fallbackData.onboarding_pdfs.push(fullPDF);
      saveFallbackData();
      return fullPDF;
    }
    await pgPool.query(
      'INSERT INTO onboarding_pdfs (id, workspace_id, new_hire_name, pdf_url) VALUES ($1, $2, $3, $4)',
      [fullPDF.id, fullPDF.workspace_id, fullPDF.new_hire_name, fullPDF.pdf_url]
    );
    return fullPDF;
  },

  // SEMANTIC VECTOR SEARCH
  vectorSearch: async (
    queryEmbedding: number[],
    workspaceId: string = DEFAULT_WORKSPACE_ID
  ): Promise<Array<{ type: string; id: string; text: string; score: number; details?: any }>> => {
    if (isFallbackMode || !pgPool) {
      const results: Array<{ type: string; id: string; text: string; score: number; details?: any }> = [];
      
      // Search in messages
      fallbackData.messages
        .filter(m => m.workspace_id === workspaceId && m.embedding)
        .forEach(m => {
          const score = cosineSimilarity(queryEmbedding, m.embedding);
          results.push({ type: 'message', id: m.id, text: `[${m.source.toUpperCase()}] ${m.sender}: ${m.text}`, score, details: m });
        });

      // Search in decisions
      fallbackData.decisions
        .filter(d => d.workspace_id === workspaceId && d.embedding)
        .forEach(d => {
          const score = cosineSimilarity(queryEmbedding, d.embedding);
          results.push({ type: 'decision', id: d.id, text: d.decision_text, score, details: d });
        });

      // Search in github_prs
      fallbackData.github_prs
        .filter(pr => pr.workspace_id === workspaceId && pr.embedding)
        .forEach(pr => {
          const score = cosineSimilarity(queryEmbedding, pr.embedding);
          results.push({ type: 'github_pr', id: pr.id, text: `[PR #${pr.pr_number}] ${pr.title}: ${pr.description}`, score, details: pr });
        });

      // Search in ideas
      fallbackData.ideas
        .filter(i => i.workspace_id === workspaceId && i.embedding)
        .forEach(i => {
          const score = cosineSimilarity(queryEmbedding, i.embedding);
          results.push({ type: 'idea', id: i.id, text: `[IDEA] ${i.title}: ${i.description}`, score, details: i });
        });

      // Sort by score descending and take top 5
      return results.sort((a, b) => b.score - a.score).slice(0, 5);
    }

    // In pgvector mode, we run vector similarity searches using cosine distance <=> (which matches 1 - cosine_similarity).
    // Note: cosine distance ordering is <=> ascending, i.e. 0 is identical, 2 is opposite.
    // So we query 1 - (embedding <=> $1) as score.
    const queryStr = `
      SELECT 'message' as type, id, CONCAT('[', source, '] ', sender, ': ', text) as text, 1 - (embedding <=> $1::vector) as score, row_to_json(m) as details
      FROM messages m WHERE workspace_id = $2
      UNION ALL
      SELECT 'decision' as type, id, decision_text as text, 1 - (embedding <=> $1::vector) as score, row_to_json(d) as details
      FROM decisions d WHERE workspace_id = $2
      UNION ALL
      SELECT 'github_pr' as type, id, CONCAT('[PR #', pr_number, '] ', title, ': ', description) as text, 1 - (embedding <=> $1::vector) as score, row_to_json(p) as details
      FROM github_prs p WHERE workspace_id = $2
      UNION ALL
      SELECT 'idea' as type, id, CONCAT('[IDEA] ', title, ': ', description) as text, 1 - (embedding <=> $1::vector) as score, row_to_json(i) as details
      FROM ideas i WHERE workspace_id = $2
      ORDER BY score DESC
      LIMIT 5;
    `;
    
    // Convert embedding to string formatted for pgvector: '[0.1,0.2,0.3,...]'
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const res = await pgPool.query(queryStr, [vectorStr, workspaceId]);
    return res.rows.map(r => ({
      type: r.type,
      id: r.id,
      text: r.text,
      score: Number(r.score),
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
    }));
  },

  // USER & AUTH EXTENSIONS
  getUserByEmail: async (email: string): Promise<User | null> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.users.find(u => u.email === email) || null;
    }
    const res = await pgPool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] || null;
  },

  createUser: async (user: Omit<User, 'created_at'>): Promise<User> => {
    const newUser: User = { ...user, created_at: new Date() };
    if (isFallbackMode || !pgPool) {
      fallbackData.users.push(newUser);
      saveFallbackData();
      return newUser;
    }
    await pgPool.query(
      'INSERT INTO users (id, workspace_id, email, password) VALUES ($1, $2, $3, $4)',
      [newUser.id, newUser.workspace_id, newUser.email, newUser.password || '']
    );
    return newUser;
  },

  getUsers: async (workspaceId: string = DEFAULT_WORKSPACE_ID): Promise<User[]> => {
    if (isFallbackMode || !pgPool) {
      return fallbackData.users.filter(u => u.workspace_id === workspaceId);
    }
    const res = await pgPool.query('SELECT * FROM users WHERE workspace_id = $1', [workspaceId]);
    return res.rows;
  },

  createSession: async (session: UserSession): Promise<UserSession> => {
    if (isFallbackMode || !pgPool) {
      if (!fallbackData.user_sessions) fallbackData.user_sessions = [];
      fallbackData.user_sessions.push(session);
      saveFallbackData();
      return session;
    }
    await pgPool.query(
      'INSERT INTO user_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [session.token, session.user_id, session.expires_at]
    );
    return session;
  },

  getSessionUser: async (token: string): Promise<User | null> => {
    if (isFallbackMode || !pgPool) {
      if (!fallbackData.user_sessions) fallbackData.user_sessions = [];
      const sess = fallbackData.user_sessions.find(s => s.token === token);
      if (!sess) return null;
      if (new Date(sess.expires_at).getTime() < Date.now()) {
        fallbackData.user_sessions = fallbackData.user_sessions.filter(s => s.token !== token);
        saveFallbackData();
        return null;
      }
      return fallbackData.users.find(u => u.id === sess.user_id) || null;
    }
    const res = await pgPool.query(
      'SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP',
      [token]
    );
    return res.rows[0] || null;
  },

  addProjectMember: async (member: ProjectMember): Promise<ProjectMember> => {
    if (isFallbackMode || !pgPool) {
      if (!fallbackData.project_members) fallbackData.project_members = [];
      fallbackData.project_members = fallbackData.project_members.filter(m => !(m.user_id === member.user_id && m.project_id === member.project_id));
      fallbackData.project_members.push(member);
      saveFallbackData();
      return member;
    }
    await pgPool.query(
      'INSERT INTO project_members (user_id, project_id, role) VALUES ($1, $2, $3) ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role',
      [member.user_id, member.project_id, member.role]
    );
    return member;
  },

  getProjectMembers: async (projectId: string): Promise<ProjectMember[]> => {
    if (isFallbackMode || !pgPool) {
      if (!fallbackData.project_members) fallbackData.project_members = [];
      return fallbackData.project_members.filter(m => m.project_id === projectId);
    }
    const res = await pgPool.query('SELECT * FROM project_members WHERE project_id = $1', [projectId]);
    return res.rows;
  },

  getUserProjects: async (userId: string): Promise<Project[]> => {
    if (isFallbackMode || !pgPool) {
      if (!fallbackData.project_members) fallbackData.project_members = [];
      const projIds = fallbackData.project_members.filter(m => m.user_id === userId).map(m => m.project_id);
      return fallbackData.projects.filter(p => projIds.includes(p.id));
    }
    const res = await pgPool.query(
      'SELECT p.* FROM projects p JOIN project_members m ON p.id = m.project_id WHERE m.user_id = $1',
      [userId]
    );
    return res.rows;
  }
};