const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

router.use(requireAuth);

router.get('/', unitController.getUnits);
router.get('/tree', unitController.getUnitTree);

// Creation and editing restricted to Super Admin and Local Admin
router.post('/', requireRole(['super_admin', 'local_admin']), unitController.createUnit);
router.put('/:id', requireRole(['super_admin', 'local_admin']), unitController.updateUnit);

module.exports = router;
