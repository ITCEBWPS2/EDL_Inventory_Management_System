const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

// Users management routes: Super Admin and Local Admin only
router.use(requireAuth);
router.use(requireRole(['super_admin', 'local_admin']));

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/status', userController.toggleStatus);
router.delete('/:id', userController.deleteUser);

module.exports = router;
