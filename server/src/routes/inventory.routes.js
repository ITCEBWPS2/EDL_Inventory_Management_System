const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const requireRole = require('../middleware/requireRole');

router.use(requireAuth);

// Categories
router.get('/categories', requirePermission(['read_only', 'read_write']), inventoryController.getCategories);
router.post('/categories', requireRole(['super_admin', 'local_admin']), inventoryController.createCategory);

// Items List & Detail: accessible to read_only and read_write (blocks no_permission)
router.get('/next-serial-number', requirePermission(['read_only', 'read_write']), inventoryController.getNextSerialNumber);
router.get('/', requirePermission(['read_only', 'read_write']), inventoryController.getItems);
router.get('/:id', requirePermission(['read_only', 'read_write']), inventoryController.getItemById);

// Mutations: requires read_write permission (blocks read_only and no_permission)
router.post('/', requirePermission(['read_write']), inventoryController.createItem);
router.put('/:id', requirePermission(['read_write']), inventoryController.updateItem);
router.delete('/:id', requirePermission(['read_write']), inventoryController.deleteItem);

module.exports = router;
