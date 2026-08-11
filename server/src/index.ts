import express from 'express';
import cors from 'cors';
import path from 'path';
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

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Lion Heart POS server running on port ${config.port}`);
});

export default app;
