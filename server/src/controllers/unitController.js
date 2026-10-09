const db = require('../services/db');

const unitController = {
  /**
   * Get units list, optionally filtered by user access
   */
  async getUnits(req, res) {
    try {
      const allUnits = await db.getUnits();
      
      // If Super Admin or Local Admin, return all
      if (req.user.role === 'super_admin' || req.user.role === 'local_admin') {
        return res.json({ success: true, data: allUnits });
      }

      // For others, return units assigned to user or child units
      const userUnitIds = req.user.unitIds || [];
      const accessibleUnits = allUnits.filter(u => userUnitIds.includes(u.id));

      return res.json({ success: true, data: accessibleUnits });
    } catch (error) {
      console.error('Get units error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch units.' });
    }
  },

  /**
   * Get hierarchical tree representation (Area -> Sub-area/CSC -> Unit)
   */
  async getUnitTree(req, res) {
    try {
      const allUnits = await db.getUnits();
      
      // Build recursive hierarchical tree
      const buildSubTree = (parentId = null) => {
        return allUnits
          .filter(u => u.parent_unit_id === parentId)
          .map(u => ({
            ...u,
            children: buildSubTree(u.id)
          }));
      };

      const tree = buildSubTree(null);

      return res.json({ success: true, data: tree });
    } catch (error) {
      console.error('Get unit tree error:', error);
      return res.status(500).json({ success: false, message: 'Failed to build unit tree.' });
    }
  },

  /**
   * Create organizational unit
   */
  async createUnit(req, res) {
    try {
      const { unit_name, unit_code, unit_type, parent_unit_id, location, status } = req.body;
      if (!unit_name || !unit_code || !unit_type || !location) {
        return res.status(400).json({
          success: false,
          message: 'Unit name, unit code, unit type, and location are required.'
        });
      }

      const newUnit = await db.createUnit({
        unit_name,
        unit_code,
        unit_type,
        parent_unit_id,
        location,
        status
      });

      return res.status(201).json({
        success: true,
        message: 'Unit created successfully.',
        data: newUnit
      });
    } catch (error) {
      console.error('Create unit error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create unit.' });
    }
  },

  /**
   * Update organizational unit
   */
  async updateUnit(req, res) {
    try {
      const { id } = req.params;
      const { unit_name, unit_code, unit_type, parent_unit_id, location, status } = req.body;

      const updated = await db.updateUnit(id, {
        unit_name,
        unit_code,
        unit_type,
        parent_unit_id,
        location,
        status
      });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Unit not found.' });
      }

      return res.json({
        success: true,
        message: 'Unit updated successfully.',
        data: updated
      });
    } catch (error) {
      console.error('Update unit error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update unit.' });
    }
  }
};

module.exports = unitController;
