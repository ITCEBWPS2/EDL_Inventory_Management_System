const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Member name is required'],
    trim: true
  },
  designation: {
    type: String,
    required: [true, 'Member designation is required'],
    trim: true
  }
}, { _id: false });

const verificationTeamSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: [true, 'Verification year is required'],
    index: true
  },
  unit_id: {
    type: String,
    required: [true, 'Unit ID is required'],
    index: true
  },
  unit_name: {
    type: String,
    required: [true, 'Unit name is required'],
    trim: true
  },
  unit_path: {
    type: String,
    required: [true, 'Unit hierarchy path is required'],
    trim: true
  },
  members: {
    type: [memberSchema],
    validate: {
      validator: function(val) {
        return Array.isArray(val) && val.length === 3;
      },
      message: 'Exactly 3 team members (name and designation) are required per verification team.'
    }
  },
  created_by: {
    type: String,
    default: null
  },
  updated_by: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'verification_teams'
});

// Unique compound index on year and unit_id
verificationTeamSchema.index({ year: 1, unit_id: 1 }, { unique: true });

module.exports = mongoose.model('VerificationTeam', verificationTeamSchema);
