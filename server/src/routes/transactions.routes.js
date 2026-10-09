const express = require('express');
const router = express.Router();
const multer = require('multer');
const transactionController = require('../controllers/transactionController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const requireRole = require('../middleware/requireRole');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.use(requireAuth);

// Remaining Inventory (Strictly Read-Only, never directly editable)
router.get('/remaining', requirePermission(['read_only', 'read_write']), transactionController.getRemaining);

// Received Transactions
router.get('/received', requirePermission(['read_only', 'read_write']), transactionController.getReceived);
router.post('/received', requirePermission(['read_write']), upload.single('voucher_image'), transactionController.createReceived);
router.put('/received/:id', requirePermission(['read_write']), upload.single('voucher_image'), transactionController.updateReceived);
router.delete('/received/:id', requireRole(['super_admin', 'local_admin', 'unit_head']), transactionController.deleteReceived);

// Expended Transactions
router.get('/expended', requirePermission(['read_only', 'read_write']), transactionController.getExpended);
router.post('/expended', requirePermission(['read_write']), transactionController.createExpended);
router.put('/expended/:id', requirePermission(['read_write']), transactionController.updateExpended);
router.delete('/expended/:id', requireRole(['super_admin', 'local_admin', 'unit_head']), transactionController.deleteExpended);

module.exports = router;
