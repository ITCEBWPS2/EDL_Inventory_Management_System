const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/mark-request-read', notificationController.markRequestAsRead);

module.exports = router;

