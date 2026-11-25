const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');

router.use(requireAuth);

// Issued / Destroyed
router.get('/issued-destroyed-candidates', requirePermission('view_inventory'), verificationController.getIssuedDestroyedCandidates);
router.get('/issued-destroyed', requirePermission('view_inventory'), verificationController.getIssuedDestroyed);
router.post('/issued-destroyed', requirePermission('add_inventory'), verificationController.createIssuedDestroyed);
router.get('/issued-destroyed/:id', requirePermission('view_inventory'), verificationController.getIssuedDestroyedById);
router.put('/issued-destroyed/:id', requirePermission('update_inventory'), verificationController.updateIssuedDestroyed);
router.delete('/issued-destroyed/:id', requirePermission('delete_inventory'), verificationController.deleteIssuedDestroyed);

// Verifications
router.get('/inventory-items', requirePermission('view_inventory'), verificationController.getVerificationInventoryItems);
router.get('/history-items', requirePermission('view_inventory'), verificationController.getHistoryItems);

// Draft Verifications (must precede /:id)
router.get('/draft', requirePermission('view_inventory'), verificationController.getDraftVerification);
router.put('/draft', requirePermission('update_inventory'), verificationController.saveDraftHeader);
router.put('/draft/items/:itemId', requirePermission('update_inventory'), verificationController.saveDraftItem);
router.post('/draft/save-all', requirePermission('update_inventory'), verificationController.saveDraftAllItems);
router.delete('/draft/test-items', requirePermission('update_inventory'), verificationController.clearDraftTestItems);
router.delete('/draft', requirePermission('update_inventory'), verificationController.discardDraft);

router.get('/', requirePermission('view_inventory'), verificationController.getVerifications);
router.get('/:id', requirePermission('view_inventory'), verificationController.getVerificationById);
router.post('/', requirePermission('add_inventory'), verificationController.createVerification);
router.put('/:id', requirePermission('update_inventory'), verificationController.updateVerification);
router.post('/:id/confirm', requirePermission('update_inventory'), verificationController.confirmVerification);

module.exports = router;
