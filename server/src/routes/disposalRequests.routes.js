const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const disposalController = require('../controllers/disposalController');
const requireAuth = require('../middleware/requireAuth');
const env = require('../config/env');

// Multer setup for disposal attachments (JPG, PNG, WebP, PDF up to 800 KB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_ATTACHMENT_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Only JPG, PNG, WebP, and PDF documents are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  }
});

const handleAttachmentUpload = (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (err) {
      if ((err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') || err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'LIMIT_FILE_SIZE',
          message: `File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE_TYPE',
          message: err.message
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.'
      });
    }
    next();
  });
};

// Serve attachments publicly or with token
router.get('/attachment/:filename', disposalController.getAttachment);

// Authenticated endpoints
router.use(requireAuth);

// 1. List requests (scoped by permissions matrix)
router.get('/', disposalController.listRequests);

// 2. Safe Overview endpoint (accessible to every authenticated user)
router.get('/:id/overview', disposalController.getRequestOverview);

// 3. Get single request full details (requires canViewDisposalDetails)
router.get('/:id', disposalController.getRequestById);

// 4. Create draft (requires canCreateDisposalRequest)
router.post('/', disposalController.createDraft);

// 5. Update draft (requires canEditDraft)
router.put('/:id', disposalController.updateDraft);

// 6. Delete draft (requires canDeleteDraft)
router.delete('/:id', disposalController.deleteDraft);

// 7. Submit draft -> submitted (requires canSubmitRequest)
router.post('/:id/submit', disposalController.submitRequest);

// 8. Record Board Appointment (requires canHandleDisposalSteps)
router.post('/:id/board-appointment', disposalController.recordBoardAppointment);

// 9. Record Committee Decision (requires canHandleDisposalSteps)
router.post(
  '/:id/committee-decision',
  handleAttachmentUpload,
  disposalController.recordCommitteeDecision
);

// 10. Record Disposal action: destruction or tender (requires canHandleDisposalSteps)
router.post(
  '/:id/disposal-record',
  handleAttachmentUpload,
  disposalController.recordDisposalAction
);
router.post(
  '/:id/disposal-action',
  handleAttachmentUpload,
  disposalController.recordDisposalAction
);

// 11. Revert last step (requires canHandleDisposalSteps)
router.post('/:id/revert', disposalController.revertLastStep);
router.post('/:id/revert-step', disposalController.revertLastStep);

module.exports = router;
