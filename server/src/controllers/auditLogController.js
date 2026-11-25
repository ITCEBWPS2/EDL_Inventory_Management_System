const { AuditLog, Unit, Profile } = require('../models');
const db = require('../services/db');
const auditLogger = require('../services/auditLogger');

/**
 * Helper to compute allowed unit IDs for the current user
 */
async function resolveAllowedUnits(user) {
  if (user.role === 'super_admin') {
    return { isGlobal: true, allowedUnitIds: null };
  }

  if (user.role === 'local_admin') {
    const assigned = user.unitIds && user.unitIds.length ? user.unitIds : (user.unit_id ? [user.unit_id] : []);
    const allAllowedSets = await Promise.all(assigned.map(uId => db.getDescendantUnitIds(uId)));
    const allowedUnitIds = [...new Set(allAllowedSets.flat())];
    return { isGlobal: false, allowedUnitIds };
  }

  if (user.role === 'unit_head') {
    const headUnitId = user.unit_id || (user.unitIds && user.unitIds[0]) || null;
    return { isGlobal: false, allowedUnitIds: headUnitId ? [headUnitId] : [] };
  }

  return { isGlobal: false, allowedUnitIds: [] };
}

/**
 * Builds the MongoDB query object taking server-side unit scoping into account
 */
async function buildScopedQuery(user, queryParams = {}) {
  const { isGlobal, allowedUnitIds } = await resolveAllowedUnits(user);

  const query = {};

  // 1. Server-side Unit Scoping
  const requestedUnitId = queryParams.unit_id;

  if (isGlobal) {
    // Super Admin: can see all units; if a specific unit is requested, filter by it
    if (requestedUnitId && requestedUnitId !== 'all' && requestedUnitId !== 'All Units') {
      query.unit_id = requestedUnitId;
    }
  } else {
    // Local Admin and Unit Head
    if (!allowedUnitIds || allowedUnitIds.length === 0) {
      // User has no allowed units: cannot see any records
      query.unit_id = '__NO_ACCESS__';
      return { query, forbidden: false };
    }

    if (requestedUnitId && requestedUnitId !== 'all' && requestedUnitId !== 'All Units') {
      if (!allowedUnitIds.includes(requestedUnitId)) {
        return { query: null, forbidden: true };
      }
      query.unit_id = requestedUnitId;
    } else {
      query.unit_id = { $in: allowedUnitIds };
    }
  }

  // 2. Date Range Filter
  const { from, to, start_date, end_date } = queryParams;
  const fromDate = from || start_date;
  const toDate = to || end_date;

  if (fromDate || toDate) {
    query.created_at = {};
    if (fromDate) {
      const d = new Date(fromDate);
      d.setUTCHours(0, 0, 0, 0);
      query.created_at.$gte = d;
    }
    if (toDate) {
      const d = new Date(toDate);
      d.setUTCHours(23, 59, 59, 999);
      query.created_at.$lte = d;
    }
  }

  // 3. Actor / User Filter
  const actor = queryParams.user_id || queryParams.actor_id || queryParams.user;
  if (actor && actor !== 'all') {
    query.$or = [
      { actor_id: actor },
      { actor_username: new RegExp(`^${actor}$`, 'i') }
    ];
  }

  // 4. Module Filter
  if (queryParams.module && queryParams.module !== 'all') {
    query.module = queryParams.module;
  }

  // 5. Action Filter
  if (queryParams.action && queryParams.action !== 'all') {
    query.action = queryParams.action.toUpperCase();
  }

  // 6. Status Filter
  if (queryParams.status && queryParams.status !== 'all') {
    query.status = queryParams.status.toLowerCase();
  }

  // 7. Search Text Filter
  const search = (queryParams.search || '').trim();
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const searchConditions = [
      { description: regex },
      { entity_reference: regex },
      { actor_username: regex },
      { actor_name: regex },
      { unit_name: regex }
    ];

    if (query.$or) {
      query.$and = [
        { $or: query.$or },
        { $or: searchConditions }
      ];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  return { query, forbidden: false };
}

const auditLogController = {
  /**
   * GET /api/audit-logs
   * Scoped paginated query with summary stats
   */
  async getLogs(req, res) {
    try {
      const { query, forbidden } = await buildScopedQuery(req.user, req.query);

      if (forbidden) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to view audit logs for this unit.'
        });
      }

      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size || req.query.limit || '25', 10)));
      const skip = (page - 1) * pageSize;

      const [logs, total, failedCount, loginCount, changesCount] = await Promise.all([
        AuditLog.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        AuditLog.countDocuments(query),
        AuditLog.countDocuments({ ...query, status: 'failed' }),
        AuditLog.countDocuments({ ...query, action: { $in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] } }),
        AuditLog.countDocuments({
          ...query,
          action: { $in: ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'CONFIRM', 'SUBMIT', 'DISCARD'] }
        })
      ]);

      const pages = Math.ceil(total / pageSize) || 1;

      return res.json({
        success: true,
        data: logs,
        total,
        page,
        pages,
        page_size: pageSize,
        summary: {
          total,
          failed: failedCount,
          logins: loginCount,
          changes: changesCount
        }
      });
    } catch (error) {
      console.error('AuditLog getLogs error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs.'
      });
    }
  },

  /**
   * GET /api/audit-logs/:id
   * Detail view with before/after diff
   */
  async getLogById(req, res) {
    try {
      const { id } = req.params;
      const log = await AuditLog.findOne({ id }).lean();

      if (!log) {
        return res.status(404).json({
          success: false,
          message: 'Audit log entry not found.'
        });
      }

      // Check unit access
      const { isGlobal, allowedUnitIds } = await resolveAllowedUnits(req.user);
      if (!isGlobal) {
        if (!log.unit_id || !allowedUnitIds.includes(log.unit_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: You are not authorized to view this log entry.'
          });
        }
      }

      return res.json({
        success: true,
        data: log
      });
    } catch (error) {
      console.error('AuditLog getLogById error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log details.'
      });
    }
  },

  /**
   * GET /api/audit-logs/filters
   * Selectable options within caller's allowed scope
   */
  async getFilters(req, res) {
    try {
      const { isGlobal, allowedUnitIds } = await resolveAllowedUnits(req.user);

      const baseQuery = {};
      if (!isGlobal) {
        baseQuery.unit_id = { $in: allowedUnitIds };
      }

      const [modules, actions, rawActors, allUnits] = await Promise.all([
        AuditLog.distinct('module', baseQuery),
        AuditLog.distinct('action', baseQuery),
        AuditLog.find(baseQuery, { actor_id: 1, actor_name: 1, actor_username: 1, actor_role: 1 }).limit(1000).lean(),
        isGlobal
          ? Unit.find({}, { id: 1, unit_name: 1, unit_code: 1 }).lean()
          : Unit.find({ id: { $in: allowedUnitIds } }, { id: 1, unit_name: 1, unit_code: 1 }).lean()
      ]);

      // Deduplicate actors
      const userMap = new Map();
      for (const a of rawActors) {
        if (a.actor_id && !userMap.has(a.actor_id)) {
          userMap.set(a.actor_id, {
            id: a.actor_id,
            name: a.actor_name,
            username: a.actor_username,
            role: a.actor_role
          });
        }
      }

      return res.json({
        success: true,
        data: {
          modules: (modules || []).filter(Boolean).sort(),
          actions: (actions || []).filter(Boolean).sort(),
          users: Array.from(userMap.values()),
          units: (allUnits || []).map(u => ({ id: u.id, name: u.unit_name, code: u.unit_code }))
        }
      });
    } catch (error) {
      console.error('AuditLog getFilters error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve filter options.'
      });
    }
  },

  /**
   * GET /api/audit-logs/export
   * CSV export formatted DD/MM/YYYY with UTF-8 BOM
   */
  async exportCSV(req, res) {
    try {
      const { query, forbidden } = await buildScopedQuery(req.user, req.query);

      if (forbidden) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are not authorized to export audit logs for this unit.'
        });
      }

      const MAX_EXPORT = 5000;
      const logs = await AuditLog.find(query)
        .sort({ created_at: -1 })
        .limit(MAX_EXPORT)
        .lean();

      // Log this export event itself
      await auditLogger.log({
        action: 'EXPORT',
        module: 'Settings',
        entity_type: 'AuditLog',
        description: `${req.user.full_name} (${req.user.role}) exported ${logs.length} audit log entries to CSV`,
        req
      });

      // Format as CSV
      const headers = [
        'Date & Time (UTC)',
        'Local Date & Time',
        'User Full Name',
        'Username',
        'User Role',
        'Unit Name',
        'Module',
        'Action',
        'Entity Type',
        'Entity Reference',
        'Description',
        'Status',
        'Error Message',
        'IP Address',
        'IP Source',
        'Request ID'
      ];

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        const isPlainNumber = /^[+\-]?\d+(\.\d+)?$/.test(str.trim());
        if (!isPlainNumber && /^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        str = str.replace(/"/g, '""');
        if (/[",\n\r]/.test(str)) {
          return `"${str}"`;
        }
        return str;
      };

      const formatTimestamp = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        const hours = String(dt.getHours()).padStart(2, '0');
        const mins = String(dt.getMinutes()).padStart(2, '0');
        const secs = String(dt.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
      };

      const rows = logs.map(l => [
        escapeCSV(l.created_at ? new Date(l.created_at).toISOString() : ''),
        escapeCSV(formatTimestamp(l.created_at)),
        escapeCSV(l.actor_name),
        escapeCSV(l.actor_username),
        escapeCSV(l.actor_role),
        escapeCSV(l.unit_name || 'System / All'),
        escapeCSV(l.module),
        escapeCSV(l.action),
        escapeCSV(l.entity_type),
        escapeCSV(l.entity_reference),
        escapeCSV(l.description),
        escapeCSV(l.status),
        escapeCSV(l.error_message || ''),
        escapeCSV(l.ip_address),
        escapeCSV(l.ip_source || (l.ip_address === '::1' || l.ip_address === '127.0.0.1' ? 'local-resolved' : 'direct')),
        escapeCSV(l.request_id)
      ].join(','));

      const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');

      const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('AuditLog export error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export audit logs.'
      });
    }
  },

  /**
   * POST /api/audit-logs/log-action
   * Explicit endpoint for logging client-side user events (e.g. Print Report, Export CSV)
   */
  async logAction(req, res) {
    try {
      const {
        action,
        module: mod,
        description,
        entity_type,
        entity_id,
        entity_reference,
        status = 'success',
        changes,
        unit_id,
        unit_name
      } = req.body;

      if (!action || !mod || !description) {
        return res.status(400).json({
          success: false,
          message: 'action, module, and description are required.'
        });
      }

      await auditLogger.log({
        action,
        module: mod,
        description,
        status,
        entity_type,
        entity_id,
        entity_reference,
        changes,
        unit_id: unit_id || req.user?.unit_id,
        unit_name,
        req,
        res
      });

      return res.json({
        success: true,
        message: 'Action logged successfully.'
      });
    } catch (error) {
      console.error('logAction error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to log action.'
      });
    }
  }
};

module.exports = auditLogController;

