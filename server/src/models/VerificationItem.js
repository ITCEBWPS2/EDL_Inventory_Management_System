const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const VerificationItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    verification_id: {
      type: String,
      required: true,
      index: true
    },
    item_id: {
      type: String,
      default: null,
      index: true
    },
    item_code: {
      type: String,
      default: ''
    },
    serial_numbers: {
      type: [String],
      default: []
    },
    manufacturer_sn: {
      type: String,
      default: ''
    },
    manufacturer_serial_numbers: {
      type: [String],
      default: []
    },
    is_batch: {
      type: Boolean,
      default: false
    },
    item_name: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      default: ''
    },
    system_qty: {
      type: Number,
      default: 0
    },
    physical_qty: {
      type: Number,
      default: null
    },
    difference: {
      type: Number,
      default: 0
    },
    condition: {
      type: String,
      default: 'Good'
    },
    label_no: {
      type: String,
      default: ''
    },
    remarks: {
      type: String,
      default: ''
    },
    special_remarks: {
      type: String,
      default: ''
    },
    disposition: {
      type: String,
      default: ''
    },
    issued_destroyed: {
      type: String,
      default: ''
    },
    issued_destroyed_id: {
      type: String,
      default: null
    },
    issued_destroyed_qty: {
      type: Number,
      default: null
    },
    in_inventory: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      default: 'Not Counted'
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

module.exports = mongoose.model('VerificationItem', VerificationItemSchema, 'verification_items');
