const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');

// Import routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const unitsRoutes = require('./routes/units.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const verificationsRoutes = require('./routes/verifications.routes');
const reportsRoutes = require('./routes/reports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const vouchersRoutes = require('./routes/vouchers.routes');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', env.CLIENT_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'EDL Inventory Management System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/verifications', verificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vouchers', vouchersRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.method} ${req.originalUrl} not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Only listen if run directly (not imported by tests)
if (require.main === module) {
  const { connect } = require('./config/mongo');
  connect().then(() => {
    app.listen(env.PORT, () => {
      console.log(`⚡ EDL IMS Express Server running on http://localhost:${env.PORT}`);
      console.log(`⚡ Environment: ${env.NODE_ENV}`);
    });
  }).catch((err) => {
    console.error('Failed to start server due to MongoDB connection error:', err);
    process.exit(1);
  });
}

module.exports = app;
