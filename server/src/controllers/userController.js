const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../services/db');

const userController = {
  async getAllUsers(req, res) {
    try {
      const profiles = await db.getAllProfiles();
      const allUnits = await db.getUnits();

      const usersWithUnits = await Promise.all(
        profiles.map(async (p) => {
          const unitIds = await db.getUserUnits(p.id);
          const assignedUnits = allUnits.filter(u => unitIds.includes(u.id));
          return {
            id: p.id,
            username: p.username,
            full_name: p.full_name,
            email: p.email,
            role: p.role,
            permission_level: p.permission_level,
            contact_info: p.contact_info,
            account_status: p.account_status,
            units: assignedUnits,
            created_at: p.created_at
          };
        })
      );

      return res.json({
        success: true,
        data: usersWithUnits
      });
    } catch (error) {
      console.error('Get all users error:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
  },

  async createUser(req, res) {
    try {
      const { username, full_name, email, role, permission_level, contact_info, unit_id, unit_ids, password } = req.body;

      if (!username || !full_name || !role) {
        return res.status(400).json({
          success: false,
          message: 'Username, full name, and role are required.'
        });
      }

      // Local Admin cannot create Super Admins
      if (req.user.role === 'local_admin' && role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Local Admins cannot create Super Admin accounts.'
        });
      }

      // Enforce exactly ONE unit assignment
      let selectedUnitId = null;
      if (unit_id) {
        selectedUnitId = unit_id;
      } else if (Array.isArray(unit_ids)) {
        if (unit_ids.length !== 1) {
          return res.status(400).json({
            success: false,
            message: 'Each user must be assigned to exactly one unit.'
          });
        }
        selectedUnitId = unit_ids[0];
      } else if (typeof unit_ids === 'string') {
        selectedUnitId = unit_ids;
      }

      if (!selectedUnitId) {
        return res.status(400).json({
          success: false,
          message: 'Each user must be assigned to exactly one unit.'
        });
      }

      const allUnits = await db.getUnits();
      const targetUnit = allUnits.find(u => u.id === selectedUnitId);
      if (!targetUnit) {
        return res.status(400).json({
          success: false,
          message: 'The selected unit does not exist.'
        });
      }

      // Branch nodes (unit_type === 'area') are structural only and cannot be assigned
      if (targetUnit.unit_type === 'area') {
        return res.status(400).json({
          success: false,
          message: 'Branch and area nodes are structural only and cannot be assigned to users. Please select an operational unit or CSC.'
        });
      }


      const existing = await db.getProfileByUsername(username);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Username already in use.'
        });
      }

      // Permission level rules:
      // Only employee role uses permission_level: 'read_write', 'read_only', 'no_permission'
      // Non-employee roles (super_admin, local_admin, unit_head) must have permission_level: null
      let assignedPermission = null;
      if (role === 'employee') {
        const validPerms = ['read_write', 'read_only', 'no_permission'];
        assignedPermission = validPerms.includes(permission_level) ? permission_level : 'read_write';
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to create a user account.'
        });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const newId = uuidv4();
      const profile = await db.createProfile({
        id: newId,
        username,
        full_name,
        email: email || `${username}@edl.lk`,
        role,
        permission_level: assignedPermission,
        contact_info: contact_info || '',
        account_status: 'active',
        password_hash
      }, req.user.role);

      // Strictly write exactly ONE row in user_units
      await db.setUserUnits(newId, [selectedUnitId]);

      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: {
          ...profile,
          units: [targetUnit]
        }
      });
    } catch (error) {
      console.error('Create user error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { full_name, role, permission_level, contact_info, account_status, unit_id, unit_ids } = req.body;

      const profile = await db.getProfileById(id);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // If caller is Local Admin, restrict managing Super Admin accounts
      if (req.user.role === 'local_admin') {
        if (profile.role === 'super_admin') {
          return res.status(403).json({ success: false, message: 'Local Admins cannot manage Super Admin accounts.' });
        }
        if (role === 'super_admin') {
          return res.status(403).json({ success: false, message: 'Local Admins cannot assign Super Admin role.' });
        }
      }

      // Validate single unit assignment if unit change requested
      let selectedUnitId = undefined;
      if (unit_id !== undefined) {
        selectedUnitId = unit_id;
      } else if (unit_ids !== undefined) {
        if (Array.isArray(unit_ids)) {
          if (unit_ids.length !== 1) {
            return res.status(400).json({
              success: false,
              message: 'Each user must be assigned to exactly one unit.'
            });
          }
          selectedUnitId = unit_ids[0];
        } else if (typeof unit_ids === 'string') {
          selectedUnitId = unit_ids;
        }
      }

      if (selectedUnitId !== undefined) {
        if (!selectedUnitId) {
          return res.status(400).json({
            success: false,
            message: 'Each user must be assigned to exactly one unit.'
          });
        }

        const allUnits = await db.getUnits();
        const targetUnit = allUnits.find(u => u.id === selectedUnitId);
        if (!targetUnit) {
          return res.status(400).json({
            success: false,
            message: 'The selected unit does not exist.'
          });
        }

        if (targetUnit.unit_type === 'area') {
          return res.status(400).json({
            success: false,
            message: 'Branch and area nodes are structural only and cannot be assigned to users. Please select an operational unit or CSC.'
          });
        }


        // Replace the existing unit assignment with the single new unit
        await db.setUserUnits(id, [selectedUnitId]);
      }

      const updates = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) updates.role = role;
      
      const finalRole = role !== undefined ? role : profile.role;
      if (finalRole === 'employee') {
        if (permission_level !== undefined) {
          const validPerms = ['read_write', 'read_only', 'no_permission'];
          updates.permission_level = validPerms.includes(permission_level) ? permission_level : 'read_write';
        }
      } else {
        updates.permission_level = null;
      }

      if (contact_info !== undefined) updates.contact_info = contact_info;
      if (account_status !== undefined) updates.account_status = account_status;

      const updated = await db.updateProfile(id, updates, req.user.role);

      const allUnits = await db.getUnits();
      const assignedUnitIds = await db.getUserUnits(id);

      return res.json({
        success: true,
        message: 'User updated successfully.',
        data: {
          ...updated,
          units: allUnits.filter(u => assignedUnitIds.includes(u.id))
        }
      });
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update user.' });
    }
  },

  async toggleStatus(req, res) {
    try {
      const { id } = req.params;
      const profile = await db.getProfileById(id);
      if (!profile) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (req.user.role === 'local_admin') {
        if (profile.role === 'super_admin') {
          return res.status(403).json({ success: false, message: 'Local Admins cannot alter Super Admin status.' });
        }
      }

      const newStatus = profile.account_status === 'active' ? 'inactive' : 'active';
      const updated = await db.updateProfile(id, { account_status: newStatus }, req.user.role);

      return res.json({
        success: true,
        message: `User status changed to ${newStatus}.`,
        data: updated
      });
    } catch (error) {
      console.error('Toggle status error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update user status.' });
    }
  }
};

module.exports = userController;
