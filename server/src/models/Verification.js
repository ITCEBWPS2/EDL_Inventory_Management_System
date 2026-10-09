const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const VerificationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    unit_id: {
      type: String,
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    verifier_1: {
      type: String,
      default: ''
    },
    verifier_2: {
      type: String,
      default: ''
    },
    verifier_3: {
      type: String,
      default: ''
    },
    verified_by: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      default: 'confirmed'
    },
    summary: {
      type: String,
      default: ''
    },
    confirmed_by: {
      type: String,
      default: null
    },
    confirmed_at: {
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

VerificationSchema.index({ unit_id: 1, year: 1 });

module.exports = mongoose.model('Verification', VerificationSchema, 'verifications');
