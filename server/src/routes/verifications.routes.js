const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

router.use(requireAuth);

// Issued / Destroyed
router.get('/issued-destroyed-candidates', requirePermission(['read_only', 'read_write']), verificationController.getIssuedDestroyedCandidates);
router.get('/issued-destroyed', requirePermission(['read_only', 'read_write']), verificationController.getIssuedDestroyed);
router.post('/issued-destroyed', requirePermission(['read_write']), verificationController.createIssuedDestroyed);
router.get('/issued-destroyed/:id', requirePermission(['read_only', 'read_write']), verificationController.getIssuedDestroyedById);
router.put('/issued-destroyed/:id', requirePermission(['read_write']), verificationController.updateIssuedDestroyed);
router.delete('/issued-destroyed/:id', requirePermission(['read_write']), verificationController.deleteIssuedDestroyed);

// Verifications
router.get('/inventory-items', requirePermission(['read_only', 'read_write']), verificationController.getVerificationInventoryItems);
router.get('/history-items', requirePermission(['read_only', 'read_write']), verificationController.getHistoryItems);

// Draft Verifications (must precede /:id)
router.get('/draft', requirePermission(['read_only', 'read_write']), verificationController.getDraftVerification);
router.put('/draft', requirePermission(['read_write']), verificationController.saveDraftHeader);
router.put('/draft/items/:itemId', requirePermission(['read_write']), verificationController.saveDraftItem);
router.post('/draft/save-all', requirePermission(['read_write']), verificationController.saveDraftAllItems);
router.delete('/draft', requirePermission(['read_write']), verificationController.discardDraft);

router.get('/', requirePermission(['read_only', 'read_write']), verificationController.getVerifications);
router.get('/:id', requirePermission(['read_only', 'read_write']), verificationController.getVerificationById);
router.post('/', requirePermission(['read_write']), verificationController.createVerification);
router.put('/:id', requirePermission(['read_write']), verificationController.updateVerification);
router.post('/:id/confirm', requirePermission(['read_write']), verificationController.confirmVerification);

module.exports = router;
