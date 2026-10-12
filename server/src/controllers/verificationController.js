const db = require('../services/db');

const verificationController = {
  async getVerifications(req, res) {
    try {
      const { unit_id, year } = req.query;
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

      const list = await db.getVerifications(targetUnits, year);
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get verifications error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch verifications.' });
    }
  },

  async getVerificationById(req, res) {
    try {
      const { id } = req.params;
      const verif = await db.getVerificationById(id);
      if (!verif) {
        return res.status(404).json({ success: false, message: 'Verification record not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (!authorized.includes(verif.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this verification\'s unit.' });
        }
      }

      return res.json({ success: true, data: verif });
    } catch (error) {
      console.error('Get verification by id error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve verification details.' });
    }
  },

  async getHistoryItems(req, res) {
    try {
      const { unit_id, year } = req.query;
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

      const list = await db.getVerificationHistoryItems(targetUnits, year);
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get verification history items error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch verification history items.' });
    }
  },

  async createVerification(req, res) {
    try {
      const { unit_id, date, year, verified_by, verifier_1, verifier_2, verifier_3, summary, status, items } = req.body;

      if (!unit_id || !year) {
        return res.status(400).json({
          success: false,
          message: 'Unit and year are required.'
        });
      }

      const v1 = verifier_1 || (Array.isArray(verified_by) ? verified_by[0] : verified_by);
      if (!v1) {
        return res.status(400).json({
          success: false,
          message: 'Verifier 1 is required.'
        });
      }

      // Check unit access
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied for this unit.' });
      }

      const verifierList = [verifier_1, verifier_2, verifier_3].filter(Boolean);
      if (verifierList.length === 0 && verified_by) {
        if (Array.isArray(verified_by)) verifierList.push(...verified_by);
        else verifierList.push(verified_by);
      }

      // If items not provided in payload, populate automatically from current unit inventory
      let verificationItems = items;
      if (!verificationItems || verificationItems.length === 0) {
        const unitRemaining = await db.getRemainingInventory([unit_id]);
        verificationItems = unitRemaining.map(r => ({
          item_code: r.item_code,
          item_name: r.item_name,
          category: r.category,
          system_qty: r.remaining_qty,
          physical_qty: r.remaining_qty,
          condition: 'Good',
          label_no: '',
          remarks: '',
          status: 'Not Counted'
        }));
      }

      const isConfirmed = status === 'confirmed';

      const newVerif = await db.createVerification({
        unit_id,
        date: date || new Date().toISOString().split('T')[0],
        year: Number(year),
        verifier_1: verifier_1 || verifierList[0] || '',
        verifier_2: verifier_2 || verifierList[1] || '',
        verifier_3: verifier_3 || verifierList[2] || '',
        verified_by: verifierList,
        summary: summary || '',
        status: status || 'confirmed',
        confirmed_by: isConfirmed ? req.user.id : null,
        confirmed_at: isConfirmed ? new Date().toISOString() : null,
        items: verificationItems
      });

      return res.status(201).json({
        success: true,
        message: isConfirmed 
          ? 'Annual verification confirmed and permanently saved.' 
          : 'Annual verification drafted successfully.',
        data: newVerif
      });
    } catch (error) {
      console.error('Create verification error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create verification.' });
    }
  },

  async updateVerification(req, res) {
    try {
      const { id } = req.params;
      const { date, year, verified_by, summary, items } = req.body;

      const existing = await db.getVerificationById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Verification not found.' });
      }

      if (existing.status === 'confirmed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify a confirmed verification. Confirmed verifications are locked for permanent audit compliance.'
        });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(existing.unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied.' });
      }

      const updated = await db.updateVerification(id, {
        date,
        year,
        verified_by,
        summary,
        items
      });

      return res.json({
        success: true,
        message: 'Verification saved as draft.',
        data: updated
      });
    } catch (error) {
      console.error('Update verification error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update verification.' });
    }
  },

  async confirmVerification(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getVerificationById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Verification not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(existing.unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied.' });
      }

      const confirmed = await db.confirmVerification(id, req.user.id);
      return res.json({
        success: true,
        message: 'Annual verification confirmed and permanently locked for audit.',
        data: confirmed
      });
    } catch (error) {
      console.error('Confirm verification error:', error);
      return res.status(500).json({ success: false, message: 'Failed to confirm verification.' });
    }
  },

  // Issued & Destroyed
  async getIssuedDestroyed(req, res) {
    try {
      const { unit_id } = req.query;
      let targetUnits = null;
      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (unit_id && !authorized.includes(unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied.' });
        }
        targetUnits = unit_id ? [unit_id] : authorized;
      } else if (unit_id) {
        targetUnits = [unit_id];
      }

      const list = await db.getIssuedDestroyedItems(targetUnits);
      return res.json({ success: true, data: list });
    } catch (error) {
      console.error('Get issued destroyed error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch issued/destroyed records.' });
    }
  },

  async getIssuedDestroyedById(req, res) {
    try {
      const { id } = req.params;
      const record = await db.getIssuedDestroyedItemById(id);
      if (!record) {
        return res.status(404).json({ success: false, message: 'Issued / destroyed record not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (record.unit_id && !authorized.includes(record.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this record.' });
        }
      }

      return res.json({ success: true, data: record });
    } catch (error) {
      console.error('Get issued destroyed by id error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve record.' });
    }
  },

  async createIssuedDestroyed(req, res) {
    try {
      const { item_id, serial_number, quantity, disposition, reason, date, verification_id } = req.body;

      if (!item_id || quantity === undefined || quantity === null || !disposition || !date) {
        return res.status(400).json({
          success: false,
          message: 'Item, quantity, disposition, and date are required.'
        });
      }

      const numQty = Number(quantity);
      if (isNaN(numQty) || numQty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1.'
        });
      }

      const item = await db.getInventoryItemById(item_id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Inventory item not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(item.unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied for this item\'s unit.' });
      }

      const availableQty = Number(item.quantity || 0);
      if (numQty > availableQty) {
        return res.status(400).json({
          success: false,
          message: `Quantity cannot exceed available inventory (${availableQty}).`
        });
      }

      const record = await db.createIssuedDestroyedItem({
        item_id,
        unit_id: item.unit_id,
        serial_number: serial_number || null,
        quantity: numQty,
        disposition,
        reason: reason || '',
        date,
        verification_id: verification_id || null
      });

      return res.status(201).json({
        success: true,
        message: 'Item write-off / issued / destroyed recorded successfully.',
        data: record
      });
    } catch (error) {
      console.error('Create issued/destroyed error:', error);
      return res.status(500).json({ success: false, message: 'Failed to record write-off.' });
    }
  },

  async updateIssuedDestroyed(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getIssuedDestroyedItemById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Issued / destroyed record not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (existing.unit_id && !authorized.includes(existing.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this record.' });
        }
      }

      const { item_id, serial_number, quantity, disposition, reason, date, verification_id } = req.body;

      const targetItemId = item_id || existing.item_id;
      const targetItem = await db.getInventoryItemById(targetItemId);
      if (!targetItem) {
        return res.status(404).json({ success: false, message: 'Inventory item not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin' && !(req.user.unitIds || []).includes(targetItem.unit_id)) {
        return res.status(403).json({ success: false, message: 'Access Denied for target item\'s unit.' });
      }

      const numQty = quantity !== undefined ? Number(quantity) : existing.quantity;
      if (isNaN(numQty) || numQty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1.'
        });
      }

      // Check max allowable quantity
      const availableBefore = (existing.item_id === targetItem.id)
        ? Number(targetItem.quantity || 0) + Number(existing.quantity || 0)
        : Number(targetItem.quantity || 0);

      if (numQty > availableBefore) {
        return res.status(400).json({
          success: false,
          message: `Quantity cannot exceed available inventory (${availableBefore}).`
        });
      }

      const updated = await db.updateIssuedDestroyedItem(id, {
        item_id: targetItemId,
        unit_id: targetItem.unit_id,
        serial_number: serial_number !== undefined ? serial_number : existing.serial_number,
        quantity: numQty,
        disposition: disposition || existing.disposition,
        reason: reason !== undefined ? reason : existing.reason,
        date: date || existing.date,
        verification_id: verification_id !== undefined ? verification_id : existing.verification_id
      });

      return res.json({
        success: true,
        message: 'Record updated successfully.',
        data: updated
      });
    } catch (error) {
      console.error('Update issued destroyed error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update record.' });
    }
  },

  async deleteIssuedDestroyed(req, res) {
    try {
      const { id } = req.params;
      const existing = await db.getIssuedDestroyedItemById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Issued / destroyed record not found.' });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (existing.unit_id && !authorized.includes(existing.unit_id)) {
          return res.status(403).json({ success: false, message: 'Access Denied for this record.' });
        }
      }

      const deleted = await db.deleteIssuedDestroyedItem(id);
      if (!deleted) {
        return res.status(500).json({ success: false, message: 'Failed to delete record.' });
      }

      return res.json({
        success: true,
        message: 'Record deleted successfully.'
      });
    } catch (error) {
      console.error('Delete issued destroyed error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete record.' });
    }
  }
};

module.exports = verificationController;
