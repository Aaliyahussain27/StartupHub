import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db, DEFAULT_WORKSPACE_ID } from '../db';
import { detectBlockers } from './claude';

let io: SocketIOServer | null = null;

const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [SOCKET-SERVICE] - ${message}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// MOMENTUM + BLOCKER ALERT CHECK
// Runs on a 5-minute interval after server start.
// Emits `momentum_alert` and `blocker_escalation` events to workspace rooms.
// ─────────────────────────────────────────────────────────────────────────────
const STALL_DAYS = 0;            // TEST: set to 3 for production (3 days)
const BLOCKER_ESCALATE_HRS = 0;  // TEST: set to 24 for production (24 hours)

async function runAlertChecks() {
  if (!io) return;

  try {
    // We check the default workspace; extend to multi-workspace by iterating db.getWorkspaces()
    const workspaceId = DEFAULT_WORKSPACE_ID;

    const tasks    = await db.getTasks(workspaceId);
    const projects = await db.getProjects(workspaceId);

    // ── 1. MOMENTUM ALERTS ───────────────────────────────────────────────────
    const now = Date.now();
    const stalledProjects: { id: string; title: string; daysSinceActivity: number }[] = [];

    for (const project of projects) {
      const projTasks = tasks.filter(t => t.project_id === project.id);
      if (projTasks.length === 0) continue;

      // Find the most recent task update time
      const lastActivityMs = projTasks.reduce((max, t) => {
        const ts = t.updated_at ? new Date(t.updated_at).getTime() : new Date(t.created_at).getTime();
        return ts > max ? ts : max;
      }, 0);

      const daysSince = (now - lastActivityMs) / (1000 * 60 * 60 * 24);
      if (daysSince >= STALL_DAYS) {
        stalledProjects.push({
          id: project.id,
          title: project.title,
          daysSinceActivity: Math.floor(daysSince),
        });
      }
    }

    if (stalledProjects.length > 0) {
      log('WARN', `Momentum alert: ${stalledProjects.length} stalled project(s)`);
      io.to(workspaceId).emit('momentum_alert', { stalledProjects });
    }

    // ── 2. BLOCKER ESCALATION ─────────────────────────────────────────────────
    const blockerReport = await detectBlockers(tasks);
    const escalatedBlockers: { taskId: string; title: string; hoursBlocked: number }[] = [];

    for (const blocker of blockerReport.blockedTasks) {
      // Use the blocked task's updated_at as the "blocked since" timestamp
      const blockedTask = tasks.find(t => t.id === blocker.taskId);
      if (!blockedTask) continue;
      const blockedSince = blockedTask.updated_at
        ? new Date(blockedTask.updated_at).getTime()
        : new Date(blockedTask.created_at).getTime();
      const hoursBlocked = (now - blockedSince) / (1000 * 60 * 60);

      if (hoursBlocked >= BLOCKER_ESCALATE_HRS) {
        escalatedBlockers.push({
          taskId: blocker.taskId,
          title: blockedTask.title,
          hoursBlocked: Math.floor(hoursBlocked),
        });
      }
    }

    if (escalatedBlockers.length > 0) {
      log('WARN', `Blocker escalation: ${escalatedBlockers.length} task(s) blocked > ${BLOCKER_ESCALATE_HRS}h`);
      io.to(workspaceId).emit('blocker_escalation', { escalatedBlockers });
    }
  } catch (err: any) {
    log('ERROR', `Alert check failed: ${err.message}`);
  }
}

export function initializeSocket(server: HttpServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    log('INFO', `Client connected: ${socket.id}`);

    // Join a workspace room
    socket.on('join_workspace', (workspaceId: string) => {
      const room = workspaceId || DEFAULT_WORKSPACE_ID;
      socket.join(room);
      log('INFO', `Socket ${socket.id} joined workspace room: ${room}`);
      
      // Send initial data update upon joining
      sendDashboardUpdate(room, socket);
    });

    socket.on('disconnect', () => {
      log('INFO', `Client disconnected: ${socket.id}`);
    });
  });

  // Runs every 30 SECONDS for testing (change to 5 * 60 * 1000 for production)
  const ALERT_INTERVAL_MS = 30 * 1000;
  setInterval(runAlertChecks, ALERT_INTERVAL_MS);
  log('INFO', `Alert checker scheduled every ${ALERT_INTERVAL_MS / 1000}s`);

  return io;
}

// Fetch dashboard state and return it formatted
export async function getDashboardState(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  try {
    const decisions = await db.getDecisions(workspaceId);
    const actionItems = await db.getActionItems(workspaceId);
    const tasks = await db.getTasks(workspaceId);
    const ideas = await db.getIdeas(workspaceId);
    const projects = await db.getProjects(workspaceId);
    const messages = await db.getMessages(workspaceId);
    const githubPrs = await db.getGithubPRs(workspaceId);

    // Blocker detection
    const blockerReport = await detectBlockers(tasks);

    return {
      decisions,
      actionItems,
      tasks,
      ideas,
      projects,
      messages: messages.slice(0, 50), // Send last 50 messages
      githubPrs,
      blockers: blockerReport.blockedTasks,
      circularDependencies: blockerReport.circularDependencies
    };
  } catch (err: any) {
    log('ERROR', `Failed to get dashboard state: ${err.message}`);
    return {
      decisions: [],
      actionItems: [],
      tasks: [],
      ideas: [],
      projects: [],
      messages: [],
      githubPrs: [],
      blockers: [],
      circularDependencies: []
    };
  }
}

// Send updates to a specific socket
export async function sendDashboardUpdate(workspaceId: string, socket: Socket) {
  const state = await getDashboardState(workspaceId);
  socket.emit('dashboard_update', state);
}

// Broadcast updates to all sockets in a workspace room
export async function broadcastDashboardUpdate(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  if (!io) {
    log('WARN', 'Socket.io server not initialized. Cannot broadcast.');
    return;
  }
  
  log('INFO', `Broadcasting dashboard update for workspace: ${workspaceId}`);
  const state = await getDashboardState(workspaceId);
  io.to(workspaceId).emit('dashboard_update', state);
}
