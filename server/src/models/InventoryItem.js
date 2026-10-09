const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const InventoryItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    item_name: {
      type: String,
      required: true,
      trim: true
    },
    item_code: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    category_id: {
      type: String,
      default: null
    },
    unit_id: {
      type: String,
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    serial_number: {
      type: String,
      default: null
    },
    manufacturer_serial_numbers: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      default: 'In Stock'
    },
    sub_type: {
      type: String,
      default: null
    },
    sub_classification: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: null
    },
    brand: {
      type: String,
      default: null
    },
    serial_numbers: {
      type: [String],
      default: []
    },
    is_batch: {
      type: Boolean,
      default: false
    },
    batch_label: {
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

InventoryItemSchema.index({ unit_id: 1, category: 1, item_code: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema, 'inventory_items');
