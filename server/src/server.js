const express = require('express');
const path = require('path');
const fs = require('fs');
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
const auditLogsRoutes = require('./routes/auditLogs.routes');
const disposalRequestsRoutes = require('./routes/disposalRequests.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const auditMiddleware = require('./middleware/auditMiddleware');

const app = express();

// Configure trust proxy based on TRUST_PROXY environment setting
if (env.TRUST_PROXY !== false && env.TRUST_PROXY !== undefined) {
  app.set('trust proxy', env.TRUST_PROXY);
} else {
  app.set('trust proxy', false);
}

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
app.use(auditMiddleware);

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
app.post('/api/audit-logs/client-error', (req, res) => {
  console.error('[CLIENT ERROR LOGGED]:', JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/disposal-requests', disposalRequestsRoutes);
app.use('/api/disposal', disposalRequestsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Serve static React client (when SERVE_CLIENT is enabled and client/dist exists)
const distPath = path.resolve(__dirname, '../../client/dist');
const indexPath = path.join(distPath, 'index.html');

if (env.SERVE_CLIENT) {
  if (fs.existsSync(indexPath)) {
    // 1) Serve static assets with sensible cache headers:
    //    hashed files in /assets get long cache (1y immutable); index.html is no-cache
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html') || path.basename(filePath) === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );

    // 2) Fallback for React router (plain middleware, works on Express 4 & 5):
    //    For any GET request that is NOT /api/* and NOT an uploads/static path and accepts HTML, respond with index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      if (req.accepts('html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(indexPath);
      }
      return next();
    });

    console.log(`📦 Serving React client from: ${distPath}`);
  } else {
    console.warn(`⚠️ SERVE_CLIENT is true, but client build was not found at ${distPath}. Run "npm --prefix client run build" to build the client.`);
  }
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.method} ${req.originalUrl} not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    const env = require('./config/env');
    return res.status(413).json({
      success: false,
      error: 'LIMIT_FILE_SIZE',
      message: `File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`
    });
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FILE_TYPE',
      message: err.message || 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
    });
  }
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
