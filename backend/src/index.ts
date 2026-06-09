import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { initializeDatabase } from './db';
import { initializeClaude } from './services/claude';
import { initializeSocket } from './services/socket';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Logging Helper
const log = (level: string, message: string) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [${level}] [SERVER] - ${message}`);
};

// Request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] [INFO] [HTTP] - ${req.method} ${req.url}`);
  next();
});

// Configure Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes (Mount on both root and /api for absolute safety and frontend prefix match)
app.use('/', apiRouter);
app.use('/api', apiRouter);

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  log('ERROR', `Express Error Handler Caught: ${err.message}`);
  console.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred on the server.'
  });
});

// Create Server
const server = createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start Services
async function startServer() {
  log('INFO', 'Initializing backend services...');
  
  // Init DB (falls back to local JSON if DB url is missing)
  await initializeDatabase();
  
  // Init Claude Client (falls back to regex rules if API key is missing)
  initializeClaude();

  server.listen(port, () => {
    log('INFO', `StartupHub Backend listening on port ${port}`);
    log('INFO', `Socket.io active. Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Graceful shutdown and uncaught exceptions
process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught Exception: ${err.message}`);
  console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

startServer();
