const db = require('../services/db');

const dashboardController = {
  async getDashboardData(req, res) {
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

      // 1. Fetch relevant datasets
      const items = await db.getInventoryItems(targetUnits);
      const remainingList = await db.getRemainingInventory(targetUnits);
      const receivedTx = await db.getReceivedTransactions(targetUnits);
      const expendedTx = await db.getExpendedTransactions(targetUnits);
      const verifications = await db.getVerifications(targetUnits);
      const allUnits = await db.getUnits();

      // 2. Compute KPI Metrics
      const totalUniqueItems = items.length;
      const totalReceivedQuantity = receivedTx.reduce((sum, r) => sum + Number(r.quantity), 0);
      const totalExpendedQuantity = expendedTx.reduce((sum, e) => sum + Number(e.quantity), 0);
      const totalRemainingStock = remainingList.reduce((sum, r) => sum + Number(r.remaining_qty), 0);

      const lowStockCount = remainingList.filter(r => r.stock_status === 'Low Stock').length;
      const outOfStockCount = remainingList.filter(r => r.stock_status === 'Out of Stock').length;

      // 3. Category Breakdown (for Donut Chart)
      const categoryMap = {};
      remainingList.forEach(item => {
        const cat = item.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.remaining_qty);
      });
      const categoryBreakdown = Object.keys(categoryMap).map(name => ({
        name,
        quantity: categoryMap[name]
      })).sort((a, b) => b.quantity - a.quantity);

      // 4. Recent Transactions (last 8)
      const combinedRecent = [
        ...receivedTx.map(r => ({
          id: r.id,
          date: r.date,
          item_name: r.item_name,
          item_code: r.item_code,
          quantity: r.quantity,
          type: 'Received',
          type_badge: 'In',
          voucher_no: r.voucher_no,
          unit_name: r.unit_name
        })),
        ...expendedTx.map(e => ({
          id: e.id,
          date: e.date,
          item_name: e.item_name,
          item_code: e.item_code,
          quantity: e.quantity,
          type: 'Expended',
          type_badge: 'Out',
          voucher_no: e.voucher_no,
          unit_name: e.unit_name
        }))
      ];
      combinedRecent.sort((a, b) => new Date(b.date) - new Date(a.date));
      const recentTransactions = combinedRecent.slice(0, 8);

      // 5. Verification Status
      const latestVerification = verifications.length > 0 ? verifications[0] : null;

      // 6. Unit Hierarchy Tree for dashboard browser (supports deep arbitrary levels)
      const buildSubTree = (parentId = null) => {
        return allUnits
          .filter(u => u.parent_unit_id === parentId)
          .map(u => ({
            id: u.id,
            unit_name: u.unit_name,
            unit_code: u.unit_code,
            unit_type: u.unit_type,
            location: u.location,
            status: u.status,
            children: buildSubTree(u.id)
          }));
      };
      const unitTree = buildSubTree(null);

      return res.json({
        success: true,
        data: {
          kpi: {
            total_items: totalUniqueItems,
            total_received: totalReceivedQuantity,
            total_expended: totalExpendedQuantity,
            total_remaining: totalRemainingStock,
            low_stock_count: lowStockCount,
            out_of_stock_count: outOfStockCount
          },
          category_breakdown: categoryBreakdown,
          recent_transactions: recentTransactions,
          verification_status: {
            has_verification: !!latestVerification,
            status: latestVerification?.status || 'No Data',
            year: latestVerification?.year || new Date().getFullYear(),
            verified_by: latestVerification?.verified_by || []
          },
          unit_tree: unitTree
        }
      });
    } catch (error) {
      console.error('Dashboard data error:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve dashboard metrics.' });
    }
  }
};

module.exports = dashboardController;
