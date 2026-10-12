const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const IssuedDestroyedItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    item_id: {
      type: String,
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true
    },
    disposition: {
      type: String,
      required: true,
      trim: true
    },
    reason: {
      type: String,
      default: ''
    },
    date: {
      type: String,
      required: true
    },
    unit_id: {
      type: String,
      default: null,
      index: true
    },
    serial_number: {
      type: String,
      default: null
    },
    verification_id: {
      type: String,
      default: null,
      index: true
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

module.exports = mongoose.model('IssuedDestroyedItem', IssuedDestroyedItemSchema, 'issued_destroyed_items');
