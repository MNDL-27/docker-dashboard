import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionMiddleware } from './config/session';
import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import projectRoutes from './routes/projects';
import inviteRoutes from './routes/invites';
import hostRoutes from './routes/hosts';
import agentRoutes from './routes/agent';
import { requireAuth } from './middleware/auth';
import { handleUpgrade } from './websocket/server';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(sessionMiddleware);

// Routes
app.use('/auth', authRoutes);
app.use('/organizations', organizationRoutes);
app.use('/organizations', projectRoutes);
app.use('/', inviteRoutes);
app.use('/hosts', hostRoutes);
app.use('/agent', agentRoutes);

// Protected route example
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cloud-api', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
  handleUpgrade(request, socket, head, sessionMiddleware);
});

export default app;
