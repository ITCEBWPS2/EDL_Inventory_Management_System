const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/register', authLimiter, authController.register);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);
router.post('/update-password', passwordResetLimiter, authController.updatePassword);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.get('/me', requireAuth, authController.getMe);

// Role Permissions Matrix
router.get('/permissions/matrix', requireAuth, authController.getPermissionsMatrix);
router.put('/permissions/matrix', requireAuth, requireRole(['super_admin', 'local_admin']), requirePermission('manage_permissions'), authController.updatePermissionsMatrix);

module.exports = router;
