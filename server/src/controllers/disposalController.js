const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { DisposalRequest, InventoryItem, IssuedDestroyedItem, Unit, UserUnit, Notification } = require('../models');
const storageService = require('../services/storageService');
const auditLogger = require('../services/auditLogger');
const env = require('../config/env');
const {
  DISPOSAL_OVERVIEW_PUBLIC_TO_ALL_USERS,
  NOTIFY_REQUESTER_ON_PROGRESS,
  canCreateDisposalRequest,
  canEditDraft,
  canDeleteDraft,
  canSubmitRequest,
  canHandleDisposalSteps,
  canViewDisposalDetails,
  canViewDisposalOverview,
  canPrintDisposal,
  getDisposalUnitScope
} = require('../utils/disposalPermissions');
const { createDisposalSubmittedNotifications } = require('../services/notificationService');

const DISPOSAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/disposal');
if (!fs.existsSync(DISPOSAL_UPLOADS_DIR)) {
  fs.mkdirSync(DISPOSAL_UPLOADS_DIR, { recursive: true });
}

/**
 * Generate sequential request number: DR-YYYY-XXXX
 */
async function generateNextRequestNo(year = new Date().getFullYear()) {
  const prefix = `DR-${year}-`;
  const regex = new RegExp(`^DR-${year}-(\\d+)`);
  const latest = await DisposalRequest.find({ request_no: { $regex: regex } })
    .sort({ request_no: -1 })
    .limit(1)
    .lean();

  let nextSeq = 1;
  if (latest && latest.length > 0) {
    const match = latest[0].request_no.match(regex);
    if (match && match[1]) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

const disposalController = {
  /**
   * GET /api/disposal-requests
   * List disposal requests scoped by user permissions
   */
  async listRequests(req, res) {
    try {
      const { unit_id, status, search } = req.query;
      const allowedUnits = getDisposalUnitScope(req.user);

      const filter = {};

      if (allowedUnits !== null) {
        if (unit_id && unit_id !== 'all') {
          if (!allowedUnits.includes(unit_id)) {
            return res.status(403).json({ success: false, message: 'Access denied for the requested unit.' });
          }
          filter.unit_id = unit_id;
        } else {
          filter.unit_id = { $in: allowedUnits };
        }
      } else if (unit_id && unit_id !== 'all') {
        filter.unit_id = unit_id;
      }

      if (status && status !== 'all') {
        filter.status = status.toLowerCase().replace(/\s+/g, '_');
      }

      if (search && search.trim()) {
        const q = search.trim();
        filter.$or = [
          { request_no: { $regex: q, $options: 'i' } },
          { title: { $regex: q, $options: 'i' } },
          { 'items.item_name': { $regex: q, $options: 'i' } },
          { 'items.serial_number': { $regex: q, $options: 'i' } },
          { 'items.serial_numbers': { $regex: q, $options: 'i' } }
        ];
      }

      const requests = await DisposalRequest.find(filter)
        .sort({ created_at: -1 })
        .lean();

      return res.json({ success: true, data: requests });
    } catch (err) {
      console.error('Failed to list disposal requests:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch disposal requests.' });
    }
  },

  /**
   * GET /api/disposal-requests/:id/overview
   * Returns safe overview fields readable by ANY authenticated user
   */
  async getRequestOverview(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id }).lean();
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      let stepperState = 1;
      if (request.status === 'draft' || request.status === 'submitted') {
        stepperState = 1;
      } else if (request.status === 'board_appointed') {
        stepperState = 2;
      } else if (request.status === 'approved' || request.status === 'rejected') {
        stepperState = 3;
      } else if (request.status === 'in_disposal') {
        stepperState = 4;
      } else if (request.status === 'completed') {
        stepperState = 5;
      }

      const safeData = {
        id: request.id,
        request_no: request.request_no,
        title: request.title,
        description: request.description || '',
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        status: request.status,
        stepper_state: stepperState,
        initiated_date: request.submitted_at || request.created_at,
        created_at: request.created_at,
        created_by_name: request.created_by_name || 'Staff',
        items_count: Array.isArray(request.items) ? request.items.length : 0,
        timeline_events_count: Array.isArray(request.timeline) ? request.timeline.length : 0,
        board: request.board ? {
          appointed_by_name: request.board.appointed_by_name,
          appointment_date: request.board.appointment_date,
          members_count: Array.isArray(request.board.members) ? request.board.members.length : 0
        } : null
      };

      return res.json({ success: true, data: safeData });
    } catch (err) {
      console.error('Failed to get disposal request overview:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve overview.' });
    }
  },

  /**
   * GET /api/disposal-requests/:id
   * Get single disposal request full detail (guarded by canViewDisposalDetails)
   */
  async getRequestById(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id }).lean();
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (!canViewDisposalDetails(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'VIEW_DETAILS_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to view details of disposal request ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });

        return res.status(403).json({
          success: false,
          message: 'You do not have access to these details.'
        });
      }

      // Automatically mark notifications matching this request as read
      try {
        await Notification.updateMany(
          {
            recipient_user_id: req.user.id || req.user._id,
            request_id: request.id,
            read_at: null
          },
          {
            $set: { read_at: new Date() }
          }
        );
      } catch (notifErr) {
        // Non-blocking
      }

      return res.json({ success: true, data: request });
    } catch (err) {
      console.error('Failed to get disposal request:', err);
      return res.status(500).json({ success: false, message: 'Failed to retrieve disposal request.' });
    }
  },

  /**
   * POST /api/disposal-requests
   * Create new draft disposal request
   */
  async createDraft(req, res) {
    try {
      const { unit_id, title, description, items } = req.body;

      const userAssignedUnitId = req.user.unit_id || (Array.isArray(req.user.unitIds) ? req.user.unitIds[0] : null);

      if (!canCreateDisposalRequest(req.user, userAssignedUnitId)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: userAssignedUnitId,
          module: 'Disposal',
          action: 'CREATE_DENIED',
          entity_type: 'DisposalRequest',
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to create disposal request: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Unit Heads and read-write staff can create disposal requests for their assigned unit.'
        });
      }

      // The request is always created for the user's active/assigned unit; the unit cannot be chosen freely
      if (unit_id && userAssignedUnitId && unit_id !== userAssignedUnitId) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: userAssignedUnitId,
          module: 'Disposal',
          action: 'CREATE_DENIED',
          entity_type: 'DisposalRequest',
          description: `User ${req.user.full_name} (${req.user.role}) denied creating disposal request for foreign unit ${unit_id}`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'You can only create disposal requests for your own assigned unit.'
        });
      }

      const effectiveUnitId = userAssignedUnitId || unit_id;
      if (!effectiveUnitId) {
        return res.status(400).json({ success: false, message: 'You must have an assigned unit to create a disposal request.' });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one item is required for a disposal request.' });
      }

      const unit = await Unit.findOne({ id: effectiveUnitId }).lean();
      const unitName = unit ? unit.unit_name || unit.name || unit.unit_code : '';

      const requestNo = await generateNextRequestNo();

      const formattedItems = items.map(item => {
        const serials = Array.isArray(item.serial_numbers)
          ? item.serial_numbers.filter(Boolean).map(s => String(s).trim())
          : (item.serial_number ? [String(item.serial_number).trim()] : []);

        return {
          id: item.id || uuidv4(),
          inventory_item_id: item.inventory_item_id || null,
          item_name: String(item.item_name || '').trim(),
          item_code: String(item.item_code || '').trim(),
          category: String(item.category || '').trim(),
          quantity: Math.max(1, Number(item.quantity) || 1),
          serial_numbers: serials,
          serial_number: serials[0] || '',
          condition_notes: String(item.condition_notes || '').trim(),
          committee_decision_item: null,
          committee_remarks: '',
          serial_status: 'pending_disposal',
          final_disposition: null,
          disposal_ref: null,
          disposed_qty: 0,
          disposed_at: null
        };
      });

      const newRequest = new DisposalRequest({
        id: uuidv4(),
        request_no: requestNo,
        unit_id: effectiveUnitId,
        unit_name: unitName,
        title: title.trim(),
        description: description ? description.trim() : '',
        status: 'draft',
        items: formattedItems,
        board: {
          members: [],
          appointed_by_name: 'Eng.E.K. Indranatha',
          appointment_letter_no: '',
          appointment_date: null
        },
        committee_decision: null,
        disposal_records: [],
        timeline: [
          {
            id: uuidv4(),
            status: 'draft',
            action: 'Draft disposal request created',
            actor_name: req.user.full_name || req.user.username || 'Staff',
            actor_id: req.user.id || req.user._id,
            timestamp: new Date().toISOString(),
            notes: `Created with ${formattedItems.length} items.`
          }
        ],
        created_by_id: req.user.id || req.user._id,
        created_by_name: req.user.full_name || req.user.username || 'Staff'
      });

      await newRequest.save();

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: effectiveUnitId,
        unit_name: unitName,
        module: 'Disposal',
        action: 'DISPOSAL_REQUEST_CREATED',
        entity_type: 'DisposalRequest',
        entity_id: newRequest.id,
        entity_reference: newRequest.request_no,
        description: `Created draft disposal request ${newRequest.request_no} with ${formattedItems.length} item(s).`,
        status: 'success'
      });

      return res.status(201).json({ success: true, data: newRequest });
    } catch (err) {
      console.error('Failed to create disposal request:', err);
      return res.status(500).json({ success: false, message: 'Failed to create disposal request.' });
    }
  },

  /**
   * PUT /api/disposal-requests/:id
   * Update draft disposal request
   */
  async updateDraft(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (request.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot edit request in status "${request.status}". Only Draft requests can be modified.`
        });
      }

      if (!canEditDraft(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'UPDATE_DRAFT_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to edit draft request ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Unit Heads and read-write staff of the assigned unit can edit this draft request.'
        });
      }

      const { title, description, items } = req.body;
      if (title) request.title = title.trim();
      if (description !== undefined) request.description = description.trim();

      if (Array.isArray(items)) {
        if (items.length === 0) {
          return res.status(400).json({ success: false, message: 'Disposal request must contain at least one item.' });
        }
        request.items = items.map(item => {
          const serials = Array.isArray(item.serial_numbers)
            ? item.serial_numbers.filter(Boolean).map(s => String(s).trim())
            : (item.serial_number ? [String(item.serial_number).trim()] : []);

          return {
            id: item.id || uuidv4(),
            inventory_item_id: item.inventory_item_id || null,
            item_name: String(item.item_name || '').trim(),
            item_code: String(item.item_code || '').trim(),
            category: String(item.category || '').trim(),
            quantity: Math.max(1, Number(item.quantity) || 1),
            serial_numbers: serials,
            serial_number: serials[0] || '',
            condition_notes: String(item.condition_notes || '').trim(),
            committee_decision_item: null,
            committee_remarks: '',
            serial_status: 'pending_disposal',
            final_disposition: null,
            disposal_ref: null,
            disposed_qty: 0,
            disposed_at: null
          };
        });
      }

      request.timeline.push({
        id: uuidv4(),
        status: 'draft',
        action: 'Draft disposal request updated',
        actor_name: req.user.full_name || req.user.username || 'Staff',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: 'Updated title, description, or items.'
      });

      await request.save();
      return res.json({ success: true, data: request });
    } catch (err) {
      console.error('Failed to update draft disposal request:', err);
      return res.status(500).json({ success: false, message: 'Failed to update draft disposal request.' });
    }
  },

  /**
   * DELETE /api/disposal-requests/:id
   * Rule: A Draft can be deleted; later steps cannot.
   */
  async deleteDraft(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (request.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot delete request in status "${request.status}". Only Draft requests can be deleted.`
        });
      }

      if (!canDeleteDraft(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'DELETE_DRAFT_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to delete draft request ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Unit Heads and read-write staff of the assigned unit can delete this draft request.'
        });
      }

      await DisposalRequest.deleteOne({ id: req.params.id });

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'DISPOSAL_REQUEST_DELETED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Deleted draft disposal request ${request.request_no}.`,
        status: 'success'
      });

      return res.json({ success: true, message: 'Draft disposal request deleted.' });
    } catch (err) {
      console.error('Failed to delete draft disposal request:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete disposal request.' });
    }
  },

  /**
   * POST /api/disposal-requests/:id/submit
   * Transition: Draft -> Submitted
   */
  async submitRequest(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (request.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot submit request in status "${request.status}". Only Draft requests can be submitted.`
        });
      }

      if (!canSubmitRequest(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'SUBMIT_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to submit disposal request ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Unit Heads and read-write staff of the assigned unit can submit this disposal request.'
        });
      }

      if (!request.items || request.items.length === 0) {
        return res.status(400).json({ success: false, message: 'Disposal request must contain at least one item.' });
      }

      request.status = 'submitted';
      request.submitted_at = new Date().toISOString();

      request.timeline.push({
        id: uuidv4(),
        status: 'submitted',
        action: 'Disposal request submitted',
        actor_name: req.user.full_name || req.user.username || 'Staff',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: `Submitted with ${request.items.length} items for Board of Survey appointment.`
      });

      await request.save();

      // Create notifications for eligible recipients (Super Admin, Local Admin in scope, disposal_only in scope)
      await createDisposalSubmittedNotifications(request, req.user, req, res);

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'DISPOSAL_REQUEST_SUBMITTED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Submitted disposal request ${request.request_no} for Board Appointment.`,
        status: 'success'
      });

      return res.json({ success: true, data: request, message: 'Disposal request submitted.' });
    } catch (err) {
      console.error('Failed to submit disposal request:', err);
      return res.status(500).json({ success: false, message: 'Failed to submit disposal request.' });
    }
  },

  /**
   * POST /api/disposal-requests/:id/board-appointment
   * Transition: Submitted -> Board Appointed
   * Rule: members (3 to 6 members), appointment_letter_no, appointment_date, appointed_by_name
   */
  async recordBoardAppointment(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (!canHandleDisposalSteps(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'BOARD_APPOINTMENT_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to record board appointment for ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin, Local Admin, or authorized Disposal Officers can record board appointments.'
        });
      }

      if (request.status !== 'submitted' && request.status !== 'board_appointed') {
        return res.status(400).json({
          success: false,
          message: `Cannot appoint board for request in status "${request.status}". Request must be in "Submitted" or "Board Appointed" status.`
        });
      }

      const { appointment_letter_no, appointment_date, appointed_by_name, members } = req.body;

      if (!appointment_date || !appointment_date.trim()) {
        return res.status(400).json({ success: false, message: 'Appointment date is required.' });
      }
      if (!Array.isArray(members) || members.length < 3 || members.length > 6) {
        return res.status(400).json({
          success: false,
          message: `Board of Survey must consist of 3 to 6 members. Provided: ${Array.isArray(members) ? members.length : 0}.`
        });
      }

      const validMembers = [];
      for (const m of members) {
        const name = (m.name || m || '').trim();
        if (!name) {
          return res.status(400).json({ success: false, message: 'Every board member must have a valid name.' });
        }
        validMembers.push({
          name,
          designation: (m.designation || '').trim()
        });
      }

      const appointmentLetterNo = appointment_letter_no ? appointment_letter_no.trim() : '';
      const isInitialAppointment = request.status === 'submitted';

      request.board = {
        appointment_letter_no: appointmentLetterNo,
        appointment_date: appointment_date.trim(),
        appointed_by_name: appointed_by_name && appointed_by_name.trim() ? appointed_by_name.trim() : 'Eng.E.K. Indranatha',
        members: validMembers
      };

      request.status = 'board_appointed';

      request.timeline.push({
        id: uuidv4(),
        status: 'board_appointed',
        action: isInitialAppointment
          ? `Board of Survey appointed - Committee for: ${request.unit_name || request.unit_id}`
          : `Board of Survey details updated - Committee for: ${request.unit_name || request.unit_id}`,
        actor_name: req.user.full_name || req.user.username || 'Staff',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: `${appointmentLetterNo ? `Letter Ref: ${appointmentLetterNo}, ` : ''}Members: ${validMembers.map(m => m.name).join(', ')} (Appointed by: ${request.board.appointed_by_name})`
      });

      await request.save();

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'BOARD_APPOINTED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Board appointed for disposal request ${request.request_no} (${validMembers.length} members${appointmentLetterNo ? `, Letter: ${appointmentLetterNo}` : ''}).`,
        status: 'success'
      });

      return res.json({ success: true, data: request, message: 'Board appointment recorded successfully.' });
    } catch (err) {
      console.error('Failed to record board appointment:', err);
      return res.status(500).json({ success: false, message: 'Failed to record board appointment.' });
    }
  },

  /**
   * POST /api/disposal-requests/:id/committee-decision
   * Transition: Board Appointed -> Approved (or Rejected when all items are Retain/Repair/Reject)
   *
   * Form fields: report_ref, decision_date, inspection_date, members_present, remarks, attachment
   * Per-item decisions: Approve for Destruction | Approve for Tender | Retain | Repair | Reject
   * Item status rules:
   *   - Approve for Destruction or Tender -> serials become approved_for_disposal
   *   - Retain, Repair, Reject -> serials return to active immediately (with timeline note)
   */
  async recordCommitteeDecision(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (!canHandleDisposalSteps(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'COMMITTEE_DECISION_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to record committee decision for ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin, Local Admin, or authorized Disposal Officers can record committee decisions.'
        });
      }

      if (request.status !== 'board_appointed') {
        return res.status(400).json({
          success: false,
          message: `Cannot record committee decision for request in status "${request.status}". Request must be in "Board Appointed" status.`
        });
      }

      let bodyData = req.body;
      let rawItems = bodyData.items;
      if (typeof rawItems === 'string') {
        try {
          rawItems = JSON.parse(rawItems);
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Invalid items format in request.' });
        }
      }

      let rawMembersPresent = bodyData.members_present;
      if (typeof rawMembersPresent === 'string') {
        try {
          rawMembersPresent = JSON.parse(rawMembersPresent);
        } catch (e) {
          rawMembersPresent = [rawMembersPresent];
        }
      }

      const reportRef = (bodyData.report_ref || '').trim();
      const decisionDate = (bodyData.decision_date || '').trim();
      const inspectionDate = (bodyData.inspection_date || '').trim() || null;
      const remarks = (bodyData.remarks || '').trim();

      if (!reportRef) {
        return res.status(400).json({ success: false, message: 'Committee report reference is required.' });
      }
      if (!decisionDate) {
        return res.status(400).json({ success: false, message: 'Decision date is required.' });
      }

      const membersPresent = Array.isArray(rawMembersPresent)
        ? rawMembersPresent.filter(Boolean).map(m => String(m).trim())
        : [];

      if (membersPresent.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one committee member must be present.' });
      }

      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Items array with committee decisions is required.' });
      }

      const decisionMap = new Map();
      rawItems.forEach(item => {
        const id = item.id || item.item_id;
        if (id) {
          decisionMap.set(String(id), {
            decision: item.committee_decision_item,
            remarks: (item.committee_remarks || '').trim()
          });
        }
      });

      const VALID_DECISIONS = ['Approve for Destroy', 'Approve for Destruction', 'Approve for Tender', 'Retain', 'Repair', 'Reject'];

      // Validate that every single item in the request has a decision
      for (const item of request.items) {
        const dec = decisionMap.get(String(item.id));
        if (!dec || !dec.decision || !VALID_DECISIONS.includes(dec.decision)) {
          return res.status(400).json({
            success: false,
            message: `Every item must have a valid committee decision before saving. Missing or invalid decision for: "${item.item_name}".`
          });
        }
      }

      let approvedCount = 0;
      let retainedCount = 0;
      let repairedCount = 0;
      let rejectedCount = 0;
      const serialsReturnedToActive = [];

      request.items.forEach(item => {
        const dec = decisionMap.get(String(item.id));
        item.committee_decision_item = dec.decision;
        item.committee_remarks = dec.remarks;

        if (dec.decision === 'Approve for Destroy' || dec.decision === 'Approve for Destruction' || dec.decision === 'Approve for Tender') {
          item.serial_status = 'approved_for_disposal';
          approvedCount++;
        } else {
          // Retain, Repair, Reject -> serials return to active immediately
          item.serial_status = 'active';
          if (item.serial_numbers && item.serial_numbers.length > 0) {
            serialsReturnedToActive.push(...item.serial_numbers);
          } else if (item.serial_number) {
            serialsReturnedToActive.push(item.serial_number);
          }

          if (dec.decision === 'Retain') retainedCount++;
          else if (dec.decision === 'Repair') repairedCount++;
          else if (dec.decision === 'Reject') rejectedCount++;
        }
      });

      // Handle optional report scan attachment (max 300 KB)
      let attachmentObj = null;
      if (req.file) {
        if (req.file.size > 300 * 1024) {
          return res.status(400).json({
            success: false,
            message: `Attachment file is too large (${Math.round(req.file.size / 1024)} KB). Maximum allowed size is 300 KB.`
          });
        }
        attachmentObj = await storageService.uploadDisposalAttachment(req.file, request.request_no);
      }

      request.committee_decision = {
        report_ref: reportRef,
        decision_date: decisionDate,
        inspection_date: inspectionDate,
        members_present: membersPresent,
        remarks,
        attachment: attachmentObj || (request.committee_decision?.attachment || null)
      };

      // State transition:
      // - Approved when at least one item is approved for disposal
      // - Rejected when all items are Retain / Repair / Reject
      if (approvedCount > 0) {
        request.status = 'approved';
      } else {
        request.status = 'rejected';
      }

      let returnNote = '';
      if (serialsReturnedToActive.length > 0) {
        returnNote = ` Serials returned to active: ${serialsReturnedToActive.slice(0, 5).join(', ')}${serialsReturnedToActive.length > 5 ? ` (+${serialsReturnedToActive.length - 5} more)` : ''}.`;
      }

      request.timeline.push({
        id: uuidv4(),
        status: request.status,
        action: 'Committee decision recorded',
        actor_name: req.user.full_name || req.user.username || 'Staff',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: `Report Ref: ${reportRef}. Approved: ${approvedCount}, Retained: ${retainedCount}, Repaired: ${repairedCount}, Rejected: ${rejectedCount}.${returnNote}`
      });

      await request.save();

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'COMMITTEE_DECISION_RECORDED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Committee decision recorded for ${request.request_no} (Report Ref: ${reportRef}, Approved: ${approvedCount}, Retained: ${retainedCount}, Repaired: ${repairedCount}, Rejected: ${rejectedCount}). Status: ${request.status}.`,
        status: 'success'
      });

      return res.json({
        success: true,
        data: request,
        message: `Committee decision recorded. Request status is now ${request.status === 'approved' ? 'Approved' : 'Rejected'}.`
      });
    } catch (err) {
      console.error('Failed to record committee decision:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to record committee decision.' });
    }
  },

  /**
   * POST /api/disposal-requests/:id/disposal-record
   * Record destruction or tender release
   * Rule:
   *   - status must be 'approved' or 'in_disposal'
   *   - unique Way Bill rule: waybill_no must be unique for tender
   *   - serials become 'destroyed' or 'sold'
   *   - status becomes 'in_disposal' after first record, 'completed' when every approved item is disposed
   */
  async recordDisposalAction(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (!canHandleDisposalSteps(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'DISPOSAL_ACTION_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to record disposal action for ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin, Local Admin, or authorized Disposal Officers can record disposal actions.'
        });
      }

      if (request.status !== 'approved' && request.status !== 'in_disposal') {
        return res.status(400).json({
          success: false,
          message: `Cannot record disposal for request in status "${request.status}". Request must be "Approved" or "In Disposal".`
        });
      }

      let bodyData = req.body;
      const type = (bodyData.type || '').trim().toLowerCase(); // 'destruction' | 'tender'
      let reference = (bodyData.reference || '').trim();
      const date = (bodyData.date || '').trim();
      const remarks = (bodyData.remarks || '').trim();
      const waybillNo = (bodyData.waybill_no || '').trim();

      if (type !== 'destruction' && type !== 'tender') {
        return res.status(400).json({ success: false, message: 'Disposal type must be either "destruction" or "tender".' });
      }
      if (type === 'destruction' && !reference) {
        return res.status(400).json({ success: false, message: 'Reference number / Certificate number is required.' });
      }
      if (type === 'tender' && !reference) {
        reference = waybillNo;
      }
      if (!date) {
        return res.status(400).json({ success: false, message: 'Disposal date is required.' });
      }

      let rawItemIds = bodyData.item_ids;
      if (typeof rawItemIds === 'string') {
        try {
          rawItemIds = JSON.parse(rawItemIds);
        } catch (e) {
          rawItemIds = [rawItemIds];
        }
      }
      const itemIds = Array.isArray(rawItemIds) ? rawItemIds.filter(Boolean) : [];
      if (itemIds.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one approved item must be selected for disposal.' });
      }

      let rawWitnesses = bodyData.witnesses;
      if (typeof rawWitnesses === 'string') {
        try {
          rawWitnesses = JSON.parse(rawWitnesses);
        } catch (e) {
          rawWitnesses = [rawWitnesses];
        }
      }
      const witnesses = Array.isArray(rawWitnesses) ? rawWitnesses.filter(Boolean).map(w => String(w).trim()) : [];

      // Unique Way Bill Rule for Tender Release
      if (type === 'tender') {
        if (!waybillNo) {
          return res.status(400).json({ success: false, message: 'Way Bill number is required for Tender release.' });
        }

        // Check if waybill_no already exists anywhere in the system
        const existingWaybill = await DisposalRequest.findOne({
          'disposal_records.waybill_no': { $regex: new RegExp(`^${waybillNo.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        }).lean();

        if (existingWaybill) {
          return res.status(400).json({
            success: false,
            message: `Way Bill number "${waybillNo}" is already used in request ${existingWaybill.request_no}. Way Bill numbers must be unique.`
          });
        }
      }

      // Validate that all selected items were approved for this disposal type and not already disposed
      const isDestroy = type === 'destruction';
      const targetDisposition = isDestroy ? 'destroyed' : 'sold';

      const itemsToDispose = [];
      for (const id of itemIds) {
        const item = request.items.find(i => String(i.id) === String(id));
        if (!item) {
          return res.status(400).json({ success: false, message: `Item with ID ${id} not found in this request.` });
        }
        if (item.final_disposition) {
          return res.status(400).json({ success: false, message: `Item "${item.item_name}" has already been disposed (${item.final_disposition}).` });
        }
        const matchesDecision = isDestroy
          ? (item.committee_decision_item === 'Approve for Destroy' || item.committee_decision_item === 'Approve for Destruction')
          : (item.committee_decision_item === 'Approve for Tender');
        if (!matchesDecision) {
          return res.status(400).json({
            success: false,
            message: `Item "${item.item_name}" was decided as "${item.committee_decision_item}", not valid for "${type}".`
          });
        }
        itemsToDispose.push(item);
      }

      // Handle optional attachment
      let attachmentObj = null;
      if (req.file) {
        if (type === 'tender' && req.file.size > 300 * 1024) {
          return res.status(400).json({
            success: false,
            message: 'Way Bill file is too large. Maximum allowed size is 300 KB.'
          });
        }
        attachmentObj = await storageService.uploadDisposalAttachment(req.file, `${request.request_no}_${type}`);
      }

      // Mark items as disposed
      for (const item of itemsToDispose) {
        item.final_disposition = targetDisposition;
        item.disposal_ref = reference;
        item.serial_status = targetDisposition;
        item.disposed_qty = item.quantity;
        item.disposed_at = date;

        // Also record in IssuedDestroyedItem to keep general verification / inventory reports in sync
        try {
          const serials = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
            ? item.serial_numbers
            : (item.serial_number ? [item.serial_number] : []);

          await IssuedDestroyedItem.create({
            id: uuidv4(),
            item_id: item.inventory_item_id || uuidv4(),
            unit_id: request.unit_id,
            quantity: item.quantity,
            disposition: targetDisposition,
            reason: `Disposal via Board of Survey (${request.request_no}, Ref: ${reference})`,
            date,
            serial_number: serials[0] || null,
            serial_numbers: serials
          });
        } catch (syncErr) {
          console.warn('Sync to IssuedDestroyedItem notice:', syncErr.message);
        }
      }

      // Create new disposal record
      const record = {
        id: uuidv4(),
        type,
        reference,
        date,
        item_ids: itemIds,
        witnesses,
        remarks,
        waybill_no: type === 'tender' ? waybillNo : null,
        attachment: attachmentObj || null,
        created_at: new Date().toISOString(),
        created_by_name: req.user.full_name || req.user.username || 'Staff'
      };

      request.disposal_records.push(record);

      // Check if ALL approved items are now disposed
      const allApprovedItems = request.items.filter(
        i => i.committee_decision_item === 'Approve for Destroy' || i.committee_decision_item === 'Approve for Destruction' || i.committee_decision_item === 'Approve for Tender'
      );
      const allApprovedDisposed = allApprovedItems.every(i => Boolean(i.final_disposition));

      if (allApprovedDisposed) {
        request.status = 'completed';
      } else {
        request.status = 'in_disposal';
      }

      request.timeline.push({
        id: uuidv4(),
        status: request.status,
        action: `Disposal recorded: ${type === 'destruction' ? 'Destruction' : 'Tender Release'}`,
        actor_name: req.user.full_name || req.user.username || 'Staff',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: `Ref: ${reference}${waybillNo ? `, Way Bill: ${waybillNo}` : ''}. Disposed ${itemsToDispose.length} item(s). Status is now: ${request.status}.`
      });

      await request.save();

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'DISPOSAL_RECORDED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Disposal recorded (${type}, Ref: ${reference}${waybillNo ? `, Waybill: ${waybillNo}` : ''}) for ${request.request_no}. Items disposed: ${itemsToDispose.length}.`,
        status: 'success'
      });

      return res.json({
        success: true,
        data: request,
        message: `Disposal recorded successfully. Request is now ${request.status === 'completed' ? 'Completed' : 'In Disposal'}.`
      });
    } catch (err) {
      console.error('Failed to record disposal action:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to record disposal action.' });
    }
  },

  /**
   * POST /api/disposal-requests/:id/revert
   * Super Admin only: Revert last step with a reason
   */
  async revertLastStep(req, res) {
    try {
      const request = await DisposalRequest.findOne({ id: req.params.id });
      if (!request) {
        return res.status(404).json({ success: false, message: 'Disposal request not found.' });
      }

      if (!canHandleDisposalSteps(req.user, request)) {
        await auditLogger.log({
          actor_id: req.user.id || req.user._id,
          actor_name: req.user.full_name || req.user.username,
          actor_username: req.user.username,
          actor_role: req.user.role,
          unit_id: request.unit_id,
          unit_name: request.unit_name,
          module: 'Disposal',
          action: 'REVERT_STEP_DENIED',
          entity_type: 'DisposalRequest',
          entity_id: request.id,
          entity_reference: request.request_no,
          description: `User ${req.user.full_name} (${req.user.role}) denied permission to revert disposal workflow step for ${request.request_no}: permission denied`,
          status: 'denied',
          error_message: 'permission denied',
          req,
          res
        });
        return res.status(403).json({
          success: false,
          message: 'Only Super Admin, Local Admin, or authorized Disposal Officers can revert disposal workflow steps.'
        });
      }

      const { reason } = req.body;
      if (!reason || String(reason).trim().length < 3) {
        return res.status(400).json({ success: false, message: 'A valid reason (at least 3 characters) is required to revert a step.' });
      }

      const currentStatus = request.status;
      let newStatus = '';

      if (currentStatus === 'completed') {
        // Revert Completed -> In Disposal
        newStatus = 'in_disposal';
        // Pop last disposal record and reset its items
        if (request.disposal_records.length > 0) {
          const lastRecord = request.disposal_records.pop();
          request.items.forEach(item => {
            if (lastRecord.item_ids.includes(String(item.id))) {
              item.final_disposition = null;
              item.disposal_ref = null;
              item.serial_status = 'approved_for_disposal';
              item.disposed_qty = 0;
              item.disposed_at = null;
            }
          });
        }
      } else if (currentStatus === 'in_disposal') {
        // Revert In Disposal -> Approved
        newStatus = 'approved';
        request.disposal_records = [];
        request.items.forEach(item => {
          if (item.committee_decision_item === 'Approve for Destroy' || item.committee_decision_item === 'Approve for Destruction' || item.committee_decision_item === 'Approve for Tender') {
            item.final_disposition = null;
            item.disposal_ref = null;
            item.serial_status = 'approved_for_disposal';
            item.disposed_qty = 0;
            item.disposed_at = null;
          }
        });
      } else if (currentStatus === 'approved' || currentStatus === 'rejected') {
        // Revert Approved / Rejected -> Board Appointed
        newStatus = 'board_appointed';
        request.committee_decision = null;
        request.items.forEach(item => {
          item.committee_decision_item = null;
          item.committee_remarks = '';
          item.serial_status = 'pending_disposal';
          item.final_disposition = null;
          item.disposal_ref = null;
        });
      } else if (currentStatus === 'board_appointed') {
        // Revert Board Appointed -> Submitted
        newStatus = 'submitted';
        request.board = {
          members: [],
          appointed_by_name: '',
          appointment_letter_no: '',
          appointment_date: null
        };
      } else if (currentStatus === 'submitted') {
        // Revert Submitted -> Draft
        newStatus = 'draft';
        request.submitted_at = null;
      } else {
        return res.status(400).json({ success: false, message: 'Draft requests cannot be reverted further.' });
      }

      request.status = newStatus;

      request.timeline.push({
        id: uuidv4(),
        status: newStatus,
        action: `Step reverted by Super Admin: ${currentStatus} -> ${newStatus}`,
        actor_name: req.user.full_name || req.user.username || 'Super Admin',
        actor_id: req.user.id || req.user._id,
        timestamp: new Date().toISOString(),
        notes: `Reason: ${reason.trim()}`
      });

      await request.save();

      await auditLogger.log({
        actor_id: req.user.id || req.user._id,
        actor_name: req.user.full_name || req.user.username,
        actor_username: req.user.username,
        actor_role: req.user.role,
        unit_id: request.unit_id,
        unit_name: request.unit_name,
        module: 'Disposal',
        action: 'DISPOSAL_REQUEST_REVERTED',
        entity_type: 'DisposalRequest',
        entity_id: request.id,
        entity_reference: request.request_no,
        description: `Reverted disposal request ${request.request_no} from "${currentStatus}" to "${newStatus}". Reason: ${reason.trim()}`,
        status: 'success'
      });

      return res.json({
        success: true,
        data: request,
        message: `Disposal request successfully reverted from ${currentStatus} to ${newStatus}.`
      });
    } catch (err) {
      console.error('Failed to revert disposal request step:', err);
      return res.status(500).json({ success: false, message: 'Failed to revert disposal request step.' });
    }
  },

  /**
   * GET /api/disposal-requests/attachment/:filename
   * Serve disposal attachments safely
   */
  async getAttachment(req, res) {
    try {
      const { filename } = req.params;
      const cleanName = path.basename(filename);
      const filePath = path.join(DISPOSAL_UPLOADS_DIR, cleanName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Attachment file not found.' });
      }

      return res.sendFile(filePath);
    } catch (err) {
      console.error('Failed to send disposal attachment:', err);
      return res.status(500).json({ success: false, message: 'Failed to serve attachment.' });
    }
  }
};

module.exports = disposalController;

