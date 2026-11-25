const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

// All audit log endpoints require authentication and authorization (Super Admin, Local Admin, Unit Head)
router.use(requireAuth);
router.use(requireRole(['super_admin', 'local_admin', 'unit_head']));

// Read and query endpoints (append-only: no update or delete routes exist)
router.get('/', auditLogController.getLogs);
router.get('/filters', auditLogController.getFilters);
router.get('/export', auditLogController.exportCSV);
router.get('/:id', auditLogController.getLogById);
router.post('/log-action', auditLogController.logAction);

module.exports = router;

