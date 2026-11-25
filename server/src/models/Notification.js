const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const NotificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    recipient_user_id: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      default: 'disposal_request_submitted'
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    link: {
      type: String,
      required: true,
      trim: true
    },
    request_id: {
      type: String,
      default: null,
      index: true
    },
    request_no: {
      type: String,
      default: null
    },
    unit_id: {
      type: String,
      default: null
    },
    unit_name: {
      type: String,
      default: ''
    },
    read_at: {
      type: Date,
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

// Index for query: recipient_user_id, read_at, created_at desc
NotificationSchema.index({ recipient_user_id: 1, read_at: 1, created_at: -1 });

module.exports = mongoose.model('Notification', NotificationSchema, 'notifications');

