const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../services/db');
const { Profile } = require('../models');
const auditLogger = require('../services/auditLogger');
const {
  EMAIL_REGEX,
  validateEmail,
  validateUsername,
  normalizeIdentifier
} = require('../utils/authValidation');

const escapeRegex = (s) => String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

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

      if (!email || !String(email).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required.'
        });
      }

      const normalizedEmail = normalizeIdentifier(email);
      const emailErr = validateEmail(normalizedEmail);
      if (emailErr) {
        return res.status(400).json({
          success: false,
          message: emailErr
        });
      }

      const existingEmail = await db.getProfileByEmail(normalizedEmail);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use.'
        });
      }

      // Enforce unit assignment (optional for disposal_only)
      const isDisposalOnly = role === 'employee' && permission_level === 'disposal_only';
      let selectedUnitId = null;
      if (unit_id) {
        selectedUnitId = unit_id;
      } else if (Array.isArray(unit_ids)) {
        if (unit_ids.length > 1) {
          return res.status(400).json({
            success: false,
            message: 'Each user must be assigned to at most one unit.'
          });
        }
        selectedUnitId = unit_ids[0] || null;
      } else if (typeof unit_ids === 'string') {
        selectedUnitId = unit_ids;
      }

      if (!selectedUnitId && !isDisposalOnly) {
        return res.status(400).json({
          success: false,
          message: 'Each user must be assigned to exactly one unit.'
        });
      }

      let targetUnit = null;
      if (selectedUnitId) {
        const allUnits = await db.getUnits();
        targetUnit = allUnits.find(u => u.id === selectedUnitId);
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
      }

      const normalizedUsername = normalizeIdentifier(username);
      const usernameErr = validateUsername(normalizedUsername);
      if (usernameErr) {
        return res.status(400).json({
          success: false,
          message: usernameErr
        });
      }

      const existing = await db.getProfileByUsername(normalizedUsername);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Username already in use.'
        });
      }

      // Permission level rules:
      // Only employee role uses permission_level: 'read_write', 'read_only', 'no_permission', 'disposal_only'
      // Non-employee roles (super_admin, local_admin, unit_head) must have permission_level: null
      let assignedPermission = null;
      if (role === 'employee') {
        const validPerms = ['read_write', 'read_only', 'no_permission', 'disposal_only'];
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
        email: normalizedEmail,
        role,
        permission_level: assignedPermission,
        contact_info: contact_info || '',
        account_status: 'active',
        password_hash
      }, req.user.role);

      // Write unit assignment if provided (optional for disposal_only)
      if (selectedUnitId) {
        await db.setUserUnits(newId, [selectedUnitId]);
      } else {
        await db.setUserUnits(newId, []);
      }

      await auditLogger.log({
        action: 'CREATE',
        module: 'Users',
        status: 'success',
        entity_type: 'User',
        entity_id: newId,
        entity_reference: profile.username,
        unit_id: selectedUnitId,
        description: `${req.user.full_name} (${req.user.role}) created user account '${profile.username}' (${profile.role})`,
        changes: auditLogger.snapshot(profile),
        req,
        res
      });

      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: {
          ...profile,
          units: targetUnit ? [targetUnit] : []
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern?.email || (error.message && error.message.includes('email'))) {
          return res.status(400).json({ success: false, message: 'Email already in use.' });
        }
        if (error.keyPattern?.username || (error.message && error.message.includes('username'))) {
          return res.status(400).json({ success: false, message: 'Username already in use.' });
        }
      }
      console.error('Create user error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { full_name, email, role, permission_level, contact_info, account_status, unit_id, unit_ids } = req.body;

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
      const finalRole = role !== undefined ? role : profile.role;
      const finalPerm = permission_level !== undefined ? permission_level : profile.permission_level;
      const isDisposalOnly = finalRole === 'employee' && finalPerm === 'disposal_only';

      let selectedUnitId = undefined;
      if (unit_id !== undefined) {
        selectedUnitId = unit_id;
      } else if (unit_ids !== undefined) {
        if (Array.isArray(unit_ids)) {
          if (unit_ids.length > 1) {
            return res.status(400).json({
              success: false,
              message: 'Each user must be assigned to at most one unit.'
            });
          }
          selectedUnitId = unit_ids[0] || null;
        } else if (typeof unit_ids === 'string') {
          selectedUnitId = unit_ids;
        }
      }

      if (selectedUnitId !== undefined) {
        if (!selectedUnitId) {
          if (!isDisposalOnly) {
            return res.status(400).json({
              success: false,
              message: 'Each user must be assigned to exactly one unit.'
            });
          }
          // For disposal_only, empty unit clears unit assignment (handles all units)
          await db.setUserUnits(id, []);
        } else {
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
      }

      const updates = {};
      if (email !== undefined) {
        if (!email || !String(email).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Email address is required.'
          });
        }
        const normalizedEmail = normalizeIdentifier(email);
        const emailErr = validateEmail(normalizedEmail);
        if (emailErr) {
          return res.status(400).json({
            success: false,
            message: emailErr
          });
        }
        const existingWithEmail = await Profile.findOne({ email: normalizedEmail, id: { $ne: id } })
          .collation({ locale: 'en', strength: 2 }).lean() ||
          await Profile.findOne({ email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i'), id: { $ne: id } }).lean();
        if (existingWithEmail) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use.'
          });
        }
        updates.email = normalizedEmail;
      } else if (!profile.email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required.'
        });
      }

      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) updates.role = role;
      
      if (finalRole === 'employee') {
        if (permission_level !== undefined) {
          const validPerms = ['read_write', 'read_only', 'no_permission', 'disposal_only'];
          updates.permission_level = validPerms.includes(permission_level) ? permission_level : 'read_write';
        }
      } else {
        updates.permission_level = null;
      }

      if (contact_info !== undefined) updates.contact_info = contact_info;
      if (account_status !== undefined) updates.account_status = account_status;

      const existing = await db.getProfileById(id);
      const updated = await db.updateProfile(id, updates, req.user.role);

      const allUnits = await db.getUnits();
      const assignedUnitIds = await db.getUserUnits(id);

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Users',
        status: 'success',
        entity_type: 'User',
        entity_id: id,
        entity_reference: updated.username,
        unit_id: assignedUnitIds[0] || null,
        description: `${req.user.full_name} (${req.user.role}) updated user account '${updated.username}'`,
        changes: auditLogger.diff(existing, updated),
        req,
        res
      });

      return res.json({
        success: true,
        message: 'User updated successfully.',
        data: {
          ...updated,
          units: allUnits.filter(u => assignedUnitIds.includes(u.id))
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        if (error.keyPattern?.email || (error.message && error.message.includes('email'))) {
          return res.status(400).json({ success: false, message: 'Email already in use.' });
        }
        if (error.keyPattern?.username || (error.message && error.message.includes('username'))) {
          return res.status(400).json({ success: false, message: 'Username already in use.' });
        }
      }
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

      await auditLogger.log({
        action: newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
        module: 'Users',
        status: 'success',
        entity_type: 'User',
        entity_id: id,
        entity_reference: profile.username,
        description: `${req.user.full_name} (${req.user.role}) changed account status of '${profile.username}' to ${newStatus}`,
        req,
        res
      });

      return res.json({
        success: true,
        message: `User status changed to ${newStatus}.`,
        data: updated
      });
    } catch (error) {
      console.error('Toggle status error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update user status.' });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Prevent user from deleting their own account
      if (req.user.id === id) {
        return res.status(403).json({
          success: false,
          message: 'You cannot delete your own account.'
        });
      }

      // Check if user exists
      const profile = await db.getProfileById(id);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      // Local Admin cannot delete Super Admin
      if (req.user.role === 'local_admin' && profile.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Local Admins cannot delete Super Admin accounts.'
        });
      }

      // Never allow deleting the last remaining Super Admin
      if (profile.role === 'super_admin') {
        const superAdminCount = await db.countSuperAdmins();
        if (superAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Cannot delete the last remaining Super Admin account.'
          });
        }
      }

      // Delete profile and remove user_units assignments in the same operation
      await db.deleteProfile(id);

      await auditLogger.log({
        action: 'DELETE',
        module: 'Users',
        status: 'success',
        entity_type: 'User',
        entity_id: id,
        entity_reference: profile.username,
        description: `${req.user.full_name} (${req.user.role}) deleted user account '${profile.username}'`,
        changes: auditLogger.snapshot(profile),
        req,
        res
      });

      return res.json({
        success: true,
        message: 'User deleted successfully.'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user.'
      });
    }
  }
};

module.exports = userController;
