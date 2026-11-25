const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AuditLogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    unit_id: {
      type: String,
      default: null,
      index: true
    },
    unit_name: {
      type: String,
      default: ''
    },
    actor_id: {
      type: String,
      default: null,
      index: true
    },
    actor_name: {
      type: String,
      default: 'System'
    },
    actor_username: {
      type: String,
      default: ''
    },
    actor_role: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    module: {
      type: String,
      required: true,
      index: true
    },
    entity_type: {
      type: String,
      default: ''
    },
    entity_id: {
      type: String,
      default: null
    },
    entity_reference: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'denied'],
      default: 'success',
      index: true
    },
    error_message: {
      type: String,
      default: null
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ip_address: {
      type: String,
      default: ''
    },
    ip_raw: {
      type: String,
      default: ''
    },
    ip_source: {
      type: String,
      enum: ['direct', 'proxy', 'local-resolved', 'unknown'],
      default: 'direct'
    },
    user_agent: {
      type: String,
      default: ''
    },
    request_id: {
      type: String,
      default: ''
    }
  },
  {
    collection: 'audit_logs',
    timestamps: false,
    versionKey: false
  }
);

// Compound indexes for performant querying and filtering
AuditLogSchema.index({ unit_id: 1, created_at: -1 });
AuditLogSchema.index({ actor_id: 1, created_at: -1 });
AuditLogSchema.index({ module: 1, action: 1 });
AuditLogSchema.index({ description: 'text', entity_reference: 'text', actor_username: 'text', actor_name: 'text' });

// Optional configurable retention in days (default: 0 = keep forever)
const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '0', 10);
if (retentionDays > 0) {
  AuditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: retentionDays * 86400 });
}

module.exports = mongoose.model('AuditLog', AuditLogSchema);

