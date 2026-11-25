const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const requireRole = require('../middleware/requireRole');

router.use(requireAuth);

// Categories
router.get('/categories', requirePermission('view_inventory'), inventoryController.getCategories);
router.post('/categories', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.createCategory);
router.put('/categories/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.updateCategory);
router.delete('/categories/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.deleteCategory);

// Item Types (Sub-categories)
router.get('/types', requirePermission('view_inventory'), inventoryController.getItemTypes);
router.post('/types', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.createItemType);
router.put('/types/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.updateItemType);
router.delete('/types/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.deleteItemType);
router.put('/subcategories/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.updateItemType);
router.delete('/subcategories/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.deleteItemType);

// Sub-category Item Types (e.g. Bench under Chairs)
router.get('/item-types', requirePermission('view_inventory'), inventoryController.getCustomItemTypes);
router.post('/item-types', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.createCustomItemType);
router.put('/item-types/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.updateCustomItemType);
router.delete('/item-types/:id', requireRole(['super_admin', 'local_admin'], 'Only Super Admin and Local Admin can manage item categories and types.'), inventoryController.deleteCustomItemType);

// Items List & Detail: accessible to users with view_inventory permission
router.get('/next-serial-number', requirePermission('view_inventory'), inventoryController.getNextSerialNumber);
router.get('/', requirePermission('view_inventory'), inventoryController.getItems);
router.get('/:id', requirePermission('view_inventory'), inventoryController.getItemById);

// Mutations: requires matching granular permissions
router.post('/', requirePermission('add_inventory'), inventoryController.createItem);
router.put('/:id', requirePermission('update_inventory'), inventoryController.updateItem);
router.delete('/:id', requirePermission('delete_inventory'), inventoryController.deleteItem);

module.exports = router;
