const { v4: uuidv4 } = require('uuid');
const { AuditLog, Unit } = require('../models');
const { getClientIpDetails } = require('../utils/clientIp');

// Regex for sensitive keys that must never be recorded in audit logs
const SENSITIVE_KEY_REGEX = /password|token|authorization|secret|pwd|hash|jwt/i;

// Maximum number of items in arrays (e.g. serial numbers) to store before truncating
const MAX_ARRAY_LENGTH = 20;

/**
 * Recursively redacts sensitive values and truncates oversized arrays/strings
 */
function sanitizeValue(key, val, depth = 0) {
  if (depth > 6) return '[MAX_DEPTH]';
  if (val === null || val === undefined) return val;

  // Redact sensitive keys
  if (typeof key === 'string' && SENSITIVE_KEY_REGEX.test(key)) {
    return '[REDACTED]';
  }

  // Handle arrays
  if (Array.isArray(val)) {
    const sanitized = val.slice(0, MAX_ARRAY_LENGTH).map((item, idx) => sanitizeValue(idx, item, depth + 1));
    if (val.length > MAX_ARRAY_LENGTH) {
      sanitized.push(`+${val.length - MAX_ARRAY_LENGTH} more items`);
    }
    return sanitized;
  }

  // Handle objects
  if (typeof val === 'object' && !(val instanceof Date)) {
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '_id' || k === '__v') continue;
      sanitizedObj[k] = sanitizeValue(k, v, depth + 1);
    }
    return sanitizedObj;
  }

  // Truncate overly long strings (e.g. base64 images or long notes)
  if (typeof val === 'string' && val.length > 2000) {
    return val.slice(0, 2000) + '... [TRUNCATED]';
  }

  return val;
}

/**
 * Redact sensitive fields from any object or array
 */
function redact(data) {
  if (!data) return null;
  return sanitizeValue('root', data);
}

/**
 * Creates a clean snapshot of an entity for CREATE or DELETE events
 */
function snapshot(obj) {
  if (!obj) return null;
  const raw = typeof obj.toObject === 'function' ? obj.toObject() : { ...obj };
  delete raw._id;
  delete raw.__v;
  delete raw.password_hash;
  delete raw.passwordHash;
  return redact(raw);
}

/**
 * Computes a field-level diff between before and after objects
 * Returns { before: { ...changedFields }, after: { ...changedFields } }
 */
function diff(before = {}, after = {}) {
  const b = typeof before?.toObject === 'function' ? before.toObject() : (before || {});
  const a = typeof after?.toObject === 'function' ? after.toObject() : (after || {});

  const beforeDiff = {};
  const afterDiff = {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const ignoredKeys = new Set(['_id', '__v', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'password_hash', 'passwordHash']);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;

    const bVal = b[key];
    const aVal = a[key];

    // Check equality (deep for objects/arrays)
    const bStr = JSON.stringify(bVal);
    const aStr = JSON.stringify(aVal);

    if (bStr !== aStr) {
      beforeDiff[key] = sanitizeValue(key, bVal);
      afterDiff[key] = sanitizeValue(key, aVal);
    }
  }

  if (Object.keys(beforeDiff).length === 0 && Object.keys(afterDiff).length === 0) {
    return null;
  }

  return {
    before: beforeDiff,
    after: afterDiff
  };
}

/**
 * Main Audit Logger Service
 */
const auditLogger = {
  redact,
  snapshot,
  diff,

  /**
   * Safe, non-blocking audit logging method.
   * Catches all exceptions so the business transaction is never affected.
   */
  async log(entry = {}) {
    try {
      const {
        action,
        module: mod,
        description,
        status = 'success',
        error_message = null,
        entity_type = '',
        entity_id = null,
        entity_reference = '',
        changes = null,
        req,
        res
      } = entry;

      if (!action || !mod || !description) {
        console.warn('AuditLogger: missing required fields (action, module, description)', { action, mod });
        return null;
      }

      // Mark response as explicitly audited so generic middleware does not create duplicate entries
      if (res && res.locals) {
        res.locals.auditLogged = true;
      }

      // Extract client/request metadata
      let ipAddress = entry.ip_address;
      let ipRaw = entry.ip_raw;
      let ipSource = entry.ip_source;

      if (req && (!ipAddress || !ipSource)) {
        const ipDetails = getClientIpDetails(req);
        ipAddress = ipAddress || ipDetails.ip;
        ipRaw = ipRaw || ipDetails.rawIp;
        ipSource = ipSource || ipDetails.source;
      } else if (ipAddress) {
        ipRaw = ipRaw || ipAddress;
        ipSource = ipSource || 'direct';
      } else {
        ipAddress = 'unknown';
        ipRaw = 'unknown';
        ipSource = 'unknown';
      }

      const userAgent = entry.user_agent || (req ? req.headers?.['user-agent'] || '' : '');
      const requestId = entry.request_id || (req ? (req.id || req.headers?.['x-request-id'] || uuidv4()) : uuidv4());

      // Extract actor details
      const actorId = entry.actor_id || req?.user?.id || null;
      const actorName = entry.actor_name || req?.user?.full_name || (actorId ? 'User' : 'System');
      const actorUsername = entry.actor_username || req?.user?.username || '';
      const actorRole = entry.actor_role || req?.user?.role || '';

      // Extract unit details
      let unitId = entry.unit_id || req?.body?.unit_id || req?.query?.unit_id || req?.user?.unit_id || null;
      let unitName = entry.unit_name || '';

      if (unitId && !unitName) {
        try {
          const unitDoc = await Unit.findOne({ id: unitId }).lean();
          if (unitDoc) {
            unitName = unitDoc.unit_name || unitDoc.unit_code || '';
          }
        } catch {
          // ignore lookup error
        }
      }

      const logRecord = new AuditLog({
        id: uuidv4(),
        created_at: new Date(),
        unit_id: unitId,
        unit_name: unitName,
        actor_id: actorId,
        actor_name: actorName,
        actor_username: actorUsername,
        actor_role: actorRole,
        action: String(action).toUpperCase().trim(),
        module: String(mod).trim(),
        entity_type: String(entity_type || ''),
        entity_id: entity_id ? String(entity_id) : null,
        entity_reference: String(entity_reference || ''),
        description: String(description).trim(),
        status: status === 'failed' ? 'failed' : (status === 'denied' ? 'denied' : 'success'),
        error_message: error_message ? String(error_message) : null,
        changes: changes ? redact(changes) : null,
        ip_address: String(ipAddress || 'unknown'),
        ip_raw: String(ipRaw || ''),
        ip_source: String(ipSource || 'direct'),
        user_agent: String(userAgent || ''),
        request_id: String(requestId || '')
      });

      await logRecord.save();
      return logRecord;
    } catch (err) {
      // Never throw from auditLogger: log to console so business flow proceeds normally
      console.error('⚠️ AuditLogger failed to record log entry:', err.message);
      return null;
    }
  }
};

module.exports = auditLogger;

