const { mongoose } = require('../config/mongo');

/**
 * Standard Permission Keys across EDL IMS:
 * 1. view_inventory: View inventory items, categories, transactions, vouchers
 * 2. add_inventory: Add new inventory items, received/expended vouchers, verification records
 * 3. update_inventory: Edit/update item details, transaction records
 * 4. delete_inventory: Delete inventory items, transaction vouchers, records
 * 5. view_reports: Access reports section and export CSVs
 * 6. manage_permissions: Access User Management and edit role permissions matrix
 */
const PERMISSION_KEYS = [
  'view_inventory',
  'add_inventory',
  'update_inventory',
  'delete_inventory',
  'view_reports',
  'manage_permissions'
];

const DEFAULT_EMPLOYEE_PERMISSIONS = {
  view_inventory: true,
  add_inventory: true,
  update_inventory: true,
  delete_inventory: false, // RESTRICT by default for Employee role
  view_reports: true,
  manage_permissions: false // RESTRICT by default for Employee role
};

const DEFAULT_READONLY_PERMISSIONS = {
  view_inventory: true,
  add_inventory: false,
  update_inventory: false,
  delete_inventory: false,
  view_reports: true,
  manage_permissions: false
};

const DEFAULT_NOPERM_PERMISSIONS = {
  view_inventory: false,
  add_inventory: false,
  update_inventory: false,
  delete_inventory: false,
  view_reports: false,
  manage_permissions: false
};

const DEFAULT_ADMIN_PERMISSIONS = {
  view_inventory: true,
  add_inventory: true,
  update_inventory: true,
  delete_inventory: true,
  view_reports: true,
  manage_permissions: true
};

const DEFAULT_UNIT_HEAD_PERMISSIONS = {
  view_inventory: true,
  add_inventory: true,
  update_inventory: true,
  delete_inventory: true,
  view_reports: true,
  manage_permissions: false
};

// In-memory cache for customized role permissions
let cachedMatrix = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

async function getRolePermissionsCollection() {
  if (mongoose.connection.readyState !== 1) {
    const { connect } = require('../config/mongo');
    await connect();
  }
  return mongoose.connection.db.collection('role_permissions');
}

/**
 * Fetches the active permissions matrix from DB with fallback to defaults.
 */
async function getPermissionsMatrix() {
  const now = Date.now();
  if (cachedMatrix && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMatrix;
  }

  try {
    const col = await getRolePermissionsCollection();
    const doc = await col.findOne({ key: 'role_matrix' });
    if (doc && doc.matrix) {
      cachedMatrix = {
        employee: { ...DEFAULT_EMPLOYEE_PERMISSIONS, ...(doc.matrix.employee || {}) }
      };
      lastCacheTime = now;
      return cachedMatrix;
    }
  } catch (err) {
    console.warn('[permissionService] Failed to load role_permissions collection, using defaults:', err.message);
  }

  cachedMatrix = {
    employee: { ...DEFAULT_EMPLOYEE_PERMISSIONS }
  };
  lastCacheTime = now;
  return cachedMatrix;
}

/**
 * Updates the employee role permissions matrix.
 */
async function updatePermissionsMatrix(employeePermissions = {}, updatedBy = null) {
  const col = await getRolePermissionsCollection();
  const cleanPermissions = {};
  PERMISSION_KEYS.forEach((k) => {
    if (typeof employeePermissions[k] !== 'undefined') {
      cleanPermissions[k] = Boolean(employeePermissions[k]);
    } else {
      cleanPermissions[k] = DEFAULT_EMPLOYEE_PERMISSIONS[k];
    }
  });

  await col.updateOne(
    { key: 'role_matrix' },
    {
      $set: {
        key: 'role_matrix',
        'matrix.employee': cleanPermissions,
        updated_at: new Date(),
        updated_by: updatedBy
      }
    },
    { upsert: true }
  );

  cachedMatrix = {
    employee: cleanPermissions
  };
  lastCacheTime = Date.now();
  return cleanPermissions;
}

/**
 * Resolves permissions for a user based on role, permission_level, and matrix overrides.
 */
async function getPermissionsForUser(user) {
  if (!user || !user.role) {
    return { ...DEFAULT_NOPERM_PERMISSIONS };
  }

  // Super Admin and Local Admin have full permissions
  if (user.role === 'super_admin' || user.role === 'local_admin') {
    return { ...DEFAULT_ADMIN_PERMISSIONS };
  }

  // Unit Head has full inventory CRUD and reports, but cannot manage user permissions
  if (user.role === 'unit_head') {
    return { ...DEFAULT_UNIT_HEAD_PERMISSIONS };
  }

  // Employee role:
  if (user.role === 'employee') {
    if (user.permission_level === 'no_permission' || user.permission_level === 'disposal_only') {
      return { ...DEFAULT_NOPERM_PERMISSIONS };
    }
    if (user.permission_level === 'read_only') {
      return { ...DEFAULT_READONLY_PERMISSIONS };
    }

    // Default or read_write: load configured matrix
    const matrix = await getPermissionsMatrix();
    return {
      ...DEFAULT_EMPLOYEE_PERMISSIONS,
      ...(matrix?.employee || {})
    };
  }

  return { ...DEFAULT_NOPERM_PERMISSIONS };
}

module.exports = {
  PERMISSION_KEYS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  DEFAULT_READONLY_PERMISSIONS,
  DEFAULT_NOPERM_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_UNIT_HEAD_PERMISSIONS,
  getPermissionsMatrix,
  updatePermissionsMatrix,
  getPermissionsForUser
};

