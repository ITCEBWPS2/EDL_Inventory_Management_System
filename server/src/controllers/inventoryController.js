const db = require('../services/db');

const inventoryController = {
  /**
   * Get inventory items scoped to user's authorized units
   */
  async getItems(req, res) {
    try {
      const { unit_id, category, category_id, search, sub_type, type, all } = req.query;
      const targetSubType = sub_type || type || null;
      const isAll = all === 'true' || all === true;

      let authorizedUnits = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !isAll) {
        authorizedUnits = req.user.unitIds || [];
        if (unit_id && !authorizedUnits.includes(unit_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: You do not have access to this unit.'
          });
        }
      }

      const targetUnitIds = isAll ? null : (unit_id ? [unit_id] : authorizedUnits);
      const items = await db.getInventoryItems(targetUnitIds, category, search, category_id, targetSubType);

      return res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Get inventory items error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch inventory items.' });
    }
  },

  async getItemById(req, res) {
    try {
      const { id } = req.params;
      const item = await db.getInventoryItemById(id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Inventory item not found.' });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorizedUnits = req.user.unitIds || [];
        if (!authorizedUnits.includes(item.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this item\'s unit.' });
        }
      }

      return res.json({ success: true, data: item });
    } catch (error) {
      console.error('Get item by id error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve item.' });
    }
  },

  async createItem(req, res) {
    try {
      const {
        item_name,
        item_code,
        category,
        category_id,
        unit_id,
        quantity,
        serial_number,
        status,
        sub_type,
        sub_classification,
        description,
        brand,
        serial_numbers,
        is_batch,
        batch_label,
        manufacturer_serial_numbers
      } = req.body;

      if (!item_name || !item_code || !category || !unit_id) {
        return res.status(400).json({
          success: false,
          message: 'item_name, item_code, category, and unit_id are required fields.'
        });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorizedUnits = req.user.unitIds || [];
        if (!authorizedUnits.includes(unit_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: You do not have permission to add items to this unit.'
          });
        }
      }

      const categories = await db.getCategories();
      const matchedCat = categories.find(c => c.name.toLowerCase() === category.toLowerCase() || c.id === category_id);

      const isBatch = Boolean(is_batch || (Array.isArray(serial_numbers) && serial_numbers.length > 1) || Number(quantity) > 1);
      const qty = Number(quantity || 0);
      let mfgList = null;
      if (Array.isArray(manufacturer_serial_numbers)) {
        mfgList = manufacturer_serial_numbers.map(s => (s ? String(s).trim() : ''));
        while (mfgList.length < Math.max(1, qty)) mfgList.push('');
        mfgList = mfgList.slice(0, Math.max(1, qty));
      } else if (serial_number) {
        mfgList = [String(serial_number).trim()];
      }

      const newItem = await db.createInventoryItem({
        item_name,
        item_code,
        category,
        category_id: matchedCat?.id || null,
        sub_type: sub_type || null,
        sub_classification: sub_classification || null,
        description: description || null,
        brand: brand || null,
        unit_id,
        quantity: qty,
        serial_number: isBatch ? null : (mfgList?.[0] || serial_number || null),
        status: status || 'In Stock',
        serial_numbers: Array.isArray(serial_numbers) ? serial_numbers : null,
        is_batch: isBatch,
        batch_label: batch_label || null,
        manufacturer_serial_numbers: mfgList
      });

      return res.status(201).json({
        success: true,
        message: 'Inventory item created successfully.',
        data: newItem
      });
    } catch (error) {
      console.error('Create item error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create inventory item.' });
    }
  },

  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const {
        item_name,
        item_code,
        category,
        category_id,
        unit_id,
        quantity,
        serial_number,
        status,
        sub_type,
        sub_classification,
        description,
        brand,
        serial_numbers,
        is_batch,
        batch_label,
        manufacturer_serial_numbers
      } = req.body;

      const existing = await db.getInventoryItemById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Item not found.' });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorizedUnits = req.user.unitIds || [];
        if (!authorizedUnits.includes(existing.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this item\'s unit.' });
        }
      }

      const qty = quantity !== undefined ? Number(quantity) : existing.quantity;
      const isBatchItem = Boolean(is_batch !== undefined ? is_batch : (qty > 1 || existing.is_batch));
      let mfgList = undefined;
      if (Array.isArray(manufacturer_serial_numbers)) {
        mfgList = manufacturer_serial_numbers.map(s => (s ? String(s).trim() : ''));
        while (mfgList.length < Math.max(1, qty)) mfgList.push('');
        mfgList = mfgList.slice(0, Math.max(1, qty));
      }

      const updated = await db.updateInventoryItem(id, {
        item_name,
        item_code,
        category,
        category_id,
        sub_type: sub_type !== undefined ? sub_type : existing.sub_type,
        sub_classification: sub_classification !== undefined ? sub_classification : existing.sub_classification,
        description: description !== undefined ? description : existing.description,
        brand: brand !== undefined ? brand : existing.brand,
        unit_id,
        quantity,
        serial_number: isBatchItem ? null : (mfgList ? mfgList[0] : (serial_number !== undefined ? serial_number : existing.serial_number)),
        status,
        ...(serial_numbers !== undefined ? { serial_numbers } : {}),
        ...(is_batch !== undefined ? { is_batch } : {}),
        ...(batch_label !== undefined ? { batch_label } : {}),
        ...(mfgList !== undefined ? { manufacturer_serial_numbers: mfgList } : {})
      });

      return res.json({
        success: true,
        message: 'Item updated successfully.',
        data: updated
      });
    } catch (error) {
      console.error('Update item error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update item.' });
    }
  },

  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getInventoryItemById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Item not found.' });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorizedUnits = req.user.unitIds || [];
        if (!authorizedUnits.includes(existing.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied.' });
        }
      }

      await db.deleteInventoryItem(id);
      return res.json({ success: true, message: 'Item deleted successfully.' });
    } catch (error) {
      console.error('Delete item error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete item.' });
    }
  },

  // Category management
  async getCategories(req, res) {
    try {
      const categories = await db.getCategories();
      return res.json({ success: true, data: categories });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
  },

  async createCategory(req, res) {
    try {
      const { name, parent_id, requires_serial, description } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required.' });
      }
      const newCat = await db.createCategory({ name, parent_id, requires_serial, description });
      return res.status(201).json({ success: true, message: 'Category added.', data: newCat });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to create category.' });
    }
  },

  async getNextSerialNumber(req, res) {
    try {
      const { unit_id, category, sub_type, item_type, quantity } = req.query;
      const parsedQty = parseInt(quantity, 10);
      if (parsedQty && parsedQty > 1) {
        const batchInfo = await db.getNextBatchSerialNumbers({ unit_id, category, sub_type, item_type, quantity: parsedQty });
        return res.json({
          success: true,
          serial_number: batchInfo.firstSerial,
          ...batchInfo
        });
      }
      const serialNumber = await db.getNextSerialNumber({ unit_id, category, sub_type, item_type });
      return res.json({ success: true, serial_number: serialNumber });
    } catch (error) {
      console.error('Get next serial number error:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate serial number.' });
    }
  }
};

module.exports = inventoryController;
