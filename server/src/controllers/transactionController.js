const db = require('../services/db');
const storageService = require('../services/storageService');
const env = require('../config/env');

const transactionController = {
  getConfig(req, res) {
    return res.json({
      success: true,
      data: {
        require_received_sender: Boolean(env.REQUIRE_RECEIVED_SENDER)
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
      const trimmedSender = (from_whom !== undefined && from_whom !== null) ? String(from_whom).trim() : '';

      if (!trimmedName || !quantity || !unit_id || (env.REQUIRE_RECEIVED_SENDER && !trimmedSender)) {
        return res.status(400).json({
          success: false,
          message: env.REQUIRE_RECEIVED_SENDER
            ? 'Item name, quantity, unit, and sender (from whom) are required.'
            : 'Item name, quantity, and unit are required.'
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

      const cleanDate = (date !== undefined && date !== null) ? String(date).trim() : '';
      const cleanVoucherNo = (voucher_no !== undefined && voucher_no !== null) ? String(voucher_no).trim() : '';

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
        from_whom: trimmedSender,
        notes: notes || '',
        created_by: req.user.id
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

      let voucher_image_path = undefined;
      if (req.file) {
        voucher_image_path = await storageService.uploadVoucher(req.file, id);
      }

      if (env.REQUIRE_RECEIVED_SENDER && from_whom !== undefined && !String(from_whom).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Sender (from whom) is required.'
        });
      }

      const targetName = (item_name || item_id || '').trim();
      const cleanItemId = (item_id !== undefined) ? ((item_id && typeof item_id === 'string' && item_id.match(/^[0-9a-f-]{36}$/i)) ? item_id : null) : undefined;
      const cleanDate = date !== undefined ? ((date !== null && typeof date === 'string') ? date.trim() : (date || '')) : undefined;
      const cleanVoucherNo = voucher_no !== undefined ? ((voucher_no !== null && typeof voucher_no === 'string') ? voucher_no.trim() : (voucher_no || '')) : undefined;
      const cleanSender = from_whom !== undefined ? ((from_whom !== null && typeof from_whom === 'string') ? from_whom.trim() : (from_whom || '')) : undefined;
      const updates = {
        ...(targetName ? { item_name: targetName } : {}),
        ...(cleanItemId !== undefined ? { item_id: cleanItemId } : {}),
        ...(category ? { category } : {}),
        ...(category_id ? { category_id } : {}),
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        ...(cleanDate !== undefined ? { date: cleanDate } : {}),
        ...(cleanVoucherNo !== undefined ? { voucher_no: cleanVoucherNo } : {}),
        serial_number,
        ...(cleanSender !== undefined ? { from_whom: cleanSender } : {}),
        notes
      };
      if (voucher_image_path) updates.voucher_image_path = voucher_image_path;

      const updated = await db.updateReceivedTransaction(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }

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
      const success = await db.deleteReceivedTransaction(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }
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
      const success = await db.deleteExpendedTransaction(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Transaction not found.' });
      }
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
