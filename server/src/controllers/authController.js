const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const db = require('../services/db');
const auditLogger = require('../services/auditLogger');
const permissionService = require('../services/permissionService');
const {
  normalizeIdentifier,
  validateIdentifier,
  validatePassword,
  validateNewPassword
} = require('../utils/authValidation');

const signUserToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      username: user.username,
      role: user.role,
      permission_level: user.permission_level,
    },
    env.JWT_SECRET || env.JWT_DEV_FALLBACK_SECRET,
    { expiresIn: '7d' }
  );
};

const authController = {
  /**
   * Login with username/email and password
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      const identifierError = validateIdentifier(username);
      if (identifierError) {
        return res.status(400).json({
          success: false,
          message: identifierError
        });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({
          success: false,
          message: passwordError
        });
      }

      const normalizedIdentifier = normalizeIdentifier(username);

      let profile = await db.getProfileByUsername(normalizedIdentifier);

      // Also try email matching
      if (!profile) {
        profile = await db.getProfileByEmail(normalizedIdentifier);
      }

      if (!profile) {
        await auditLogger.log({
          action: 'LOGIN_FAILED',
          module: 'Auth',
          status: 'failed',
          actor_username: normalizedIdentifier,
          description: `Failed login attempt: username '${normalizedIdentifier}' not found`,
          error_message: 'User not found',
          req,
          res
        });
        return res.status(401).json({
          success: false,
          message: 'Incorrect username/email or password.'
        });
      }

      if (profile.account_status !== 'active') {
        await auditLogger.log({
          action: 'LOGIN_FAILED',
          module: 'Auth',
          status: 'failed',
          actor_id: profile.id,
          actor_name: profile.full_name,
          actor_username: profile.username,
          actor_role: profile.role,
          description: `Failed login attempt: account is ${profile.account_status} for user '${profile.username}'`,
          error_message: `Account is ${profile.account_status}`,
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Your account is inactive. Contact your administrator.'
        });
      }

      // Verify password with bcrypt (case-sensitive, untrimmed)
      const passwordHash = profile.password_hash || profile.passwordHash;
      let passwordMatches = false;
      if (passwordHash) {
        if (passwordHash.startsWith('$2')) {
          passwordMatches = await bcrypt.compare(password, passwordHash);
        } else {
          passwordMatches = (passwordHash === password);
        }
      }

      if (!passwordMatches) {
        await auditLogger.log({
          action: 'LOGIN_FAILED',
          module: 'Auth',
          status: 'failed',
          actor_id: profile.id,
          actor_name: profile.full_name,
          actor_username: profile.username,
          actor_role: profile.role,
          unit_id: profile.unit_id || null,
          description: `Failed login attempt: incorrect password for user '${profile.username}'`,
          error_message: 'Invalid credentials',
          req,
          res
        });
        return res.status(401).json({
          success: false,
          message: 'Incorrect username/email or password.'
        });
      }

      const token = signUserToken(profile);

      // Load assigned units
      const unitIds = await db.getUserUnits(profile.id);
      const allUnits = await db.getUnits();
      const userUnits = allUnits.filter(u => unitIds.includes(u.id));

      await auditLogger.log({
        action: 'LOGIN',
        module: 'Auth',
        status: 'success',
        actor_id: profile.id,
        actor_name: profile.full_name,
        actor_username: profile.username,
        actor_role: profile.role,
        unit_id: profile.unit_id || userUnits[0]?.id || null,
        unit_name: userUnits[0]?.unit_name || '',
        description: `User '${profile.full_name}' (${profile.role}) logged in successfully`,
        req,
        res
      });

      const userPermissions = await permissionService.getPermissionsForUser(profile);

      return res.json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          user: {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            permission_level: profile.permission_level,
            contact_info: profile.contact_info,
            account_status: profile.account_status,
            units: userUnits,
            permissions: userPermissions
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while logging in.'
      });
    }
  },

  /**
   * Public registration is disabled: user profiles must only be provisioned by Super Admin or Local Admin
   */
  async register(req, res) {
    return res.status(403).json({
      success: false,
      message: 'Public self-registration is disabled. Staff accounts must be provisioned by a Super Admin or Local Admin through User Management.'
    });
  },

  /**
   * Get current authenticated user profile and unit contexts
   */
  async getMe(req, res) {
    try {
      const allUnits = await db.getUnits();
      const userUnits = allUnits.filter(u => (req.user.unitIds || []).includes(u.id));
      const userPermissions = await permissionService.getPermissionsForUser(req.user);

      return res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            username: req.user.username,
            full_name: req.user.full_name,
            email: req.user.email,
            role: req.user.role,
            permission_level: req.user.permission_level,
            contact_info: req.user.contact_info,
            account_status: req.user.account_status,
            units: userUnits,
            permissions: userPermissions
          }
        }
      });
    } catch (error) {
      console.error('Get me error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile data.'
      });
    }
  },

  /**
   * Get Role Permissions Matrix
   * GET /api/auth/permissions/matrix
   */
  async getPermissionsMatrix(req, res) {
    try {
      const matrix = await permissionService.getPermissionsMatrix();
      return res.json({
        success: true,
        matrix
      });
    } catch (error) {
      console.error('Get permissions matrix error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve permissions matrix.'
      });
    }
  },

  /**
   * Update Role Permissions Matrix (Admin only)
   * PUT /api/auth/permissions/matrix
   */
  async updatePermissionsMatrix(req, res) {
    try {
      const { employee } = req.body;
      const updated = await permissionService.updatePermissionsMatrix(employee, req.user?.id);

      await auditLogger.log({
        action: 'UPDATE',
        module: 'Users',
        status: 'success',
        entity_type: 'RolePermissions',
        entity_id: 'role_matrix',
        entity_reference: 'Employee Role Permissions Matrix',
        description: `${req.user?.full_name || 'Admin'} (${req.user?.role}) updated Employee role permissions matrix`,
        changes: updated,
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Role permissions matrix updated successfully.',
        matrix: { employee: updated }
      });
    } catch (error) {
      console.error('Update permissions matrix error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update permissions matrix.'
      });
    }
  },

  /**
   * Public Forgot Password flow
   * POST /api/auth/forgot-password
   * Body: { username, newPassword, confirmPassword }
   */
  async forgotPassword(req, res) {
    const fail = async (status, message) => {
      await new Promise((r) => setTimeout(r, 400));
      return res.status(status).json({ success: false, message });
    };

    try {
      const {
        username,
        newPassword,
        confirmPassword,
        new_password,
        confirm_password
      } = req.body;

      const rawNewPassword = newPassword || new_password;
      const rawConfirmPassword = confirmPassword || confirm_password;

      const identifierError = validateIdentifier(username);
      if (identifierError) {
        return await fail(400, identifierError);
      }

      if (!rawNewPassword) {
        return await fail(400, 'Enter a new password.');
      }

      const passwordRuleError = validateNewPassword(rawNewPassword);
      if (passwordRuleError) {
        return await fail(400, passwordRuleError);
      }

      if (rawNewPassword !== rawConfirmPassword) {
        return await fail(400, 'Passwords do not match.');
      }

      const normalizedIdentifier = normalizeIdentifier(username);
      let profile = await db.getProfileByUsername(normalizedIdentifier);
      if (!profile) {
        profile = await db.getProfileByEmail(normalizedIdentifier);
      }

      // Generic error response if user not found: never reveal whether username exists!
      if (!profile) {
        return await fail(400, 'Unable to reset the password. Please check the details and try again.');
      }

      // Hash and save new password
      const newPasswordHash = await bcrypt.hash(rawNewPassword, 10);
      await db.updateProfile(profile.id, { password_hash: newPasswordHash });

      await auditLogger.log({
        action: 'FORGOT_PASSWORD_RESET',
        module: 'Auth',
        status: 'success',
        actor_id: profile.id,
        actor_name: profile.full_name,
        actor_username: profile.username,
        actor_role: profile.role,
        entity_type: 'User',
        entity_id: profile.id,
        entity_reference: profile.username,
        description: `Password reset via public forgot-password for user '${profile.username}'`,
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Password updated. You can now log in.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      return await fail(500, 'Unable to reset the password. Please check the details and try again.');
    }
  },

  /**
   * Public Update Password flow (verifies current password)
   * POST /api/auth/update-password & POST /api/auth/reset-password
   * Body: { username, current_password, new_password }
   */
  async updatePassword(req, res) {
    const fail = async (status, message) => {
      await new Promise((r) => setTimeout(r, 400));
      return res.status(status).json({ success: false, message });
    };

    try {
      const {
        username,
        current_password,
        old_password,
        currentPassword,
        oldPassword,
        new_password,
        newPassword
      } = req.body;

      const rawCurrentPassword = current_password || old_password || currentPassword || oldPassword;
      const rawNewPassword = new_password || newPassword;

      const identifierError = validateIdentifier(username);
      if (identifierError) {
        return await fail(400, identifierError);
      }

      if (!rawCurrentPassword) {
        return await fail(400, 'Enter your current password.');
      }

      if (!rawNewPassword) {
        return await fail(400, 'Enter your new password.');
      }

      const passwordRuleError = validateNewPassword(rawNewPassword);
      if (passwordRuleError) {
        return await fail(400, passwordRuleError);
      }

      const normalizedIdentifier = normalizeIdentifier(username);
      let profile = await db.getProfileByUsername(normalizedIdentifier);
      if (!profile) {
        profile = await db.getProfileByEmail(normalizedIdentifier);
      }

      // Generic error if user not found: single generic message
      if (!profile) {
        return await fail(400, 'Username or current password is incorrect.');
      }

      // Verify current password with bcrypt
      const passwordHash = profile.password_hash || profile.passwordHash;
      let passwordMatches = false;
      if (passwordHash) {
        if (passwordHash.startsWith('$2')) {
          passwordMatches = await bcrypt.compare(rawCurrentPassword, passwordHash);
        } else {
          passwordMatches = (passwordHash === rawCurrentPassword);
        }
      }

      // Wrong current password returns single generic message
      if (!passwordMatches) {
        return await fail(400, 'Username or current password is incorrect.');
      }

      // New password must differ from current password
      if (rawNewPassword === rawCurrentPassword) {
        return await fail(400, 'New password must be different from the current password.');
      }

      // Hash and save new password
      const newPasswordHash = await bcrypt.hash(rawNewPassword, 10);
      await db.updateProfile(profile.id, { password_hash: newPasswordHash });

      await auditLogger.log({
        action: 'PASSWORD_UPDATED',
        module: 'Auth',
        status: 'success',
        actor_id: profile.id,
        actor_name: profile.full_name,
        actor_username: profile.username,
        actor_role: profile.role,
        entity_type: 'User',
        entity_id: profile.id,
        entity_reference: profile.username,
        description: `Password updated with current credentials verification for user '${profile.username}'`,
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Password updated. You can now log in.'
      });
    } catch (error) {
      console.error('Update password error:', error);
      return await fail(500, 'Failed to update password.');
    }
  },

  /**
   * Backward compatible resetPassword alias
   */
  async resetPassword(req, res) {
    return authController.updatePassword(req, res);
  },

  /**
   * User logout endpoint
   */
  async logout(req, res) {
    try {
      if (req.user) {
        await auditLogger.log({
          action: 'LOGOUT',
          module: 'Auth',
          status: 'success',
          actor_id: req.user.id,
          actor_name: req.user.full_name,
          actor_username: req.user.username,
          actor_role: req.user.role,
          description: `User '${req.user.full_name}' logged out`,
          req,
          res
        });
      }
      return res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
      return res.json({ success: true, message: 'Logged out.' });
    }
  }
};

module.exports = authController;
