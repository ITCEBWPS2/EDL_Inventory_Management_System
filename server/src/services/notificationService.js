const { v4: uuidv4 } = require('uuid');
const { Notification, Profile, UserUnit } = require('../models');
const auditLogger = require('./auditLogger');

/**
 * Creates notifications for all eligible recipients when a disposal request is submitted.
 * Eligible recipients:
 * 1. Every active Super Admin
 * 2. Every active Local Admin whose allowed units include the request's unit
 * 3. Every active disposal_only employee whose unit assignments include the request's unit OR who has no unit assignments
 *
 * Rules:
 * - Do not notify the requester
 * - Avoid duplicates (one per user per request)
 * - Title: "Disposal request <request_no>"
 * - Message: "New disposal request received from <unit name>"
 * - Link: "/disposal-requests/<request_id>"
 * - Audit entry listing number of recipients
 *
 * @param {Object} request - DisposalRequest document
 * @param {Object} actor - The user who submitted the request
 * @param {Object} [httpReq] - Express req for audit logger
 * @param {Object} [httpRes] - Express res for audit logger
 */
async function createDisposalSubmittedNotifications(request, actor, httpReq = null, httpRes = null) {
  if (!request || !request.unit_id) return [];

  const actorId = actor ? (actor.id || actor._id) : null;
  const unitName = request.unit_name || 'Unit';

  // Find all active candidate profiles: super_admin, local_admin, and disposal_only employee
  const candidates = await Profile.find({
    account_status: 'active',
    $or: [
      { role: 'super_admin' },
      { role: 'local_admin' },
      { role: 'employee', permission_level: 'disposal_only' }
    ]
  }).lean();

  // Load all user_units for candidate IDs to check unit scoping
  const candidateIds = candidates.map(c => c.id);
  const userUnits = await UserUnit.find({ user_id: { $in: candidateIds } }).lean();

  const unitsByUserId = {};
  userUnits.forEach(uu => {
    if (!unitsByUserId[uu.user_id]) unitsByUserId[uu.user_id] = [];
    unitsByUserId[uu.user_id].push(uu.unit_id);
  });

  const recipients = [];
  const seenUserIds = new Set();

  for (const cand of candidates) {
    // Exclude requester
    if (cand.id === actorId) continue;
    if (seenUserIds.has(cand.id)) continue;

    const assigned = unitsByUserId[cand.id] || [];
    if (cand.unit_id && !assigned.includes(cand.unit_id)) {
      assigned.push(cand.unit_id);
    }

    if (cand.role === 'super_admin') {
      recipients.push(cand);
      seenUserIds.add(cand.id);
    } else if (cand.role === 'local_admin') {
      if (assigned.includes(request.unit_id)) {
        recipients.push(cand);
        seenUserIds.add(cand.id);
      }
    } else if (cand.role === 'employee' && cand.permission_level === 'disposal_only') {
      // Unassigned (no unit assigned) -> receives from all units
      if (assigned.length === 0 || assigned.includes(request.unit_id)) {
        recipients.push(cand);
        seenUserIds.add(cand.id);
      }
    }
  }

  // Create notifications in batch or individually
  const createdNotifications = [];
  for (const recipient of recipients) {
    // Check if notification already exists for this user and request
    const existing = await Notification.findOne({
      recipient_user_id: recipient.id,
      request_id: request.id
    }).lean();

    if (!existing) {
      const notif = new Notification({
        id: uuidv4(),
        recipient_user_id: recipient.id,
        type: 'disposal_request_submitted',
        title: `Disposal request ${request.request_no}`,
        message: `New disposal request received from ${unitName}`,
        link: `/disposal/${request.id}`,
        request_id: request.id,
        request_no: request.request_no,
        unit_id: request.unit_id,
        unit_name: unitName,
        read_at: null
      });
      await notif.save();
      createdNotifications.push(notif);
    }
  }

  // Write audit log entry listing number of recipients
  try {
    await auditLogger.log({
      actor_id: actorId,
      actor_name: actor?.full_name || actor?.username || 'Staff',
      actor_username: actor?.username,
      actor_role: actor?.role,
      unit_id: request.unit_id,
      unit_name: unitName,
      module: 'Disposal',
      action: 'DISPOSAL_REQUEST_NOTIFICATIONS_SENT',
      entity_type: 'DisposalRequest',
      entity_id: request.id,
      entity_reference: request.request_no,
      description: `Disposal request ${request.request_no} submitted: generated notifications for ${createdNotifications.length} recipient(s).`,
      status: 'success',
      req: httpReq,
      res: httpRes
    });
  } catch (auditErr) {
    console.warn('Audit logging failed for notifications sent:', auditErr.message);
  }

  return createdNotifications;
}

module.exports = {
  createDisposalSubmittedNotifications
};
