const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    designation: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const CommitteeDecisionSchema = new mongoose.Schema(
  {
    report_ref: { type: String, required: true, trim: true },
    decision_date: { type: String, required: true, trim: true },
    inspection_date: { type: String, default: null, trim: true },
    members_present: { type: [String], default: [] },
    remarks: { type: String, default: '', trim: true },
    attachment: {
      filename: { type: String, default: null },
      original_name: { type: String, default: null },
      url: { type: String, default: null },
      size: { type: Number, default: 0 },
      mimetype: { type: String, default: null }
    }
  },
  { _id: false }
);

const DisposalItemSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    inventory_item_id: { type: String, default: null },
    item_name: { type: String, required: true, trim: true },
    item_code: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    serial_numbers: { type: [String], default: [] },
    serial_number: { type: String, default: '' },
    condition_notes: { type: String, default: '', trim: true },
    committee_decision_item: {
      type: String,
      enum: ['Approve for Destruction', 'Approve for Tender', 'Retain', 'Repair', 'Reject', null],
      default: null
    },
    committee_remarks: { type: String, default: '', trim: true },
    serial_status: {
      type: String,
      enum: ['pending_disposal', 'approved_for_disposal', 'active', 'destroyed', 'sold'],
      default: 'pending_disposal'
    },
    final_disposition: {
      type: String,
      enum: ['destroyed', 'sold', null],
      default: null
    },
    disposal_ref: { type: String, default: null },
    disposed_qty: { type: Number, default: 0 },
    disposed_at: { type: String, default: null }
  },
  { _id: false }
);

const DisposalRecordSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    type: { type: String, enum: ['destruction', 'tender'], required: true },
    reference: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    item_ids: { type: [String], default: [] },
    witnesses: { type: [String], default: [] },
    remarks: { type: String, default: '', trim: true },
    waybill_no: { type: String, default: null, trim: true },
    attachment: {
      filename: { type: String, default: null },
      original_name: { type: String, default: null },
      url: { type: String, default: null },
      size: { type: Number, default: 0 },
      mimetype: { type: String, default: null }
    },
    created_at: { type: String, default: () => new Date().toISOString() },
    created_by_name: { type: String, default: '' }
  },
  { _id: false }
);

const TimelineEventSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    status: { type: String, required: true },
    action: { type: String, required: true },
    actor_name: { type: String, default: 'System' },
    actor_id: { type: String, default: null },
    timestamp: { type: String, default: () => new Date().toISOString() },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const DisposalRequestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    request_no: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    unit_id: {
      type: String,
      required: true,
      index: true
    },
    unit_name: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'board_appointed', 'approved', 'rejected', 'in_disposal', 'completed'],
      default: 'draft',
      index: true
    },
    items: {
      type: [DisposalItemSchema],
      default: []
    },
    board: {
      members: {
        type: [MemberSchema],
        default: []
      },
      appointed_by_name: {
        type: String,
        default: '',
        trim: true
      },
      appointment_letter_no: {
        type: String,
        default: '',
        trim: true
      },
      appointment_date: {
        type: String,
        default: null
      }
    },
    committee_decision: {
      type: CommitteeDecisionSchema,
      default: null
    },
    disposal_records: {
      type: [DisposalRecordSchema],
      default: []
    },
    timeline: {
      type: [TimelineEventSchema],
      default: []
    },
    created_by_id: {
      type: String,
      default: null
    },
    created_by_name: {
      type: String,
      default: ''
    },
    submitted_at: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Index to ensure waybill_no uniqueness across disposal_records when present
DisposalRequestSchema.index(
  { 'disposal_records.waybill_no': 1 },
  { partialFilterExpression: { 'disposal_records.waybill_no': { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('DisposalRequest', DisposalRequestSchema, 'disposal_requests');

