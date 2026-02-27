import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionMiddleware } from './config/session';
import authRoutes from './routes/auth';
import { requireAuth } from './middleware/auth';

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

// Protected route example
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
