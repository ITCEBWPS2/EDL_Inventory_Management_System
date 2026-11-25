const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ItemTypeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true
    },
    // Sub-category item types taxonomy (e.g., 'Bench' under subcategory 'chairs' in 'furniture')
    category_slug: {
      type: String,
      default: null,
      trim: true
    },
    subcategory_slug: {
      type: String,
      default: null,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    name_normalized: {
      type: String,
      default: null,
      trim: true
    },
    code: {
      type: String,
      default: null,
      trim: true
    },
    created_by: {
      type: String,
      default: null
    },
    unit_id: {
      type: String,
      default: null
    },
    is_active: {
      type: Boolean,
      default: true
    },

    // Backward-compatibility fields for category-level subtypes
    slug: {
      type: String,
      default: null,
      trim: true
    },
    category: {
      type: String,
      default: null,
      trim: true
    },
    category_id: {
      type: String,
      default: null
    },
    sub_category_code: {
      type: String,
      default: null,
      trim: true
    },
    item_type_code: {
      type: String,
      default: null,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
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

// Pre-save normalizer
ItemTypeSchema.pre('save', function () {
  if (this.name) {
    this.name_normalized = this.name.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  if (this.subcategory_slug) {
    this.subcategory_slug = this.subcategory_slug.toLowerCase().trim();
  }
});

// Indexes for subcategory item types
ItemTypeSchema.index(
  { subcategory_slug: 1, name_normalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      subcategory_slug: { $type: 'string' },
      name_normalized: { $type: 'string' }
    }
  }
);

ItemTypeSchema.index(
  { subcategory_slug: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      subcategory_slug: { $type: 'string' },
      code: { $type: 'string' }
    }
  }
);

// Backward-compatible indexes
ItemTypeSchema.index({ category: 1, slug: 1 }, { sparse: true });
ItemTypeSchema.index({ category: 1, name: 1 }, { sparse: true });

module.exports = mongoose.model('ItemType', ItemTypeSchema, 'item_types');
