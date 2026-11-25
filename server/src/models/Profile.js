const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ProfileSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    full_name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    role: {
      type: String,
      required: true,
      enum: ['super_admin', 'local_admin', 'unit_head', 'employee']
    },
    permission_level: {
      type: String,
      default: null,
      enum: ['read_write', 'read_only', 'no_permission', 'disposal_only', null]
    },
    contact_info: {
      type: String,
      default: ''
    },
    account_status: {
      type: String,
      default: 'active',
      enum: ['active', 'inactive']
    },
    password_hash: {
      type: String,
      required: true
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

ProfileSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
ProfileSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// Virtual property for backward compatibility with profile.passwordHash
ProfileSchema.virtual('passwordHash')
  .get(function () {
    return this.password_hash;
  })
  .set(function (val) {
    this.password_hash = val;
  });

module.exports = mongoose.model('Profile', ProfileSchema, 'profiles');
