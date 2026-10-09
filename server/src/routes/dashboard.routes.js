const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

router.use(requireAuth);
// Blocks employees with 'no_permission'
router.use(requirePermission(['read_only', 'read_write']));

router.get('/', dashboardController.getDashboardData);

module.exports = router;
