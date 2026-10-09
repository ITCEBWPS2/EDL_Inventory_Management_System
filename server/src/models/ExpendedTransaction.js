const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ExpendedTransactionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    item_id: {
      type: String,
      default: null
    },
    item_name: {
      type: String,
      required: true,
      trim: true
    },
    item_code: {
      type: String,
      default: '',
      trim: true
    },
    category: {
      type: String,
      default: '',
      trim: true
    },
    quantity: {
      type: Number,
      required: true
    },
    date: {
      type: String,
      required: true
    },
    unit_id: {
      type: String,
      required: true,
      index: true
    },
    voucher_no: {
      type: String,
      required: true,
      trim: true
    },
    disposition: {
      type: String,
      default: '',
      trim: true
    },
    notes: {
      type: String,
      default: ''
    },
    created_by: {
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

ExpendedTransactionSchema.index({ unit_id: 1, date: 1, voucher_no: 1 });

module.exports = mongoose.model('ExpendedTransaction', ExpendedTransactionSchema, 'expended_transactions');
