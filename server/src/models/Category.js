const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CategorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    parent_id: {
      type: String,
      default: null
    },
    requires_serial: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      default: ''
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

module.exports = mongoose.model('Category', CategorySchema, 'categories');
