const db = require('../services/db');
const storageService = require('../services/storageService');
const env = require('../config/env');
const auditLogger = require('../services/auditLogger');

function validateReceivedDate(val) {
  if (val === undefined || val === null) {
    return { valid: false, error: 'Date is required' };
  }
  const str = String(val).trim();
  if (!str) {
    return { valid: false, error: 'Date is required' };
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    return { valid: false, error: 'Date is invalid' };
  }
  const year = d.getFullYear();
  if (year < 1900 || year > 2150) {
    return { valid: false, error: 'Date is invalid' };
  }
  return { valid: true, value: str };
}

function validateReceivedSender(val) {
  if (val === undefined || val === null) {
    return { valid: false, error: 'From whom received is required' };
  }
  const str = String(val).trim();
  if (!str) {
    return { valid: false, error: 'From whom received is required' };
  }
  return { valid: true, value: str };
}

const transactionController = {
  getConfig(req, res) {
    return res.json({
      success: true,
      data: {
        require_received_sender: true
      }
    });
  },

  // ==========================================
  // RECEIVED TRANSACTIONS
  // ==========================================
  async getReceived(req, res) {
    try {
      const { unit_id, search } = req.query;
      let targetUnits = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (unit_id && !authorized.includes(unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
        }
        targetUnits = unit_id ? [unit_id] : authorized;
      } else if (unit_id) {
        targetUnits = [unit_id];
      }

      const list = await db.getReceivedTransactions(targetUnits, search);

      // Add voucher signed/accessible URLs
      const enhanced = await Promise.all(
        list.map(async (t) => {
          let voucher_url = null;
          if (t.voucher_image_path) {
            voucher_url = await storageService.getVoucherUrl(t.voucher_image_path);
          }
          return { ...t, voucher_url };
        })
      );

      return res.json({ success: true, data: enhanced });
    } catch (error) {
      console.error('Get received error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch received transactions.' });
    }
  },

  async createReceived(req, res) {
    try {
      let { item_name, item_id, category, category_id, quantity, date, unit_id, voucher_no, serial_number, from_whom, notes } = req.body;

      const trimmedName = (item_name || item_id || '').trim();
      const validationErrors = [];

      const dateValidation = validateReceivedDate(date);
      if (!dateValidation.valid) {
        validationErrors.push(dateValidation.error);
      }

      const senderValidation = validateReceivedSender(from_whom);
      if (!senderValidation.valid) {
        validationErrors.push(senderValidation.error);
      }

      if (!trimmedName) {
        validationErrors.push('Item name is required');
      }

      if (quantity === undefined || quantity === null || String(quantity).trim() === '' || Number(quantity) < 1) {
        validationErrors.push('Quantity must be at least 1');
      }

      if (!unit_id) {
        validationErrors.push('Unit is required');
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors.join('. '),
          errors: validationErrors
        });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
      }

      let categoryName = category || '';
      if (category_id && !categoryName) {
        const cats = await db.getCategories();
        const found = cats.find(c => c.id === category_id);
        if (found) categoryName = found.name;
      }

      const cleanDate = dateValidation.value;
      const cleanSender = senderValidation.value;
      const cleanVoucherNo = (voucher_no !== undefined && voucher_no !== null) ? String(voucher_no).trim() : '';

      if (req.file && req.file.size > env.MAX_ATTACHMENT_BYTES) {
        return res.status(413).json({
          success: false,
          error: 'LIMIT_FILE_SIZE',
          message: `File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`
        });
      }

      let voucher_image_path = null;
      if (req.file) {
        voucher_image_path = await storageService.uploadVoucher(req.file, cleanVoucherNo || Date.now());
      } else if (req.body.voucher_image_path) {
        voucher_image_path = req.body.voucher_image_path;
      }

      const validItemId = (item_id && typeof item_id === 'string' && item_id.match(/^[0-9a-f-]{36}$/i)) ? item_id : null;

      const newTx = await db.createReceivedTransaction({
        item_id: validItemId,
        item_name: trimmedName,
        category: categoryName,
        category_id: category_id || null,
        quantity: Number(quantity),
        date: cleanDate,
        unit_id,
        voucher_image_path,
        voucher_no: cleanVoucherNo,
        serial_number: serial_number || null,
        from_whom: cleanSender,
        notes: notes || '',
        created_by: req.user.id
      });

      await auditLogger.log({
        action: 'CREATE',
        module: 'Received Items',
        status: 'success',
        entity_type: 'ReceivedTransaction',
        entity_id: newTx.id,
        entity_reference: newTx.voucher_no || newTx.item_name,
        unit_id: newTx.unit_id,
        description: `${req.user.full_name} (${req.user.role}) recorded receipt of ${newTx.quantity}x ${newTx.item_name} (Voucher: ${newTx.voucher_no || 'N/A'}) from ${newTx.from_whom || 'N/A'}`,
        changes: auditLogger.snapshot(newTx),
        req,
        res
      });

      return res.status(201).json({
        success: true,
        message: 'Received transaction recorded successfully.',
        data: newTx
      });
    } catch (error) {
      console.error('Create received error:', error);
      return res.status(500).json({ success: false, message: 'Failed to record received transaction.' });
    }
  },

  async updateReceived(req, res) {
    try {
      const { id } = req.params;
      let { item_name, item_id, category, category_id, quantity, date, voucher_no, serial_number, from_whom, notes } = req.body;

      const existing = await db.getReceivedTransactionById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

      if (req.file && req.file.size > env.MAX_ATTACHMENT_BYTES) {
        return res.status(413).json({
          success: false,
          error: 'LIMIT_FILE_SIZE',
          message: `File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`
        });
      }

      const validationErrors = [];

      // Validate Date for update
      let finalDate;
      if (date !== undefined) {
        const dateVal = validateReceivedDate(date);
        if (!dateVal.valid) {
          validationErrors.push(dateVal.error);
        } else {
          finalDate = dateVal.value;
        }
      } else {
        if (existing.date && String(existing.date).trim()) {
          const existingDateVal = validateReceivedDate(existing.date);
          if (existingDateVal.valid) {
            finalDate = existingDateVal.value;
          } else {
            validationErrors.push(existingDateVal.error);
          }
        } else {
          validationErrors.push('Date is required');
        }
      }

      // Validate Sender for update
      let finalSender;
      if (from_whom !== undefined) {
        const senderVal = validateReceivedSender(from_whom);
        if (!senderVal.valid) {
          validationErrors.push(senderVal.error);
        } else {
          finalSender = senderVal.value;
        }
      } else {
        if (existing.from_whom && String(existing.from_whom).trim()) {
          finalSender = String(existing.from_whom).trim();
        } else {
          validationErrors.push('From whom received is required');
        }
      }

      if (quantity !== undefined && (quantity === null || String(quantity).trim() === '' || Number(quantity) < 1)) {
        validationErrors.push('Quantity must be at least 1');
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors.join('. '),
          errors: validationErrors
        });
      }

      let voucher_image_path = undefined;
      if (req.file) {
        voucher_image_path = await storageService.uploadVoucher(req.file, id);
      }

      const targetName = (item_name || item_id || '').trim();
      const cleanItemId = (item_id !== undefined) ? ((item_id && typeof item_id === 'string' && item_id.match(/^[0-9a-f-]{36}$/i)) ? item_id : null) : undefined;
      const cleanVoucherNo = voucher_no !== undefined ? ((voucher_no !== null && typeof voucher_no === 'string') ? voucher_no.trim() : (voucher_no || '')) : undefined;

      const updates = {
        ...(targetName ? { item_name: targetName } : {}),
        ...(cleanItemId !== undefined ? { item_id: cleanItemId } : {}),
        ...(category ? { category } : {}),
        ...(category_id ? { category_id } : {}),
        ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
        date: finalDate,
        ...(cleanVoucherNo !== undefined ? { voucher_no: cleanVoucherNo } : {}),
        serial_number,
        from_whom: finalSender,
        notes
      };
      if (voucher_image_path) updates.voucher_image_path = voucher_image_path;

      const updated = await db.updateReceivedTransaction(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Received Items',
        status: 'success',
        entity_type: 'ReceivedTransaction',
        entity_id: updated.id,
        entity_reference: updated.voucher_no || updated.item_name,
        unit_id: updated.unit_id,
        description: `${req.user.full_name} (${req.user.role}) updated received transaction '${updated.voucher_no || updated.id}'`,
        changes: auditLogger.diff(existing, updated),
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Received transaction updated successfully.',
        data: updated
      });
    } catch (error) {
      console.error('Update received error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update transaction.' });
    }
  },

  async deleteReceived(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getReceivedTransactionById(id);
      const success = await db.deleteReceivedTransaction(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

      await auditLogger.log({
        action: 'DELETE',
        module: 'Received Items',
        status: 'success',
        entity_type: 'ReceivedTransaction',
        entity_id: id,
        entity_reference: existing?.voucher_no || existing?.item_name || id,
        unit_id: existing?.unit_id,
        description: `${req.user.full_name} (${req.user.role}) deleted received transaction '${existing?.voucher_no || id}'`,
        changes: auditLogger.snapshot(existing),
        req,
        res
      });

      return res.json({ success: true, message: 'Received transaction removed.' });
    } catch (error) {
      console.error('Delete received error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete transaction.' });
    }
  },

  // ==========================================
  // EXPENDED TRANSACTIONS
  // ==========================================
  async getExpended(req, res) {
    try {
      const { unit_id, search } = req.query;
      let targetUnits = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (unit_id && !authorized.includes(unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
        }
        targetUnits = unit_id ? [unit_id] : authorized;
      } else if (unit_id) {
        targetUnits = [unit_id];
      }

      const list = await db.getExpendedTransactions(targetUnits, search);
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get expended error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch expended transactions.' });
    }
  },

  async createExpended(req, res) {
    try {
      const { item_name, item_id, item_code, category, quantity, date, unit_id, voucher_no, disposition, notes } = req.body;

      const targetItemName = (item_name || item_id || '').trim();
      if (!targetItemName || !quantity || !unit_id || !voucher_no || !disposition) {
        return res.status(400).json({
          success: false,
          message: 'Item name, quantity, unit, voucher number, and destination/disposition are required.'
        });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
      }

      // Reconcile: verify item has sufficient balance in this unit
      const remainingList = await db.getRemainingInventory([unit_id]);
      const normTarget = targetItemName.toLowerCase();
      const itemRemaining = remainingList.find(r =>
        (r.item_name && r.item_name.toLowerCase() === normTarget) ||
        (item_id && r.item_id === item_id) ||
        r.item_id === targetItemName
      );
      if (itemRemaining && itemRemaining.remaining_qty < Number(quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Requested ${quantity}, but remaining balance is ${itemRemaining.remaining_qty}.`
        });
      }

      // Resolve item details from inventory and received transactions
      const inventoryList = await db.getInventoryItems(unit_id ? [unit_id] : null);
      const matchedInv = inventoryList.find(i =>
        (item_id && i.id === item_id) ||
        (i.item_name && i.item_name.toLowerCase() === normTarget)
      );

      const receivedList = await db.getReceivedTransactions(unit_id ? [unit_id] : null);
      const matchedRec = receivedList.find(r =>
        (item_id && (r.item_id === item_id || r.id === item_id)) ||
        (r.item_name && r.item_name.toLowerCase() === normTarget)
      );

      const resolvedId = matchedInv?.id || matchedRec?.item_id || (item_id && item_id.match(/^[0-9a-f-]{36}$/i) ? item_id : null);
      const actualName = matchedInv?.item_name || matchedRec?.item_name || itemRemaining?.item_name || (item_name && item_name !== 'Unknown Item' ? item_name : targetItemName);
      const actualCode = matchedInv?.item_code || matchedRec?.item_code || item_code || '';
      const actualCategory = matchedInv?.category || matchedRec?.category || itemRemaining?.category || category || '';

      const newTx = await db.createExpendedTransaction({
        item_id: resolvedId,
        item_name: actualName,
        item_code: actualCode,
        category: actualCategory,
        quantity: Number(quantity),
        date: date || new Date().toISOString().split('T')[0],
        unit_id,
        voucher_no,
        disposition,
        notes: typeof notes === 'string' ? notes.trim() : (notes || ''),
        created_by: req.user.id
      });

      await auditLogger.log({
        action: 'CREATE',
        module: 'Expended Items',
        status: 'success',
        entity_type: 'ExpendedTransaction',
        entity_id: newTx.id,
        entity_reference: newTx.voucher_no || newTx.item_name,
        unit_id: newTx.unit_id,
        description: `${req.user.full_name} (${req.user.role}) recorded expenditure of ${newTx.quantity}x ${newTx.item_name} (Voucher: ${newTx.voucher_no || 'N/A'}) to ${newTx.disposition}`,
        changes: auditLogger.snapshot(newTx),
        req,
        res
      });

      return res.status(201).json({
        success: true,
        message: 'Expended transaction recorded successfully.',
        data: newTx
      });
    } catch (error) {
      console.error('Create expended error:', error);
      return res.status(500).json({ success: false, message: 'Failed to record expended transaction.' });
    }
  },

  async updateExpended(req, res) {
    try {
      const { id } = req.params;
      const { item_name, item_id, item_code, category, quantity, date, voucher_no, disposition, notes } = req.body;

      const targetName = (item_name || item_id || '').trim();

      const existing = await db.getExpendedTransactionById(id);

      const updated = await db.updateExpendedTransaction(id, {
        ...(targetName ? { item_name: targetName } : {}),
        ...(item_id ? { item_id } : {}),
        ...(item_code ? { item_code } : {}),
        ...(category ? { category } : {}),
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        date,
        voucher_no,
        disposition,
        notes: notes !== undefined ? (typeof notes === 'string' ? notes.trim() : notes) : undefined
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Expended Items',
        status: 'success',
        entity_type: 'ExpendedTransaction',
        entity_id: updated.id,
        entity_reference: updated.voucher_no || updated.item_name,
        unit_id: updated.unit_id,
        description: `${req.user.full_name} (${req.user.role}) updated expended transaction '${updated.voucher_no || updated.id}'`,
        changes: auditLogger.diff(existing, updated),
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Expended transaction updated successfully.',
        data: updated
      });
    } catch (error) {
      console.error('Update expended error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update transaction.' });
    }
  },

  async deleteExpended(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getExpendedTransactionById(id);
      const success = await db.deleteExpendedTransaction(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

      await auditLogger.log({
        action: 'DELETE',
        module: 'Expended Items',
        status: 'success',
        entity_type: 'ExpendedTransaction',
        entity_id: id,
        entity_reference: existing?.voucher_no || existing?.item_name || id,
        unit_id: existing?.unit_id,
        description: `${req.user.full_name} (${req.user.role}) deleted expended transaction '${existing?.voucher_no || id}'`,
        changes: auditLogger.snapshot(existing),
        req,
        res
      });

      return res.json({ success: true, message: 'Expended transaction removed.' });
    } catch (error) {
      console.error('Delete expended error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete transaction.' });
    }
  },

  // ==========================================
  // REMAINING INVENTORY (Dynamic Computed View)
  // ==========================================
  async getRemaining(req, res) {
    try {
      const { unit_id, category, search } = req.query;
      let targetUnits = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (unit_id && !authorized.includes(unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
        }
        targetUnits = unit_id ? [unit_id] : authorized;
      } else if (unit_id) {
        targetUnits = [unit_id];
      }

      let list = await db.getRemainingInventory(targetUnits, category, search);
      // Strictly enforce that only items with total_received > 0 appear
      list = (list || []).filter(item => Number(item.total_received) > 0);
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get remaining error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch remaining inventory.' });
    }
  }
};

module.exports = transactionController;
