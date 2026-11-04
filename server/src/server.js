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

// Dynamic CORS configuration supporting multi-origin lists and dev localhost wildcard
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, tests, server-to-server, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Support multiple allowed origins configured via comma-separated CLIENT_URL
    const configuredOrigins = (env.CLIENT_URL || '')
      .split(',')
      .map(url => url.trim())
      .filter(Boolean);

    // In development/test mode, allow any localhost or 127.0.0.1 on any port
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isDevAllowed = env.NODE_ENV !== 'production' && isLocalhost;

    if (isDevAllowed || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject unknown origins without throwing a 500 error (respond without CORS headers)
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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
