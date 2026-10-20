const db = require('../services/db');

const reportController = {
  /**
   * Current Inventory Report
   */
  async getCurrentInventory(req, res) {
    try {
      const { unit_id, category, search } = req.query;
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

      const reportData = await db.getRemainingInventory(targetUnits, category, search);

      const totalItems = reportData.length;
      const totalStock = reportData.reduce((sum, r) => sum + r.remaining_qty, 0);
      const lowStockCount = reportData.filter(r => r.stock_status === 'Low Stock').length;
      const outOfStockCount = reportData.filter(r => r.stock_status === 'Out of Stock').length;

      return res.json({
        success: true,
        summary: {
          total_items: totalItems,
          total_quantity: totalStock,
          low_stock_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
          generated_at: new Date().toISOString()
        },
        data: reportData
      });
    } catch (error) {
      console.error('Inventory report error:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate inventory report.' });
    }
  },

  /**
   * Combined Transactions History Report (Received + Expended)
   */
  async getTransactionHistory(req, res) {
    try {
      const { unit_id, start_date, end_date, type, search } = req.query;
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

      let combined = [];

      if (!type || type === 'all' || type === 'received') {
        const received = await db.getReceivedTransactions(targetUnits, search);
        combined.push(...received.map(r => ({
          ...r,
          tx_type: 'Received',
          type_badge: 'In',
          partner_or_disposition: r.from_whom?.trim() || '—'
        })));
      }

      if (!type || type === 'all' || type === 'expended') {
        const expended = await db.getExpendedTransactions(targetUnits, search);
        combined.push(...expended.map(e => ({
          ...e,
          tx_type: 'Expended',
          type_badge: 'Out',
          partner_or_disposition: e.disposition
        })));
      }

      // Date filtering
      if (start_date) {
        combined = combined.filter(t => t.date && new Date(t.date) >= new Date(start_date));
      }
      if (end_date) {
        combined = combined.filter(t => t.date && new Date(t.date) <= new Date(end_date));
      }

      // Sort chronological descending (records with date first descending, dateless records last in stable order)
      combined.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createB - createA;
      });

      const totalReceivedQty = combined.filter(t => t.tx_type === 'Received').reduce((s, t) => s + Number(t.quantity), 0);
      const totalExpendedQty = combined.filter(t => t.tx_type === 'Expended').reduce((s, t) => s + Number(t.quantity), 0);

      return res.json({
        success: true,
        summary: {
          total_transactions: combined.length,
          total_received_qty: totalReceivedQty,
          total_expended_qty: totalExpendedQty,
          generated_at: new Date().toISOString()
        },
        data: combined
      });
    } catch (error) {
      console.error('Transaction report error:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate transaction report.' });
    }
  },

  /**
   * Verification Audit Report
   */
  async getVerificationAudit(req, res) {
    try {
      const { unit_id, year } = req.query;
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

      const verifications = await db.getVerifications(targetUnits, year);
      const detailed = await Promise.all(
        verifications.map(v => db.getVerificationById(v.id))
      );

      return res.json({
        success: true,
        summary: {
          total_verifications: detailed.length,
          confirmed_count: detailed.filter(v => v.status === 'confirmed').length,
          draft_count: detailed.filter(v => v.status === 'draft').length,
          generated_at: new Date().toISOString()
        },
        data: detailed
      });
    } catch (error) {
      console.error('Verification report error:', error);
      return res.status(500).json({ success: false, message: 'Failed to generate verification audit report.' });
    }
  }
};

module.exports = reportController;
