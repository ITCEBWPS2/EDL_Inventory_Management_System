const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UnitSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    unit_name: {
      type: String,
      required: true,
      trim: true
    },
    unit_code: {
      type: String,
      required: true,
      trim: true
    },
    unit_type: {
      type: String,
      required: true,
      enum: ['area', 'unit', 'csc']
    },
    parent_unit_id: {
      type: String,
      default: null
    },
    location: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: 'active'
    },
    sort_order: {
      type: Number,
      default: 0
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

module.exports = mongoose.model('Unit', UnitSchema, 'units');
