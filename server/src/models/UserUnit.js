const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UserUnitSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    user_id: {
      type: String,
      required: true,
      index: true
    },
    unit_id: {
      type: String,
      required: true,
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

UserUnitSchema.index({ user_id: 1, unit_id: 1 }, { unique: true });

module.exports = mongoose.model('UserUnit', UserUnitSchema, 'user_units');
