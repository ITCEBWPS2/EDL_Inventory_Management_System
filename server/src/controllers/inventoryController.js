const db = require('../services/db');
const auditLogger = require('../services/auditLogger');

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

      await auditLogger.log({
        action: 'CREATE',
        module: 'Inventory',
        status: 'success',
        entity_type: 'InventoryItem',
        entity_id: newItem.id,
        entity_reference: newItem.item_code || newItem.serial_number || newItem.item_name,
        unit_id: newItem.unit_id,
        description: `${req.user.full_name} (${req.user.role}) added ${newItem.is_batch ? `${newItem.quantity}x ` : ''}${newItem.item_name} to inventory`,
        changes: auditLogger.snapshot(newItem),
        req,
        res
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

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Inventory',
        status: 'success',
        entity_type: 'InventoryItem',
        entity_id: updated.id,
        entity_reference: updated.item_code || updated.serial_number || updated.item_name,
        unit_id: updated.unit_id,
        description: `${req.user.full_name} (${req.user.role}) updated inventory item '${updated.item_name}' (${updated.item_code || updated.id})`,
        changes: auditLogger.diff(existing, updated),
        req,
        res
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

      await auditLogger.log({
        action: 'DELETE',
        module: 'Inventory',
        status: 'success',
        entity_type: 'InventoryItem',
        entity_id: existing.id,
        entity_reference: existing.item_code || existing.serial_number || existing.item_name,
        unit_id: existing.unit_id,
        description: `${req.user.full_name} (${req.user.role}) deleted inventory item '${existing.item_name}' (${existing.item_code || existing.id})`,
        changes: auditLogger.snapshot(existing),
        req,
        res
      });

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

      await auditLogger.log({
        action: 'CREATE',
        module: 'Inventory',
        status: 'success',
        entity_type: 'Category',
        entity_id: newCat.id,
        entity_reference: newCat.name,
        description: `${req.user.full_name} (${req.user.role}) created category '${newCat.name}'`,
        changes: auditLogger.snapshot(newCat),
        req,
        res
      });

      return res.status(201).json({ success: true, message: 'Category added.', data: newCat });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to create category.' });
    }
  },

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { name, description, requires_serial } = req.body;

      const trimmedName = name !== undefined ? String(name).trim() : undefined;
      if (trimmedName !== undefined) {
        if (!trimmedName) {
          return res.status(400).json({ success: false, message: 'Category name is required.' });
        }
        if (trimmedName.length < 2) {
          return res.status(400).json({ success: false, message: 'Category name must be at least 2 characters.' });
        }
        if (trimmedName.length > 60) {
          return res.status(400).json({ success: false, message: 'Category name cannot exceed 60 characters.' });
        }
        if (/<[^>]*>/i.test(trimmedName)) {
          return res.status(400).json({ success: false, message: 'HTML tags are not allowed in category name.' });
        }
        const validCharsRegex = /^[a-zA-Z0-9\s\-/&().]+$/;
        if (!validCharsRegex.test(trimmedName)) {
          return res.status(400).json({ success: false, message: 'Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.' });
        }
      }

      const updated = await db.updateCategory(id, {
        name: trimmedName,
        description,
        requires_serial
      });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'UPDATE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'Category',
          entity_id: updated.id,
          entity_reference: updated.name,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) updated category '${updated.name}'`,
          changes: auditLogger.snapshot(updated),
          req,
          res
        });
      }

      return res.json({
        success: true,
        message: 'Category updated successfully.',
        data: updated
      });
    } catch (error) {
      if (error.status === 404 || error.message === 'Category not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.status === 409 || (error.message && error.message.includes('already exists'))) {
        return res.status(409).json({ success: false, message: error.message });
      }
      if (error.status === 400 || (error.message && (error.message.includes('HTML') || error.message.includes('characters')))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Failed to update category:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update category.' });
    }
  },

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const deleted = await db.deleteCategory(id, { userRole: req.user?.role });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'DELETE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'Category',
          entity_id: deleted.id,
          entity_reference: deleted.name,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) deleted category '${deleted.name}'`,
          changes: auditLogger.snapshot(deleted),
          req,
          res
        });
      }

      return res.json({ success: true, message: `Category '${deleted.name}' deleted successfully.` });
    } catch (error) {
      if (error.status === 404 || error.message === 'Category not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.status === 403 || (error.message && error.message.includes('Super Admin'))) {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.status === 400 || (error.message && error.message.includes('Remove or move them first'))) {
        return res.status(400).json({
          success: false,
          message: error.message,
          blockingSubcategoriesCount: error.blockingSubcategoriesCount || 0,
          blockingItemsCount: error.blockingItemsCount || 0
        });
      }
      console.error('Failed to delete category:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete category.' });
    }
  },

  // Item Types (Sub-categories)
  async getItemTypes(req, res) {
    try {
      const { category } = req.query;
      const types = await db.getItemTypes(category);
      return res.json({ success: true, data: types });
    } catch (error) {
      console.error('Failed to fetch item types:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch item types.' });
    }
  },

  async createItemType(req, res) {
    try {
      const { name, category, category_id, sub_category_code, item_type_code, description } = req.body;
      const trimmedName = String(name || '').trim();
      const trimmedCategory = String(category || '').trim();

      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Type name is required.' });
      }
      if (trimmedName.length < 2) {
        return res.status(400).json({ success: false, message: 'Type name must be at least 2 characters.' });
      }
      if (trimmedName.length > 60) {
        return res.status(400).json({ success: false, message: 'Type name cannot exceed 60 characters.' });
      }
      if (/<[^>]*>/i.test(trimmedName)) {
        return res.status(400).json({ success: false, message: 'HTML tags are not allowed in type name.' });
      }
      if (!trimmedCategory) {
        return res.status(400).json({ success: false, message: 'Category is required.' });
      }

      const newType = await db.createItemType({
        name: trimmedName,
        category: trimmedCategory,
        category_id: category_id || null,
        sub_category_code: sub_category_code || null,
        item_type_code: item_type_code || null,
        description: description || '',
        created_by: req.user?.id || req.user?.username || null
      });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'CREATE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: newType.id,
          entity_reference: `${newType.name} (${newType.category})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) created item type '${newType.name}' in '${newType.category}'`,
          changes: auditLogger.snapshot(newType),
          req,
          res
        });
      }

      return res.status(201).json({
        success: true,
        message: `${newType.name} added to ${trimmedCategory}.`,
        data: newType
      });
    } catch (error) {
      if (error.message && (error.message.includes('already exists') || error.message.includes('HTML') || error.message.includes('characters'))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Failed to create item type:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create item type.' });
    }
  },

  async updateItemType(req, res) {
    try {
      const { id } = req.params;
      const { name, description, sub_category_code, item_type_code } = req.body;

      const trimmedName = name !== undefined ? String(name).trim() : undefined;
      if (trimmedName !== undefined) {
        if (!trimmedName) {
          return res.status(400).json({ success: false, message: 'Type name is required.' });
        }
        if (trimmedName.length < 2) {
          return res.status(400).json({ success: false, message: 'Type name must be at least 2 characters.' });
        }
        if (trimmedName.length > 60) {
          return res.status(400).json({ success: false, message: 'Type name cannot exceed 60 characters.' });
        }
        if (/<[^>]*>/i.test(trimmedName)) {
          return res.status(400).json({ success: false, message: 'HTML tags are not allowed in type name.' });
        }
      }

      const updated = await db.updateItemType(id, {
        name: trimmedName,
        description,
        sub_category_code,
        item_type_code
      });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'UPDATE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: updated.id,
          entity_reference: `${updated.name} (${updated.category})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) updated item type '${updated.name}'`,
          changes: auditLogger.snapshot(updated),
          req,
          res
        });
      }

      return res.json({
        success: true,
        message: `Type '${updated.name}' updated successfully.`,
        data: updated
      });
    } catch (error) {
      if (error.status === 404 || error.message === 'Item type not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.status === 400 || (error.message && (error.message.includes('already exists') || error.message.includes('HTML') || error.message.includes('characters')))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Failed to update item type:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update item type.' });
    }
  },

  async deleteItemType(req, res) {
    try {
      const { id } = req.params;
      const deleted = await db.deleteItemType(id, { userRole: req.user?.role });
      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'DELETE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: deleted.id,
          entity_reference: `${deleted.name} (${deleted.category})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) deleted item type '${deleted.name}'`,
          changes: auditLogger.snapshot(deleted),
          req,
          res
        });
      }
      return res.json({ success: true, message: `Type '${deleted.name}' removed.` });
    } catch (error) {
      if (error.status === 403 || (error.message && error.message.includes('Super Admin'))) {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.status === 400 || (error.message && error.message.includes('Cannot delete item type'))) {
        return res.status(400).json({
          success: false,
          message: error.message,
          blockingCount: error.blockingItemCount || 0
        });
      }
      if (error.status === 404 || error.message === 'Item type not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete item type.'
      });
    }
  },

  // --- Sub-category Item Types (e.g. Bench under Chairs) ---
  async getCustomItemTypes(req, res) {
    try {
      const subcategory = req.query.subcategory || req.query.subcategory_slug;
      const category = req.query.category || req.query.category_slug;
      const types = await db.getCustomItemTypes({ subcategory, category });
      return res.json({ success: true, data: types, itemTypes: types });
    } catch (error) {
      console.error('Failed to fetch custom item types:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch item types.' });
    }
  },

  async createCustomItemType(req, res) {
    try {
      const subcategory_slug = req.body.subcategory_slug || req.body.subcategory;
      const name = req.body.name;
      const category_slug = req.body.category_slug || req.body.category;

      const created = await db.createCustomItemType({
        subcategory_slug,
        name,
        category_slug,
        user_id: req.user?.id || req.user?.username || null
      });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'CREATE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: created.id,
          entity_reference: `${created.name} (${created.subcategory_slug})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) created item type '${created.name}' under '${created.subcategory_slug}'`,
          changes: auditLogger.snapshot(created),
          req,
          res
        });
      }

      return res.status(201).json({
        success: true,
        message: `Type '${created.name}' created successfully.`,
        data: created
      });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({
          success: false,
          message: error.message || 'This type already exists.',
          duplicateType: error.duplicateType,
          existing: error.existing
        });
      }
      if (error.status === 400 || (error.message && (error.message.includes('required') || error.message.includes('characters') || error.message.includes('HTML') || error.message.includes('may only contain')))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Failed to create custom item type:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create item type.' });
    }
  },

  async updateCustomItemType(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const updated = await db.updateCustomItemType(id, { name });

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'UPDATE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: updated.id,
          entity_reference: `${updated.name} (${updated.subcategory_slug})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) renamed item type '${updated.name}'`,
          changes: auditLogger.snapshot(updated),
          req,
          res
        });
      }

      return res.json({
        success: true,
        message: `Type '${updated.name}' updated successfully.`,
        data: updated
      });
    } catch (error) {
      if (error.status === 404 || error.message === 'Item type not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.status === 409) {
        return res.status(409).json({ success: false, message: error.message || 'This type already exists.' });
      }
      if (error.status === 400 || (error.message && (error.message.includes('required') || error.message.includes('characters') || error.message.includes('HTML') || error.message.includes('may only contain')))) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Failed to update custom item type:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update item type.' });
    }
  },

  async deleteCustomItemType(req, res) {
    try {
      const { id } = req.params;
      const deleted = await db.deleteCustomItemType(id);

      if (typeof auditLogger !== 'undefined' && auditLogger?.log) {
        await auditLogger.log({
          action: 'DELETE',
          module: 'Inventory',
          status: 'success',
          entity_type: 'ItemType',
          entity_id: deleted.id,
          entity_reference: `${deleted.name} (${deleted.subcategory_slug})`,
          description: `${req.user?.full_name || 'User'} (${req.user?.role || 'user'}) deleted item type '${deleted.name}'`,
          changes: auditLogger.snapshot(deleted),
          req,
          res
        });
      }

      return res.json({ success: true, message: `Type '${deleted.name}' deleted successfully.` });
    } catch (error) {
      if (error.status === 400 || (error.message && error.message.includes('Cannot delete item type'))) {
        return res.status(400).json({
          success: false,
          message: error.message,
          blockingCount: error.blockingItemCount || 0
        });
      }
      if (error.status === 404 || error.message === 'Item type not found.') {
        return res.status(404).json({ success: false, message: error.message });
      }
      console.error('Failed to delete custom item type:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete item type.' });
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
