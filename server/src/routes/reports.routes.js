const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

router.use(requireAuth);
router.use(requirePermission(['read_only', 'read_write']));

router.get('/inventory', reportController.getCurrentInventory);
router.get('/transactions', reportController.getTransactionHistory);
router.get('/verification', reportController.getVerificationAudit);

module.exports = router;
