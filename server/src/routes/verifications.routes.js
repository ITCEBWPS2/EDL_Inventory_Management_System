const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

router.use(requireAuth);

// Issued / Destroyed
router.get('/issued-destroyed', requirePermission(['read_only', 'read_write']), verificationController.getIssuedDestroyed);
router.post('/issued-destroyed', requirePermission(['read_write']), verificationController.createIssuedDestroyed);

// Verifications
router.get('/history-items', requirePermission(['read_only', 'read_write']), verificationController.getHistoryItems);
router.get('/', requirePermission(['read_only', 'read_write']), verificationController.getVerifications);
router.get('/:id', requirePermission(['read_only', 'read_write']), verificationController.getVerificationById);
router.post('/', requirePermission(['read_write']), verificationController.createVerification);
router.put('/:id', requirePermission(['read_write']), verificationController.updateVerification);
router.post('/:id/confirm', requirePermission(['read_write']), verificationController.confirmVerification);

module.exports = router;
