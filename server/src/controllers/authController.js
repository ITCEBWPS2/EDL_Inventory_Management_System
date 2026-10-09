const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const db = require('../services/db');

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
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required.'
        });
      }

      let profile = await db.getProfileByUsername(username);

      // Also try email matching
      if (!profile) {
        const allProfiles = await db.getAllProfiles();
        profile = allProfiles.find(p => p.email && p.email.toLowerCase() === username.toLowerCase());
      }

      if (!profile) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.'
        });
      }

      if (profile.account_status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Account is ${profile.account_status}. Please contact an administrator.`
        });
      }

      // Verify password with bcrypt
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
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.'
        });
      }

      const token = signUserToken(profile);

      // Load assigned units
      const unitIds = await db.getUserUnits(profile.id);
      const allUnits = await db.getUnits();
      const userUnits = allUnits.filter(u => unitIds.includes(u.id));

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
            units: userUnits
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
            units: userUnits
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
   * Reset / change password flow
   */
  async resetPassword(req, res) {
    try {
      const { username, old_password, new_password } = req.body;
      if (!username || !new_password) {
        return res.status(400).json({
          success: false,
          message: 'Username and new password are required.'
        });
      }

      const profile = await db.getProfileByUsername(username);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      if (old_password) {
        const passwordHash = profile.password_hash || profile.passwordHash;
        let isMatch = false;
        if (passwordHash) {
          if (passwordHash.startsWith('$2')) {
            isMatch = await bcrypt.compare(old_password, passwordHash);
          } else {
            isMatch = (passwordHash === old_password);
          }
        }
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: 'Current password verification failed.'
          });
        }
      }

      const newPasswordHash = await bcrypt.hash(new_password, 10);
      await db.updateProfile(profile.id, { password_hash: newPasswordHash });

      return res.json({
        success: true,
        message: 'Password has been updated successfully. You may now log in.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset password.'
      });
    }
  }
};

module.exports = authController;
