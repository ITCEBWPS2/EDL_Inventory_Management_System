const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const transactionController = require('../controllers/transactionController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const requireRole = require('../middleware/requireRole');
const env = require('../config/env');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_ATTACHMENT_BYTES },
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedMime.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  }
});

const handleVoucherUpload = (req, res, next) => {
  upload.single('voucher_image')(req, res, (err) => {
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

// Public or authenticated config endpoint for transaction settings
router.get('/config', transactionController.getConfig);

router.use(requireAuth);

// Remaining Inventory (Strictly Read-Only, never directly editable)
router.get('/remaining', requirePermission('view_inventory'), transactionController.getRemaining);

// Received Transactions
router.get('/received', requirePermission('view_inventory'), transactionController.getReceived);
router.post('/received', requirePermission('add_inventory'), handleVoucherUpload, transactionController.createReceived);
router.put('/received/:id', requirePermission('update_inventory'), handleVoucherUpload, transactionController.updateReceived);
router.delete('/received/:id', requirePermission('delete_inventory'), transactionController.deleteReceived);

// Expended Transactions
router.get('/expended', requirePermission('view_inventory'), transactionController.getExpended);
router.post('/expended', requirePermission('add_inventory'), transactionController.createExpended);
router.put('/expended/:id', requirePermission('update_inventory'), transactionController.updateExpended);
router.delete('/expended/:id', requirePermission('delete_inventory'), transactionController.deleteExpended);

module.exports = router;
