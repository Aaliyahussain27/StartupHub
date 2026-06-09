import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db, DEFAULT_WORKSPACE_ID } from '../db';
import { detectBlockers } from './claude';

let io: SocketIOServer | null = null;

const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [SOCKET-SERVICE] - ${message}`);
};

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
