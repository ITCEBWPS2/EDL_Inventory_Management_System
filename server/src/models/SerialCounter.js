const mongoose = require('mongoose');

const SerialCounterSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    last_sequence: {
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

module.exports = mongoose.model('SerialCounter', SerialCounterSchema, 'serial_counters');
