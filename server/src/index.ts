import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import salesRoutes from './routes/sales.routes';
import customersRoutes from './routes/customers.routes';
import suppliersRoutes from './routes/suppliers.routes';
import purchasesRoutes from './routes/purchases.routes';
import reportsRoutes from './routes/reports.routes';
import shiftsRoutes from './routes/shifts.routes';
import syncRoutes from './routes/sync.routes';
import usersRoutes from './routes/users.routes';
import paymentsRoutes from './routes/payments.routes';
import auditRoutes from './routes/audit.routes';

dotenv.config();

const app = express();

// Trust proxy (Railway/Cloudflare) so req.ip returns real client IP
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Strict CORS — only allow your domain
const ALLOWED_ORIGINS = [
  'https://lion-heart-pos-production-6a1f.up.railway.app',
  'http://localhost:3000',
  'http://localhost:5000',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

// Global rate limiter — 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// Strict rate limiter for auth endpoints — 20 per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Body size limit — 1MB max
app.use(express.json({ limit: '1mb' }));

// Webhook route needs raw body for Paystack signature verification — mount BEFORE json parser
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers['x-paystack-signature'] as string;

  // Block webhook if signature or secret key is missing
  if (!signature || !PAYSTACK_SECRET_KEY) {
    return res.status(401).json({ error: 'Webhook not configured' });
  }

  const rawBody = req.body as Buffer;
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(hash, 'hex');
  const receivedBuf = Buffer.from(signature, 'hex');
  if (sigBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(sigBuf, receivedBuf)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  next();
});

// Routes with auth-specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/audit-log', auditRoutes);

// Health check (no sensitive data)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Error handler (no info leakage)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export default app;
