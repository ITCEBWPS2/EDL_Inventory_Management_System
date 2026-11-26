const db = require('../services/db');
const VerificationTeam = require('../models/VerificationTeam');
const auditLogger = require('../services/auditLogger');

/**
 * Controller for Verification Teams management.
 * Provides hierarchical locations, team appointment CRUD, and persistence.
 */
const verificationTeamController = {
  /**
   * Get the full organizational hierarchy tree of locations.
   * Reuses the exact same database query as the User Management tree.
   */
  async getLocations(req, res) {
    try {
      const allUnits = await db.getUnits();

      const getSortOrder = (item) => {
        if (item.sort_order !== undefined && item.sort_order !== null) {
          return Number(item.sort_order);
        }
        if (item.unit_code === 'PLANNING-WPS-II' || item.unit_name === 'PLANNING') {
          return 999;
        }
        return 0;
      };

      const sortNodes = (nodes) => {
        return [...nodes].sort((a, b) => getSortOrder(a) - getSortOrder(b));
      };

      // Build recursive hierarchical tree
      const buildSubTree = (parentId = null) => {
        const matching = allUnits.filter(u => (u.parent_unit_id || null) === parentId);
        return sortNodes(matching).map(u => ({
          _id: u._id || u.id,
          id: u.id || u._id,
          name: u.unit_name,
          unit_name: u.unit_name,
          unit_code: u.unit_code,
          code: u.unit_code,
          type: u.unit_type,
          unit_type: u.unit_type,
          parentId: u.parent_unit_id || null,
          parent_unit_id: u.parent_unit_id || null,
          location: u.location || '',
          sort_order: u.sort_order,
          children: buildSubTree(u.id)
        }));
      };

      const tree = buildSubTree(null);
      return res.json({ success: true, data: tree, allCount: allUnits.length });
    } catch (error) {
      console.error('Get verification locations error:', error);
      return res.status(500).json({ success: false, message: 'Failed to load organizational locations tree.' });
    }
  },

  /**
   * Get all verification teams for a given year.
   */
  async getTeams(req, res) {
    try {
      const currentYear = new Date().getFullYear();
      const year = req.query.year ? Number(req.query.year) : currentYear;

      const teams = await VerificationTeam.find({ year }).lean();
      return res.json({ success: true, data: teams });
    } catch (error) {
      console.error('Get verification teams error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch verification teams.' });
    }
  },

  /**
   * Save or update verification team for a location and year.
   * Validates exactly 3 members (name + designation).
   */
  async saveTeam(req, res) {
    try {
      const { year, unit_id, unit_name, unit_path, members } = req.body;

      if (!year || isNaN(Number(year))) {
        return res.status(400).json({ success: false, message: 'A valid verification year is required.' });
      }

      if (!unit_id || !unit_name) {
        return res.status(400).json({ success: false, message: 'Location unit_id and unit_name are required.' });
      }

      if (!Array.isArray(members) || members.length !== 3) {
        return res.status(400).json({
          success: false,
          message: 'Exactly 3 team members (name and designation) are required.'
        });
      }

      // Check each member's name and designation
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m || !m.name || !String(m.name).trim()) {
          return res.status(400).json({
            success: false,
            message: `Member ${i + 1} name is required.`
          });
        }
        if (!m.designation || !String(m.designation).trim()) {
          return res.status(400).json({
            success: false,
            message: `Member ${i + 1} designation is required.`
          });
        }
      }

      const cleanMembers = members.map(m => ({
        name: String(m.name).trim(),
        designation: String(m.designation).trim()
      }));

      const resolvedPath = unit_path || unit_name;

      const updatedTeam = await VerificationTeam.findOneAndUpdate(
        { year: Number(year), unit_id: String(unit_id) },
        {
          year: Number(year),
          unit_id: String(unit_id),
          unit_name: String(unit_name).trim(),
          unit_path: String(resolvedPath).trim(),
          members: cleanMembers,
          updated_by: req.user?.id || req.user?.username || null
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Verification',
        status: 'success',
        entity_type: 'VerificationTeam',
        entity_id: String(unit_id),
        entity_reference: `${unit_name} (${year})`,
        unit_id: String(unit_id),
        unit_name: String(unit_name),
        description: `${req.user?.full_name || 'User'} saved verification team for '${unit_name}' (${year})`,
        req,
        res
      });

      return res.status(200).json({
        success: true,
        message: `Verification team for ${unit_name} saved successfully.`,
        data: updatedTeam
      });
    } catch (error) {
      console.error('Save verification team error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to save verification team.' });
    }
  },

  /**
   * Delete a verification team record.
   */
  async deleteTeam(req, res) {
    try {
      const { unitId } = req.params;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      const deleted = await VerificationTeam.findOneAndDelete({
        unit_id: unitId,
        year
      });

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Verification team not found.' });
      }

      await auditLogger.log({
        action: 'DELETE',
        module: 'Verification',
        status: 'success',
        entity_type: 'VerificationTeam',
        entity_id: unitId,
        entity_reference: `${deleted.unit_name} (${year})`,
        unit_id: unitId,
        unit_name: deleted.unit_name,
        description: `${req.user?.full_name || 'User'} removed verification team for '${deleted.unit_name}' (${year})`,
        req,
        res
      });

      return res.json({ success: true, message: 'Verification team removed successfully.' });
    } catch (error) {
      console.error('Delete verification team error:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete verification team.' });
    }
  }
};

module.exports = verificationTeamController;
