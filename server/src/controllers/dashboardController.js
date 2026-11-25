const db = require('../services/db');

const dashboardController = {
  async getDashboardData(req, res) {
    try {
      const { unit_id } = req.query;
      const allUnits = await db.getUnits();

      const getDescendantUnitIds = (unitId) => {
        const ids = [unitId];
        const collect = (pId) => {
          for (const u of allUnits) {
            if (u.parent_unit_id === pId) {
              ids.push(u.id);
              collect(u.id);
            }
          }
        };
        collect(unitId);
        return ids;
      };

      let targetUnits = null;

      if (req.user.role !== 'super_admin' && req.user.role !== 'local_admin') {
        const authorized = req.user.unitIds || [];
        if (unit_id) {
          const scopedIds = getDescendantUnitIds(unit_id);
          const allowed = scopedIds.filter(id => authorized.includes(id));
          if (!authorized.includes(unit_id) && allowed.length === 0) {
            return res.status(403).json({ success: false, message: 'Access Denied.' });
          }
          targetUnits = allowed.length > 0 ? allowed : [unit_id];
        } else {
          targetUnits = authorized;
        }
      } else if (unit_id) {
        targetUnits = getDescendantUnitIds(unit_id);
      }

      // 1. Fetch relevant datasets
      const items = await db.getInventoryItems(targetUnits);
      const remainingList = await db.getRemainingInventory(targetUnits);
      const receivedTx = await db.getReceivedTransactions(targetUnits);
      const expendedTx = await db.getExpendedTransactions(targetUnits);
      const verifications = await db.getVerifications(targetUnits);

      // 2. Compute KPI Metrics
      const totalUniqueItems = items.length;
      const totalReceivedQuantity = receivedTx.reduce((sum, r) => sum + Number(r.quantity), 0);
      const totalExpendedQuantity = expendedTx.reduce((sum, e) => sum + Number(e.quantity), 0);
      const totalRemainingStock = remainingList.reduce((sum, r) => sum + Number(r.remaining_qty), 0);

      const lowStockCount = remainingList.filter(r => r.stock_status === 'Low Stock').length;
      const outOfStockCount = remainingList.filter(r => r.stock_status === 'Out of Stock').length;

      // 3. Category Breakdown (for Donut Chart: Inventory Totals by Category)
      // Built from inventory_items of the active unit (targetUnits), summing quantity of every item per category.
      // Matches the logic and filters of the Master Item Catalog and Current Inventory Report.
      const categoryMap = {};
      let grandTotalInventory = 0;

      items.forEach(item => {
        const rawSerials = Array.isArray(item.serial_numbers) ? item.serial_numbers.filter(Boolean) : [];
        const qty = rawSerials.length > 0 ? rawSerials.length : Math.max(1, Number(item.quantity) || 1);
        const cat = item.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + qty;
        grandTotalInventory += qty;
      });

      const categoryBreakdown = Object.keys(categoryMap).map(name => {
        const quantity = categoryMap[name];
        const percentage = grandTotalInventory > 0 ? Math.round((quantity / grandTotalInventory) * 100) : 0;
        return {
          name,
          quantity,
          percentage
        };
      }).sort((a, b) => b.quantity - a.quantity);

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
      combinedRecent.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createB - createA;
      });
      const recentTransactions = combinedRecent.slice(0, 8);

      // 5. Verification Status (Latest CONFIRMED verification only; draft/cancelled ignored)
      const confirmedVerifications = verifications
        .filter(v => v.status === 'confirmed')
        .sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          if (dateA !== dateB) return dateB - dateA;
          const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return createB - createA;
        });

      const latestConfirmed = confirmedVerifications.length > 0 ? confirmedVerifications[0] : null;

      const lastVerification = latestConfirmed ? {
        id: latestConfirmed.id,
        date: latestConfirmed.date,
        year: latestConfirmed.year,
        unit_id: latestConfirmed.unit_id,
        unit_name: latestConfirmed.unit_name || null,
        status: latestConfirmed.status,
        verified_by: (latestConfirmed.verified_by && latestConfirmed.verified_by.length > 0)
          ? latestConfirmed.verified_by
          : [latestConfirmed.verifier_1, latestConfirmed.verifier_2, latestConfirmed.verifier_3].filter(Boolean)
      } : null;

      // 6. Unit Hierarchy Tree for dashboard browser (supports deep arbitrary levels)
      const buildSubTree = (parentId = null) => {
        return allUnits
          .filter(u => u.parent_unit_id === parentId)
          .sort((a, b) => {
            const orderA = a.sort_order !== undefined && a.sort_order !== null ? Number(a.sort_order) : (a.unit_code === 'PLANNING-WPS-II' ? 999 : 0);
            const orderB = b.sort_order !== undefined && b.sort_order !== null ? Number(b.sort_order) : (b.unit_code === 'PLANNING-WPS-II' ? 999 : 0);
            return orderA - orderB;
          })
          .map(u => ({
            id: u.id,
            unit_name: u.unit_name,
            unit_code: u.unit_code,
            unit_type: u.unit_type,
            location: u.location,
            status: u.status,
            sort_order: u.sort_order !== undefined ? u.sort_order : 0,
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
          category_total: grandTotalInventory,
          grand_total: grandTotalInventory,
          recent_transactions: recentTransactions,
          last_verification: lastVerification,
          verification_status: {
            has_verification: !!latestConfirmed,
            status: latestConfirmed?.status || 'No Data',
            year: latestConfirmed?.year || new Date().getFullYear(),
            verified_by: lastVerification?.verified_by || []
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
