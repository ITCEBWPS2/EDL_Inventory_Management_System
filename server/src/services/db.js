const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const {
  Profile,
  Unit,
  UserUnit,
  Category,
  InventoryItem,
  ReceivedTransaction,
  ExpendedTransaction,
  Verification,
  VerificationItem,
  IssuedDestroyedItem,
  SerialCounter,
  ItemType,
  stripMongo
} = require('../models');
const { connect, mongoose } = require('../config/mongo');

async function ensureConnected() {
  if (mongoose.connection.readyState === 0) {
    await connect();
  } else if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
  }
}

// Helper to escape regex special characters
function escapeRegex(text) {
  return (text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

const BUILTIN_CATEGORIES = [
  { id: '22222222-2222-2222-2222-222222222201', name: 'Furniture', slug: 'furniture', code: 'FUR' },
  { id: '22222222-2222-2222-2222-222222222202', name: 'IT & Computing Equipment', slug: 'it-computing-equipment', code: 'IT' },
  { id: '22222222-2222-2222-2222-222222222203', name: 'Network & Communication Equipment', slug: 'network-communication-equipment', code: 'NET' },
  { id: '22222222-2222-2222-2222-222222222204', name: 'Audio Visual & Presentation Equipment', slug: 'audio-visual-presentation-equipment', code: 'AV' },
  { id: '22222222-2222-2222-2222-222222222206', name: 'Tools & Equipment', slug: 'tools-equipment', code: 'TLS' }
];

const BUILTIN_SUBCATEGORIES = [
  // Furniture
  { category: 'furniture', categoryName: 'Furniture', name: 'Chairs', slug: 'chairs', code: 'CHR' },
  { category: 'furniture', categoryName: 'Furniture', name: 'Tables', slug: 'tables', code: 'TBL' },
  { category: 'furniture', categoryName: 'Furniture', name: 'Cupboards & Cabinets', slug: 'cupboards-cabinets', code: 'CAB' },
  { category: 'furniture', categoryName: 'Furniture', name: 'Shelving & Racking', slug: 'shelving-racking', code: 'SHL' },
  { category: 'furniture', categoryName: 'Furniture', name: 'Workstations', slug: 'workstations', code: 'WST' },
  // IT & Computing Equipment
  { category: 'it-computing-equipment', categoryName: 'IT & Computing Equipment', name: 'Computers & Peripherals', slug: 'computers-peripherals', code: 'CMP' },
  { category: 'it-computing-equipment', categoryName: 'IT & Computing Equipment', name: 'Storage Devices', slug: 'storage-devices', code: 'STR' },
  { category: 'it-computing-equipment', categoryName: 'IT & Computing Equipment', name: 'Printers & Printing Equipment', slug: 'printers-printing-equipment', code: 'PRN' },
  { category: 'it-computing-equipment', categoryName: 'IT & Computing Equipment', name: 'Scanning & Office Machines', slug: 'scanning-office-machines', code: 'SCN' },
  // Network & Communication Equipment
  { category: 'network-communication-equipment', categoryName: 'Network & Communication Equipment', name: 'Network Equipment', slug: 'network-equipment', code: 'NET' },
  { category: 'network-communication-equipment', categoryName: 'Network & Communication Equipment', name: 'Servers & Storage', slug: 'servers-storage', code: 'SRV' },
  { category: 'network-communication-equipment', categoryName: 'Network & Communication Equipment', name: 'Telephones & Phones', slug: 'telephones-phones', code: 'TEL' },
  { category: 'network-communication-equipment', categoryName: 'Network & Communication Equipment', name: 'Cameras', slug: 'cameras', code: 'CAM' },
  { category: 'network-communication-equipment', categoryName: 'Network & Communication Equipment', name: 'CCTV Recording & Display', slug: 'cctv-recording-display', code: 'CCTV' },
  // Audio Visual & Presentation Equipment
  { category: 'audio-visual-presentation-equipment', categoryName: 'Audio Visual & Presentation Equipment', name: 'Audio Equipment', slug: 'audio-equipment', code: 'AUD' },
  { category: 'audio-visual-presentation-equipment', categoryName: 'Audio Visual & Presentation Equipment', name: 'Display & Presentation', slug: 'display-presentation', code: 'DSP' },
  // Tools & Equipment
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Hand Tools', slug: 'hand-tools', code: 'HTL' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Electrical Tools & Testing Equipment', slug: 'electrical-tools-testing-equipment', code: 'ETE' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Tool Storage & Handling', slug: 'tool-storage-handling', code: 'TSH' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Safety Equipment & PPE', slug: 'safety-equipment-ppe', code: 'PPE' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Power & Utility Equipment', slug: 'power-utility-equipment', code: 'PUE' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Air Conditioning & Ventilation', slug: 'air-conditioning-ventilation', code: 'ACV' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Cleaning Equipment', slug: 'cleaning-equipment', code: 'CLN' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Kitchen / Refreshment Equipment', slug: 'kitchen-refreshment-equipment', code: 'KTC' },
  { category: 'tools-equipment', categoryName: 'Tools & Equipment', name: 'Office & General Equipment', slug: 'office-general-equipment', code: 'OGE' }
];

// Batch & serial resolver matching existing business logic exactly
function resolveItemSerials(item) {
  const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
  const isBatch = qty > 1 || Boolean(item.is_batch) || (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 1);

  let mfgList = [];
  if (Array.isArray(item.manufacturer_serial_numbers)) {
    mfgList = item.manufacturer_serial_numbers.map(s => (s ? String(s).trim() : ''));
  } else if (item.serial_number) {
    mfgList = [String(item.serial_number).trim()];
  }

  // Normalize mfgList to length qty
  if (mfgList.length < qty) {
    mfgList = [...mfgList, ...Array(qty - mfgList.length).fill('')];
  } else if (mfgList.length > qty) {
    mfgList = mfgList.slice(0, qty);
  }

  if (!isBatch) {
    const singleMfg = (mfgList[0] || (item.serial_number ? String(item.serial_number).trim() : '')).trim();
    return {
      is_batch: false,
      batch_label: null,
      serial_numbers: item.item_code ? [item.item_code] : [],
      serial_number: singleMfg || null,
      manufacturer_serial_numbers: singleMfg ? [singleMfg] : ['']
    };
  }

  const batchLabel = item.batch_label || `${item.sub_classification || item.item_name || 'Item'} Batch (Multi-Serial)`;
  let list = [];
  if (Array.isArray(item.serial_numbers) && item.serial_numbers.length === qty) {
    list = item.serial_numbers;
  } else {
    // Derive sequential serials from item.item_code
    const baseCode = (item.item_code || 'ITM-001').trim();
    const match = baseCode.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numDigits = Math.max(3, match[2].length);
      const startNum = parseInt(match[2], 10);
      for (let i = 0; i < qty; i++) {
        list.push(`${prefix}${String(startNum + i).padStart(numDigits, '0')}`);
      }
    } else {
      for (let i = 1; i <= qty; i++) {
        list.push(`${baseCode}-${String(i).padStart(3, '0')}`);
      }
    }
  }

  return {
    is_batch: true,
    batch_label: batchLabel,
    serial_numbers: list,
    serial_number: null,
    manufacturer_serial_numbers: mfgList
  };
}

// Compute dynamic remaining balances strictly reconciling with received & expended
async function getComputedRemaining(unitIdFilter = null) {
  const recQuery = unitIdFilter ? { unit_id: unitIdFilter } : {};
  const expQuery = unitIdFilter ? { unit_id: unitIdFilter } : {};

  const [allReceived, allExpended, allUnits, allInventory] = await Promise.all([
    ReceivedTransaction.find(recQuery).lean(),
    ExpendedTransaction.find(expQuery).lean(),
    Unit.find({}).lean(),
    InventoryItem.find({}).lean()
  ]);

  const unitsMap = new Map(allUnits.map(u => [u.id, u]));
  const recMap = new Map();

  // Aggregate received items per unit + item_name
  allReceived.forEach(r => {
    const name = (r.item_name || '').trim();
    if (!name) return;
    const norm = name.toLowerCase();
    const key = `${r.unit_id}::${norm}`;

    if (!recMap.has(key)) {
      const unit = unitsMap.get(r.unit_id) || {};
      const matchedInv = (allInventory || []).find(i =>
        (r.item_id && i.id === r.item_id) ||
        (i.item_name && i.item_name.toLowerCase() === norm)
      );
      const cleanNorm = norm.replace(/[^a-z0-9]/g, '').substring(0, 4).toUpperCase();
      const itemCode = matchedInv?.item_code || r.item_code || (`ITM-${cleanNorm || 'GEN'}`);

      recMap.set(key, {
        item_id: matchedInv?.id || key,
        item_code: itemCode,
        item_name: name,
        category: r.category || matchedInv?.category || 'General',
        category_id: r.category_id || matchedInv?.category_id || null,
        unit_id: r.unit_id,
        unit_name: unit.unit_name || 'Unknown Unit',
        location: unit.location || '',
        total_received: 0,
        total_expended: 0,
        serial_number: r.serial_number || matchedInv?.serial_number || null
      });
    }
    recMap.get(key).total_received += Number(r.quantity || 0);
  });

  // Deduct expended items matching unit + item_name
  allExpended.forEach(e => {
    const name = (e.item_name || '').trim();
    if (!name) return;
    const norm = name.toLowerCase();
    const key = `${e.unit_id}::${norm}`;
    if (recMap.has(key)) {
      recMap.get(key).total_expended += Number(e.quantity || 0);
    }
  });

  return Array.from(recMap.values()).map(item => {
    const remainingQty = Math.max(0, item.total_received - item.total_expended);
    let stock_status = 'In Stock';
    if (remainingQty <= 0) stock_status = 'Out of Stock';
    else if (remainingQty <= 5) stock_status = 'Low Stock';

    return {
      ...item,
      remaining_qty: remainingQty,
      stock_status
    };
  });
}

const db = {
  // --- Profiles & Auth ---
  async getProfileById(userId) {
    const doc = await Profile.findOne({ id: userId }).lean();
    if (!doc) return null;
    const stripped = stripMongo(doc);
    stripped.passwordHash = stripped.password_hash;
    return stripped;
  },

  async getProfileByUsername(username) {
    const q = (username || '').toLowerCase().trim();
    const aliases = {
      'sadmin': 'superadmin',
      'sadmin@edl.lk': 'superadmin',
      'admin@edl.lk': 'superadmin',
      'ladmin': 'localadmin',
      'ladmin@edl.lk': 'localadmin',
      'colombo.admin@edl.lk': 'localadmin',
      'headit': 'unithead',
      'headit@edl.lk': 'unithead',
      'head.kelaniya@edl.lk': 'unithead',
      'emp.rw': 'employeerw',
      'emp.rw@edl.lk': 'employeerw',
      'emp.ro': 'employeero',
      'emp.ro@edl.lk': 'employeero',
      'emp.none': 'employeenone',
      'emp.none@edl.lk': 'employeenone'
    };
    const target = aliases[q] || q;

    let doc = await Profile.findOne({
      $or: [
        { username: target },
        { username: q },
        { email: q }
      ]
    }).collation({ locale: 'en', strength: 2 }).lean();

    if (!doc) {
      doc = await Profile.findOne({
        $or: [
          { username: new RegExp(`^${escapeRegex(target)}$`, 'i') },
          { username: new RegExp(`^${escapeRegex(q)}$`, 'i') },
          { email: new RegExp(`^${escapeRegex(q)}$`, 'i') }
        ]
      }).lean();
    }

    if (!doc) return null;
    const stripped = stripMongo(doc);
    stripped.passwordHash = stripped.password_hash;
    return stripped;
  },

  async getProfileByEmail(email) {
    if (!email) return null;
    const norm = String(email).trim().toLowerCase();
    let doc = await Profile.findOne({ email: norm }).collation({ locale: 'en', strength: 2 }).lean();
    if (!doc) {
      doc = await Profile.findOne({ email: new RegExp(`^${escapeRegex(norm)}$`, 'i') }).lean();
    }
    if (!doc) return null;
    const stripped = stripMongo(doc);
    stripped.passwordHash = stripped.password_hash;
    return stripped;
  },

  async getAllProfiles() {
    const docs = await Profile.find({}).lean();
    return docs.map(d => {
      const s = stripMongo(d);
      s.passwordHash = s.password_hash;
      return s;
    });
  },

  async createProfile(profileData, callerRole = null) {
    let finalRole = profileData.role;
    let finalPermission = profileData.permission_level || null;
    let finalStatus = profileData.account_status || 'active';

    // Emulate enforce_profile_field_lock trigger: non-admin self-signup defaults to employee / no_permission
    if (callerRole && callerRole !== 'super_admin' && callerRole !== 'local_admin' && callerRole !== 'service_role') {
      finalRole = 'employee';
      finalPermission = 'no_permission';
      finalStatus = 'active';
    }

    let passwordHash = profileData.password_hash || profileData.passwordHash;
    if (!passwordHash) {
      if (profileData.password) {
        passwordHash = await bcrypt.hash(profileData.password, 10);
      } else {
        passwordHash = await bcrypt.hash('password123', 10);
      }
    } else if (typeof passwordHash === 'string' && !passwordHash.startsWith('$2')) {
      passwordHash = await bcrypt.hash(passwordHash, 10);
    }

    const newProfile = {
      id: profileData.id || uuidv4(),
      username: profileData.username ? String(profileData.username).trim().toLowerCase() : profileData.username,
      full_name: profileData.full_name ? String(profileData.full_name).trim() : profileData.full_name,
      email: profileData.email ? String(profileData.email).trim().toLowerCase() : undefined,
      role: finalRole,
      permission_level: finalPermission,
      contact_info: profileData.contact_info || '',
      account_status: finalStatus,
      password_hash: passwordHash
    };

    try {
      const created = await Profile.create(newProfile);
      const result = stripMongo(created.toObject());
      result.passwordHash = result.password_hash;
      return result;
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.email || (err.message && err.message.includes('email'))) {
          const e = new Error('Email already in use.');
          e.code = 11000;
          throw e;
        }
        if (err.keyPattern?.username || (err.message && err.message.includes('username'))) {
          const e = new Error('Username already in use.');
          e.code = 11000;
          throw e;
        }
      }
      throw err;
    }
  },

  async updateProfile(id, updates, callerRole = null) {
    const sanitizedUpdates = { ...updates };
    // Emulate enforce_profile_field_lock trigger: non-admin self-update cannot escalate role/permission/status
    if (callerRole && callerRole !== 'super_admin' && callerRole !== 'local_admin' && callerRole !== 'service_role') {
      delete sanitizedUpdates.role;
      delete sanitizedUpdates.permission_level;
      delete sanitizedUpdates.account_status;
    }

    if (sanitizedUpdates.passwordHash || sanitizedUpdates.password) {
      const raw = sanitizedUpdates.passwordHash || sanitizedUpdates.password;
      sanitizedUpdates.password_hash = (typeof raw === 'string' && raw.startsWith('$2')) ? raw : await bcrypt.hash(raw, 10);
      delete sanitizedUpdates.passwordHash;
      delete sanitizedUpdates.password;
    }

    if (sanitizedUpdates.username !== undefined) {
      sanitizedUpdates.username = sanitizedUpdates.username ? String(sanitizedUpdates.username).trim().toLowerCase() : sanitizedUpdates.username;
    }

    if (sanitizedUpdates.email !== undefined) {
      sanitizedUpdates.email = sanitizedUpdates.email ? String(sanitizedUpdates.email).trim().toLowerCase() : sanitizedUpdates.email;
    }

    try {
      const updated = await Profile.findOneAndUpdate(
        { id },
        { $set: sanitizedUpdates },
        { returnDocument: 'after' }
      ).lean();

      if (!updated) return null;
      const result = stripMongo(updated);
      result.passwordHash = result.password_hash;
      return result;
    } catch (err) {
      if (err.code === 11000) {
        if (err.keyPattern?.email || (err.message && err.message.includes('email'))) {
          const e = new Error('Email already in use.');
          e.code = 11000;
          throw e;
        }
        if (err.keyPattern?.username || (err.message && err.message.includes('username'))) {
          const e = new Error('Username already in use.');
          e.code = 11000;
          throw e;
        }
      }
      throw err;
    }
  },

  async countSuperAdmins() {
    return await Profile.countDocuments({ role: 'super_admin' });
  },

  async deleteProfile(id) {
    await UserUnit.deleteMany({ user_id: id });
    const res = await Profile.deleteOne({ id });
    return res.deletedCount > 0;
  },

  // --- Units & User Units ---
  async getUnits() {
    const docs = await Unit.find({}).lean();
    return stripMongo(docs);
  },

  async getUnitById(id) {
    const doc = await Unit.findOne({ id }).lean();
    return stripMongo(doc);
  },

  async getDescendantUnitIds(unitId) {
    if (!unitId) return [];
    const allUnits = await Unit.find({}).lean();
    const ids = [unitId];
    const collect = (pId) => {
      for (const u of allUnits) {
        if (u.parent_unit_id === pId) {
          ids.push(u.id);
          collect(u.id);
        }
      }
    };
    collect(unitId);
    return ids;
  },

  async createUnit(unitData) {
    const newUnit = {
      id: unitData.id || uuidv4(),
      unit_name: unitData.unit_name,
      unit_code: unitData.unit_code,
      unit_type: unitData.unit_type,
      parent_unit_id: unitData.parent_unit_id || null,
      location: unitData.location || '',
      status: unitData.status || 'active',
      sort_order: Number(unitData.sort_order || 0)
    };
    const created = await Unit.create(newUnit);
    return stripMongo(created.toObject());
  },

  async updateUnit(id, updates) {
    const updated = await Unit.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();
    return stripMongo(updated);
  },

  async getUserUnits(userId) {
    const records = await UserUnit.find({ user_id: userId }).lean();
    return records.map(r => r.unit_id);
  },

  async setUserUnits(userId, unitIds) {
    await UserUnit.deleteMany({ user_id: userId });
    if (Array.isArray(unitIds) && unitIds.length > 0) {
      const docs = unitIds.map(uid => ({
        id: uuidv4(),
        user_id: userId,
        unit_id: uid
      }));
      await UserUnit.insertMany(docs);
    }
    return unitIds;
  },

  async getCategories() {
    const docs = await Category.find({}).lean();
    const list = stripMongo(docs);
    return list.filter(c => c.name !== 'Media Equipment' && c.id !== '22222222-2222-2222-2222-222222222205');
  },

  async createCategory(catData) {
    await ensureConnected();
    const newCat = {
      id: catData.id || uuidv4(),
      name: catData.name,
      parent_id: catData.parent_id || null,
      requires_serial: !!catData.requires_serial,
      description: catData.description || ''
    };
    const created = await Category.create(newCat);
    return stripMongo(created.toObject());
  },

  async updateCategory(id, updateData) {
    await ensureConnected();
    const cat = await Category.findOne({ id }).lean();
    if (!cat) {
      const err = new Error('Category not found.');
      err.status = 404;
      throw err;
    }

    const rawName = updateData.name !== undefined ? String(updateData.name || '').trim() : cat.name;
    if (!rawName) {
      const err = new Error('Category name is required.');
      err.status = 400;
      throw err;
    }
    if (rawName.length < 2) {
      const err = new Error('Category name must be at least 2 characters.');
      err.status = 400;
      throw err;
    }
    if (rawName.length > 60) {
      const err = new Error('Category name cannot exceed 60 characters.');
      err.status = 400;
      throw err;
    }
    if (/<[^>]*>/i.test(rawName)) {
      const err = new Error('HTML tags are not allowed in category name.');
      err.status = 400;
      throw err;
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-/&().]+$/;
    if (!validCharsRegex.test(rawName)) {
      const err = new Error('Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.');
      err.status = 400;
      throw err;
    }

    // Duplicate check excluding self
    const duplicate = await Category.findOne({
      id: { $ne: id },
      name: new RegExp(`^${escapeRegex(rawName)}$`, 'i')
    }).lean();
    if (duplicate) {
      const err = new Error('A category with this name already exists.');
      err.status = 409;
      throw err;
    }

    const updateFields = {
      name: rawName
    };
    if (updateData.description !== undefined) {
      updateFields.description = String(updateData.description || '').trim();
    }
    if (updateData.requires_serial !== undefined) {
      updateFields.requires_serial = !!updateData.requires_serial;
    }

    const oldName = cat.name;
    const updated = await Category.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { returnDocument: 'after' }
    ).lean();

    if (oldName !== rawName) {
      // Propagate name to inventory items, transactions, and item types
      await Promise.all([
        InventoryItem.updateMany(
          { $or: [{ category: oldName }, { category_id: id }] },
          { $set: { category: rawName } }
        ),
        ReceivedTransaction.updateMany(
          { $or: [{ category: oldName }, { category_id: id }] },
          { $set: { category: rawName } }
        ),
        ExpendedTransaction.updateMany(
          { $or: [{ category: oldName }, { category_id: id }] },
          { $set: { category: rawName } }
        ),
        ItemType.updateMany(
          { $or: [{ category: oldName }, { category_id: id }] },
          { $set: { category: rawName } }
        )
      ]);
    }

    return stripMongo(updated);
  },

  async deleteCategory(id, { userRole } = {}) {
    await ensureConnected();
    const cat = await Category.findOne({ $or: [{ id }, { name: new RegExp(`^${escapeRegex(id)}$`, 'i') }] }).lean();
    if (!cat) {
      const err = new Error('Category not found.');
      err.status = 404;
      throw err;
    }

    const catSlug = String(cat.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const isBuiltin = BUILTIN_CATEGORIES.some(b => b.id === cat.id || b.slug === catSlug || b.name.toLowerCase() === cat.name.toLowerCase());

    // 1. Count subcategories
    const inactiveOverrides = await ItemType.find({
      is_active: false,
      $or: [
        { category: new RegExp(`^${escapeRegex(cat.name)}$`, 'i') },
        { category: new RegExp(`^${escapeRegex(catSlug)}$`, 'i') },
        { category_slug: catSlug }
      ]
    }).lean();
    const inactiveSlugs = new Set(inactiveOverrides.map(o => o.slug));

    // Active built-ins
    const activeBuiltinSubcats = BUILTIN_SUBCATEGORIES.filter(
      b => (b.category === catSlug || b.categoryName.toLowerCase() === cat.name.toLowerCase()) && !inactiveSlugs.has(b.slug)
    );

    // Custom subcategories in DB
    const customSubCount = await ItemType.countDocuments({
      is_active: { $ne: false },
      is_builtin: { $ne: true },
      $or: [
        { category: new RegExp(`^${escapeRegex(cat.name)}$`, 'i') },
        { category: new RegExp(`^${escapeRegex(catSlug)}$`, 'i') },
        { category_slug: catSlug },
        ...(cat.id ? [{ category_id: cat.id }] : [])
      ]
    });

    const subcategoriesCount = activeBuiltinSubcats.length + customSubCount;

    // 2. Count inventory items
    const itemsCount = await InventoryItem.countDocuments({
      $or: [
        { category: new RegExp(`^${escapeRegex(cat.name)}$`, 'i') },
        { category: new RegExp(`^${escapeRegex(catSlug)}$`, 'i') },
        ...(cat.id ? [{ category_id: cat.id }] : [])
      ]
    });

    if (subcategoriesCount > 0 || itemsCount > 0) {
      const subMsg = `${subcategoriesCount} sub-categor${subcategoriesCount === 1 ? 'y' : 'ies'}`;
      const itemMsg = `${itemsCount} item${itemsCount === 1 ? '' : 's'}`;
      const err = new Error(
        `${cat.name} has ${subMsg} and ${itemMsg}. Remove or move them first.`
      );
      err.status = 400;
      err.blockingSubcategoriesCount = subcategoriesCount;
      err.blockingItemsCount = itemsCount;
      throw err;
    }

    if (isBuiltin && userRole && userRole !== 'super_admin') {
      const err = new Error('Only Super Admin can delete built-in categories.');
      err.status = 403;
      throw err;
    }

    await Category.deleteOne({ id: cat.id });
    return stripMongo(cat);
  },

  // --- Item Types (Sub-categories) ---
  async getItemTypes(categoryIdentifier = null) {
    await ensureConnected();
    let query = { is_active: { $ne: false } };
    if (categoryIdentifier) {
      const cleanIdent = String(categoryIdentifier).toLowerCase().trim();
      const slugIdent = cleanIdent.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const partsRegex = slugIdent.split('-').filter(Boolean).map(escapeRegex).join('[^a-z0-9]+');

      query.$or = [
        { category: new RegExp(`^${escapeRegex(cleanIdent)}$`, 'i') },
        { category: new RegExp(`^${escapeRegex(slugIdent)}$`, 'i') },
        { category: new RegExp(`^${partsRegex}$`, 'i') },
        { category_id: categoryIdentifier }
      ];
    }
    const docs = await ItemType.find(query).sort({ created_at: 1 }).lean();
    return stripMongo(docs);
  },

  async createItemType(typeData) {
    await ensureConnected();
    const rawName = String(typeData.name || '').trim();
    const rawCategory = String(typeData.category || '').trim();
    if (!rawName) {
      throw new Error('Type name is required.');
    }
    if (rawName.length < 2) {
      throw new Error('Type name must be at least 2 characters.');
    }
    if (rawName.length > 60) {
      throw new Error('Type name cannot exceed 60 characters.');
    }
    if (/<[^>]*>/i.test(rawName)) {
      throw new Error('HTML tags are not allowed in type name.');
    }
    if (!rawCategory) {
      throw new Error('Category is required.');
    }

    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const cleanCategory = rawCategory.toLowerCase().trim();
    const slugCategory = cleanCategory.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const categoryPartsRegex = slugCategory.split('-').filter(Boolean).map(escapeRegex).join('[^a-z0-9]+');

    // Check duplicate within same category (case-insensitive name or matching slug)
    const existing = await ItemType.findOne({
      $and: [
        {
          $or: [
            { category: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') },
            { category: new RegExp(`^${escapeRegex(slugCategory)}$`, 'i') },
            { category: new RegExp(`^${categoryPartsRegex}$`, 'i') },
            ...(typeData.category_id ? [{ category_id: typeData.category_id }] : [])
          ]
        },
        {
          $or: [
            { name: new RegExp(`^${escapeRegex(rawName)}$`, 'i') },
            { slug: slug }
          ]
        }
      ]
    }).lean();

    if (existing) {
      throw new Error(`This type already exists in ${rawCategory}`);
    }

    // Generate unique serial number codes
    const { generateUniqueTypeCodes } = require('../utils/serialNumberGenerator');
    const existingCategoryTypes = await ItemType.find({
      $or: [
        { category: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') },
        { category: new RegExp(`^${escapeRegex(slugCategory)}$`, 'i') },
        ...(typeData.category_id ? [{ category_id: typeData.category_id }] : [])
      ]
    }).lean();

    const generatedCodes = generateUniqueTypeCodes({
      typeName: rawName,
      category: rawCategory,
      existingTypes: existingCategoryTypes
    });

    const subCatCode = typeData.sub_category_code || typeData.code || generatedCodes.sub_category_code;
    const itemTypeCode = typeData.item_type_code || generatedCodes.item_type_code;

    const newType = {
      id: typeData.id || uuidv4(),
      name: rawName,
      slug: slug,
      category: rawCategory,
      category_id: typeData.category_id || null,
      sub_category_code: subCatCode,
      item_type_code: itemTypeCode,
      code: subCatCode,
      description: String(typeData.description || '').trim(),
      created_by: typeData.created_by || null
    };

    const created = await ItemType.create(newType);
    return stripMongo(created.toObject());
  },

  async updateItemType(id, updateData) {
    await ensureConnected();
    let doc = await ItemType.findOne({ $or: [{ id }, { slug: id }] }).lean();
    let builtinMatch = null;
    if (!doc) {
      builtinMatch = BUILTIN_SUBCATEGORIES.find(
        b => b.slug === id || b.slug.toLowerCase() === String(id).toLowerCase() || b.name.toLowerCase() === String(id).toLowerCase()
      );
      if (builtinMatch) {
        const created = await ItemType.create({
          id: uuidv4(),
          name: builtinMatch.name,
          slug: builtinMatch.slug,
          category: builtinMatch.categoryName,
          category_slug: builtinMatch.category,
          sub_category_code: builtinMatch.code,
          code: builtinMatch.code,
          is_builtin: true,
          is_active: true
        });
        doc = stripMongo(created.toObject());
      }
    }

    if (!doc) {
      const err = new Error('Item type not found.');
      err.status = 404;
      throw err;
    }

    const rawName = updateData.name !== undefined ? String(updateData.name || '').trim() : doc.name;
    if (!rawName) {
      throw new Error('Type name is required.');
    }
    if (rawName.length < 2) {
      throw new Error('Type name must be at least 2 characters.');
    }
    if (rawName.length > 60) {
      throw new Error('Type name cannot exceed 60 characters.');
    }
    if (/<[^>]*>/i.test(rawName)) {
      throw new Error('HTML tags are not allowed in type name.');
    }

    const cleanCategory = String(doc.category || '').toLowerCase().trim();
    const slugCategory = cleanCategory.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newSlug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Duplicate check excluding self
    const duplicate = await ItemType.findOne({
      id: { $ne: doc.id },
      $and: [
        {
          $or: [
            { category: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') },
            { category: new RegExp(`^${escapeRegex(slugCategory)}$`, 'i') },
            ...(doc.category_id ? [{ category_id: doc.category_id }] : [])
          ]
        },
        {
          $or: [
            { name: new RegExp(`^${escapeRegex(rawName)}$`, 'i') },
            { slug: newSlug }
          ]
        }
      ]
    }).lean();

    if (duplicate) {
      throw new Error(`This type already exists in ${doc.category}`);
    }

    // Check if inventory items exist under this type
    const itemQuery = {
      $and: [
        {
          $or: [
            { category: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') },
            { category: new RegExp(`^${escapeRegex(slugCategory)}$`, 'i') },
            ...(doc.category_id ? [{ category_id: doc.category_id }] : [])
          ]
        },
        {
          $or: [
            { sub_type: new RegExp(`^${escapeRegex(doc.name)}$`, 'i') },
            { sub_type: doc.slug },
            { sub_type: doc.sub_category_code || doc.code },
            { sub_classification: new RegExp(`^${escapeRegex(doc.name)}$`, 'i') },
            { sub_classification: doc.slug }
          ]
        }
      ]
    };
    const itemsCount = await InventoryItem.countDocuments(itemQuery);

    const updateFields = {
      name: rawName,
      slug: newSlug
    };

    if (updateData.description !== undefined) {
      updateFields.description = String(updateData.description || '').trim();
    }

    // If no items exist yet and codes are explicitly provided or can be re-derived
    if (itemsCount === 0 && (updateData.sub_category_code || updateData.item_type_code)) {
      if (updateData.sub_category_code) {
        updateFields.sub_category_code = String(updateData.sub_category_code).trim().toUpperCase();
        updateFields.code = updateFields.sub_category_code;
      }
      if (updateData.item_type_code) {
        updateFields.item_type_code = String(updateData.item_type_code).trim().toUpperCase();
      }
    }

    const oldName = doc.name;
    const updated = await ItemType.findOneAndUpdate(
      { id: doc.id },
      { $set: updateFields },
      { returnDocument: 'after' }
    ).lean();

    if (oldName !== rawName) {
      await Promise.all([
        InventoryItem.updateMany(
          { sub_type: oldName },
          { $set: { sub_type: rawName } }
        ),
        ReceivedTransaction.updateMany(
          { sub_type: oldName },
          { $set: { sub_type: rawName } }
        ),
        ExpendedTransaction.updateMany(
          { sub_type: oldName },
          { $set: { sub_type: rawName } }
        )
      ]);
    }

    return stripMongo(updated);
  },

  async deleteItemType(id, { userRole } = {}) {
    await ensureConnected();
    let doc = await ItemType.findOne({ $or: [{ id }, { slug: id }] }).lean();
    let builtinMatch = null;
    if (!doc) {
      builtinMatch = BUILTIN_SUBCATEGORIES.find(
        b => b.slug === id || b.slug.toLowerCase() === String(id).toLowerCase() || b.name.toLowerCase() === String(id).toLowerCase()
      );
    }

    if (!doc && !builtinMatch) {
      const err = new Error('Item type not found.');
      err.status = 404;
      throw err;
    }

    const typeName = doc ? doc.name : builtinMatch.name;
    const typeSlug = doc ? doc.slug : builtinMatch.slug;
    const typeCode = doc ? (doc.sub_category_code || doc.code) : builtinMatch.code;
    const isBuiltin = doc ? (!!doc.is_builtin || BUILTIN_SUBCATEGORIES.some(b => b.slug === doc.slug)) : true;

    const cleanCategory = String((doc ? doc.category : builtinMatch.categoryName) || '').toLowerCase().trim();
    const slugCategory = cleanCategory.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Check if any inventory items still belong to this type
    const query = {
      $and: [
        {
          $or: [
            { category: new RegExp(`^${escapeRegex(cleanCategory)}$`, 'i') },
            { category: new RegExp(`^${escapeRegex(slugCategory)}$`, 'i') },
            ...(doc?.category_id ? [{ category_id: doc.category_id }] : [])
          ]
        },
        {
          $or: [
            { sub_type: new RegExp(`^${escapeRegex(typeName)}$`, 'i') },
            { sub_type: typeSlug },
            ...(typeCode ? [{ sub_type: typeCode }] : []),
            { sub_classification: new RegExp(`^${escapeRegex(typeName)}$`, 'i') },
            { sub_classification: typeSlug }
          ]
        }
      ]
    };

    const blockingItemCount = await InventoryItem.countDocuments(query);
    if (blockingItemCount > 0) {
      const err = new Error(`Cannot delete item type '${typeName}': ${blockingItemCount} inventory item(s) are still associated with it.`);
      err.status = 400;
      err.blockingItemCount = blockingItemCount;
      throw err;
    }

    if (isBuiltin && userRole && userRole !== 'super_admin') {
      const err = new Error('Only Super Admin can delete built-in sub-categories.');
      err.status = 403;
      throw err;
    }

    if (isBuiltin) {
      if (doc) {
        await ItemType.updateOne({ id: doc.id }, { $set: { is_active: false } });
      } else {
        await ItemType.create({
          id: uuidv4(),
          name: builtinMatch.name,
          slug: builtinMatch.slug,
          category: builtinMatch.categoryName,
          category_slug: builtinMatch.category,
          sub_category_code: builtinMatch.code,
          code: builtinMatch.code,
          is_builtin: true,
          is_active: false
        });
      }
      return doc || builtinMatch;
    }

    await ItemType.deleteOne({ id: doc.id });
    return stripMongo(doc);
  },

  // --- Subcategory Item Types (e.g. Bench under Chairs) ---
  async getCustomItemTypes({ subcategory = null, category = null } = {}) {
    await ensureConnected();
    const query = { is_active: { $ne: false } };
    if (subcategory) {
      query.subcategory_slug = String(subcategory).toLowerCase().trim();
    }
    if (category) {
      query.category_slug = String(category).toLowerCase().trim();
    }
    if (!subcategory && !category) {
      query.subcategory_slug = { $exists: true, $ne: null };
    }
    const docs = await ItemType.find(query).sort({ name: 1 }).lean();
    return stripMongo(docs);
  },

  async createCustomItemType({ subcategory_slug, name, category_slug = null, user_id = null }) {
    await ensureConnected();
    const rawName = String(name || '').trim();
    const subcat = String(subcategory_slug || '').toLowerCase().trim();

    if (!subcat) {
      const err = new Error('Sub-category is required.');
      err.status = 400;
      throw err;
    }
    if (!rawName) {
      const err = new Error('Type name is required.');
      err.status = 400;
      throw err;
    }
    if (rawName.length < 2) {
      const err = new Error('Type name must be at least 2 characters.');
      err.status = 400;
      throw err;
    }
    if (rawName.length > 60) {
      const err = new Error('Type name cannot exceed 60 characters.');
      err.status = 400;
      throw err;
    }
    if (!/^[a-zA-Z0-9\s\-\/&().]+$/.test(rawName)) {
      const err = new Error('Type name may only contain letters, numbers, spaces, and - / & ( ) . characters.');
      err.status = 400;
      throw err;
    }
    if (/<[^>]*>/i.test(rawName)) {
      const err = new Error('HTML tags are not allowed in type name.');
      err.status = 400;
      throw err;
    }

    const norm = rawName.toLowerCase().replace(/\s+/g, ' ');

    // 1. Check duplicate against built-in options
    const { BUILTIN_ITEM_TYPES } = require('../constants/builtinItemTypes');
    const builtInOptions = BUILTIN_ITEM_TYPES[subcat] || [];
    const isBuiltinDuplicate = builtInOptions.some(
      opt => opt.toLowerCase().trim().replace(/\s+/g, ' ') === norm
    );
    if (isBuiltinDuplicate) {
      const err = new Error('This type already exists.');
      err.status = 409;
      err.duplicateType = 'builtin';
      throw err;
    }

    // 2. Check duplicate against existing custom types in DB
    const existing = await ItemType.findOne({
      subcategory_slug: subcat,
      name_normalized: norm,
      is_active: { $ne: false }
    }).lean();
    if (existing) {
      const err = new Error('This type already exists.');
      err.status = 409;
      err.duplicateType = 'custom';
      err.existing = stripMongo(existing);
      throw err;
    }

    // 3. Resolve subcat code and generate unique type code
    const {
      resolveSubCategoryCode,
      generateItemTypeCodeCandidate,
      registerCustomItemTypeCode
    } = require('../utils/serialNumberGenerator');

    const subCatCode = resolveSubCategoryCode(subcat);

    // Collect all existing codes for this subcategory
    const allForSubcat = await ItemType.find({ subcategory_slug: subcat }).lean();
    const existingCodes = allForSubcat.map(t => t.code).filter(Boolean);

    const uniqueCode = generateItemTypeCodeCandidate(rawName, existingCodes);
    const itemTypeCode = `${uniqueCode}-${subCatCode}`;

    const newDoc = {
      id: uuidv4(),
      subcategory_slug: subcat,
      category_slug: category_slug ? String(category_slug).toLowerCase().trim() : null,
      name: rawName,
      name_normalized: norm,
      code: uniqueCode,
      item_type_code: itemTypeCode,
      created_by: user_id,
      unit_id: null, // system-wide by default
      is_active: true
    };

    const created = await ItemType.create(newDoc);
    registerCustomItemTypeCode(rawName, uniqueCode, subCatCode);

    return stripMongo(created.toObject());
  },

  async updateCustomItemType(id, { name }) {
    await ensureConnected();
    const rawName = String(name || '').trim();
    if (!rawName) {
      const err = new Error('Type name is required.');
      err.status = 400;
      throw err;
    }
    if (rawName.length < 2) {
      const err = new Error('Type name must be at least 2 characters.');
      err.status = 400;
      throw err;
    }
    if (rawName.length > 60) {
      const err = new Error('Type name cannot exceed 60 characters.');
      err.status = 400;
      throw err;
    }
    if (!/^[a-zA-Z0-9\s\-\/&().]+$/.test(rawName)) {
      const err = new Error('Type name may only contain letters, numbers, spaces, and - / & ( ) . characters.');
      err.status = 400;
      throw err;
    }
    if (/<[^>]*>/i.test(rawName)) {
      const err = new Error('HTML tags are not allowed in type name.');
      err.status = 400;
      throw err;
    }

    const doc = await ItemType.findOne({ id }).lean();
    if (!doc) {
      const err = new Error('Item type not found.');
      err.status = 404;
      throw err;
    }

    const norm = rawName.toLowerCase().replace(/\s+/g, ' ');

    // Check duplicate against built-in
    const { BUILTIN_ITEM_TYPES } = require('../constants/builtinItemTypes');
    const builtInOptions = BUILTIN_ITEM_TYPES[doc.subcategory_slug] || [];
    if (builtInOptions.some(opt => opt.toLowerCase().trim().replace(/\s+/g, ' ') === norm)) {
      const err = new Error('This type already exists.');
      err.status = 409;
      throw err;
    }

    // Check duplicate against other custom types
    const duplicate = await ItemType.findOne({
      id: { $ne: id },
      subcategory_slug: doc.subcategory_slug,
      name_normalized: norm,
      is_active: { $ne: false }
    }).lean();
    if (duplicate) {
      const err = new Error('This type already exists.');
      err.status = 409;
      throw err;
    }

    // Update name and name_normalized only (code remains unchanged)
    const updated = await ItemType.findOneAndUpdate(
      { id },
      { $set: { name: rawName, name_normalized: norm, updated_at: new Date() } },
      { new: true }
    ).lean();

    return stripMongo(updated);
  },

  async deleteCustomItemType(id) {
    await ensureConnected();
    const doc = await ItemType.findOne({ id }).lean();
    if (!doc) {
      const err = new Error('Item type not found.');
      err.status = 404;
      throw err;
    }

    // Check if any inventory item uses this type
    const query = {
      $or: [
        { item_name: new RegExp(`^${escapeRegex(doc.name)}$`, 'i') },
        { sub_classification: new RegExp(`^${escapeRegex(doc.name)}$`, 'i') },
        ...(doc.code ? [{ item_code: new RegExp(`/${escapeRegex(doc.code)}-`, 'i') }] : [])
      ]
    };

    const count = await InventoryItem.countDocuments(query);
    if (count > 0) {
      const err = new Error(`Cannot delete item type '${doc.name}' because it is being used by ${count} inventory item(s).`);
      err.status = 400;
      err.blockingItemCount = count;
      throw err;
    }

    await ItemType.deleteOne({ id });
    return stripMongo(doc);
  },

  // --- Inventory Items ---
  async getInventoryItems(unitIds = null, category = null, search = '', categoryId = null, subType = null) {
    let items = await InventoryItem.find({}).lean();
    const [allUnits, allCategories] = await Promise.all([
      Unit.find({}).lean(),
      Category.find({}).lean()
    ]);
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));

    if (unitIds && unitIds.length > 0) {
      items = items.filter(i => unitIds.includes(i.unit_id));
    }

    if (category) {
      const catLower = category.toLowerCase().trim();
      items = items.filter(i => {
        if (!i.category) return false;
        const itemCatLower = i.category.toLowerCase().trim();
        const itemCatSlug = itemCatLower.replace(/[^a-z0-9]+/g, '-');
        return (
          itemCatLower === catLower ||
          itemCatSlug === catLower ||
          i.category_id === category
        );
      });
    }

    if (categoryId) {
      items = items.filter(i => {
        if (i.category_id === categoryId) return true;
        const matchedCat = allCategories.find(c => c.id === categoryId);
        if (matchedCat && i.category && i.category.toLowerCase().trim() === matchedCat.name.toLowerCase().trim()) return true;
        return false;
      });
    }

    if (subType) {
      const stLower = subType.toLowerCase().trim();
      items = items.filter(i => {
        if (i.sub_type) {
          const itemSt = i.sub_type.toLowerCase().trim();
          if (itemSt === stLower || itemSt.replace(/[^a-z0-9]+/g, '-') === stLower) return true;
        }
        const name = (i.item_name || '').toLowerCase();
        const code = (i.item_code || '').toLowerCase();
        if (stLower === 'chairs') {
          return name.includes('chair') || code.startsWith('chr-') || code.includes('-chr') ||
            name.includes('computer executive') || name.includes('computer typist') || name.includes('computer assistant');
        }
        if (stLower === 'tables') return name.includes('table') || name.includes('desk') || code.startsWith('tbl-') || code.includes('-tbl');
        if (stLower === 'cupboards-cabinets' || stLower === 'cupboards & cabinets') {
          return name.includes('cabinet') || name.includes('cupboard') || code.startsWith('cab-') || code.includes('-cab');
        }
        if (stLower === 'shelving-racking' || stLower === 'shelving & racking') {
          return name.includes('shelv') || name.includes('rack') || code.startsWith('shl-') || code.includes('-shl');
        }
        if (stLower === 'workstations') return name.includes('workstation') || code.startsWith('wst-') || code.includes('-wst');
        if (stLower === 'cctv-recording-display') return code.startsWith('cctv-') || code.includes('-cctv');
        if (stLower === 'audio-equipment') return code.startsWith('aud-') || code.includes('-aud');
        if (stLower === 'display-presentation') return code.startsWith('dsp-') || code.includes('-dsp');
        if (stLower === 'hand-tools') return code.startsWith('htl-') || code.includes('-htl');
        if (stLower === 'electrical-tools-testing-equipment') return code.startsWith('ete-') || code.includes('-ete');
        if (stLower === 'tool-storage-handling') return code.startsWith('tsh-') || code.includes('-tsh');
        if (stLower === 'safety-equipment-ppe') return code.startsWith('ppe-') || code.includes('-ppe');
        if (stLower === 'power-utility-equipment') return code.startsWith('pue-') || code.includes('-pue');
        if (stLower === 'air-conditioning-ventilation') return code.startsWith('acv-') || code.includes('-acv');
        if (stLower === 'cleaning-equipment') return code.startsWith('cln-') || code.includes('-cln');
        if (stLower === 'kitchen-refreshment-equipment') return code.startsWith('ktc-') || code.includes('-ktc');
        if (stLower === 'office-general-equipment' || stLower === 'office & general equipment') return code.startsWith('oge-') || code.includes('-oge') || code.includes('/oge/');
        if (stLower === 'computers-peripherals' || stLower === 'computers & peripherals') return code.startsWith('cmp-') || code.includes('-cmp') || code.includes('/cmp/');
        if (stLower === 'printers-printing-equipment' || stLower === 'printers & printing equipment') return code.startsWith('prn-') || code.includes('-prn') || code.includes('/prn/');
        if (stLower === 'network-equipment') return code.startsWith('net-') || code.includes('-net') || code.includes('/net/');
        return false;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.item_name.toLowerCase().includes(q) ||
        i.item_code.toLowerCase().includes(q) ||
        (i.batch_label && i.batch_label.toLowerCase().includes(q)) ||
        (Array.isArray(i.serial_numbers) && i.serial_numbers.some(s => s.toLowerCase().includes(q))) ||
        (i.serial_number && i.serial_number.toLowerCase().includes(q)) ||
        (Array.isArray(i.manufacturer_serial_numbers) && i.manufacturer_serial_numbers.some(s => s && s.toLowerCase().includes(q))) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }

    return items.map(item => {
      const unit = unitsMap.get(item.unit_id);
      const serialInfo = resolveItemSerials(item);
      const cleanItem = stripMongo(item);
      return {
        ...cleanItem,
        unit_name: unit ? unit.unit_name : 'Unknown',
        ...serialInfo
      };
    });
  },

  async getInventoryItemById(id) {
    const item = await InventoryItem.findOne({ id }).lean();
    if (!item) return null;
    const unit = await Unit.findOne({ id: item.unit_id }).lean();
    const serialInfo = resolveItemSerials(item);
    const cleanItem = stripMongo(item);
    return {
      ...cleanItem,
      unit_name: unit ? unit.unit_name : 'Unknown',
      ...serialInfo
    };
  },

  async createInventoryItem(data) {
    const qty = Number(data.quantity || 1);
    const baseItem = {
      ...data,
      quantity: qty
    };
    const serialInfo = resolveItemSerials(baseItem);

    const newItem = {
      id: data.id || uuidv4(),
      item_name: data.item_name,
      item_code: data.item_code,
      category: data.category,
      category_id: data.category_id || null,
      unit_id: data.unit_id,
      quantity: qty,
      serial_number: serialInfo.serial_number,
      manufacturer_serial_numbers: serialInfo.manufacturer_serial_numbers,
      status: data.status || 'In Stock',
      sub_type: data.sub_type || null,
      sub_classification: data.sub_classification || null,
      description: data.description || null,
      brand: data.brand || null,
      serial_numbers: serialInfo.serial_numbers,
      is_batch: serialInfo.is_batch,
      batch_label: serialInfo.batch_label
    };

    // Track serial sequences in SerialCounter so sequences never reuse deleted numbers
    const codesToTrack = [];
    if (newItem.item_code) codesToTrack.push(newItem.item_code);
    if (Array.isArray(newItem.serial_numbers)) {
      newItem.serial_numbers.forEach(s => {
        if (s) codesToTrack.push(s);
      });
    }

    for (const code of codesToTrack) {
      if (typeof code === 'string' && code.startsWith('DGM(WPSII)/CE(COM)/')) {
        const match = code.match(/^(.*-)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const seq = parseInt(match[2], 10);
          if (!isNaN(seq)) {
            await SerialCounter.findOneAndUpdate(
              { prefix },
              { $max: { last_sequence: seq } },
              { upsert: true }
            );
          }
        }
      }
    }

    const created = await InventoryItem.create(newItem);
    return stripMongo(created.toObject());
  },

  async getNextSerialNumber({ unit_id, category, category_name, sub_type, sub_category, item_type }) {
    const unit = (await Unit.findOne({ id: unit_id }).lean()) || { unit_name: unit_id, unit_code: unit_id };
    const {
      generateSerialNumber,
      deriveItemTypeCode,
      resolveCategoryCode,
      resolveSubCategoryCode,
      resolveUnitCode,
      CONSTANT_PREFIX
    } = require('../utils/serialNumberGenerator');

    const catInput = category || category_name;
    const subTypeInput = sub_type || sub_category;

    const unitCode = resolveUnitCode(unit);
    const catCode = resolveCategoryCode(catInput);
    const subCatCode = resolveSubCategoryCode(subTypeInput);

    const customTypeDoc = await ItemType.findOne({
      $or: [
        { name_normalized: String(item_type).toLowerCase().trim().replace(/\s+/g, ' ') },
        { name: new RegExp(`^${escapeRegex(String(item_type).trim())}$`, 'i') }
      ],
      is_active: { $ne: false }
    }).lean();
    if (customTypeDoc && customTypeDoc.code) {
      const { registerCustomItemTypeCode } = require('../utils/serialNumberGenerator');
      registerCustomItemTypeCode(customTypeDoc.name, customTypeDoc.code, subCatCode);
    }

    const itemTypeCode = deriveItemTypeCode(item_type, subCatCode);
    const basePrefix = `${CONSTANT_PREFIX}/${unitCode}/${catCode}/${subCatCode}/${itemTypeCode}-`;

    // Query highest sequence from SerialCounter
    const counterDoc = await SerialCounter.findOne({ prefix: basePrefix }).lean();
    let maxSeq = counterDoc ? (counterDoc.last_sequence || 0) : 0;

    // Also inspect existing inventory items in MongoDB matching basePrefix
    const escapedPrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await InventoryItem.find({
      $or: [
        { item_code: new RegExp(`^${escapedPrefix}`) },
        { serial_numbers: new RegExp(`^${escapedPrefix}`) }
      ]
    }).lean();

    existing.forEach(item => {
      const codes = [];
      if (item.item_code) codes.push(item.item_code);
      if (Array.isArray(item.serial_numbers)) codes.push(...item.serial_numbers);
      codes.forEach(c => {
        const m = (c || '').match(new RegExp(`^${escapedPrefix}(\\d+)$`));
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      });
    });

    const serverCounters = { [basePrefix]: maxSeq };

    return generateSerialNumber({
      unit,
      category: catInput,
      subCategory: subTypeInput,
      itemType: item_type,
      existingItems: [],
      serverCounters
    });
  },

  async getNextBatchSerialNumbers({ unit_id, category, category_name, sub_type, sub_category, item_type, quantity = 1 }) {
    const unit = (await Unit.findOne({ id: unit_id }).lean()) || { unit_name: unit_id, unit_code: unit_id };
    const {
      generateBatchSerialNumbers,
      deriveItemTypeCode,
      resolveCategoryCode,
      resolveSubCategoryCode,
      resolveUnitCode,
      CONSTANT_PREFIX
    } = require('../utils/serialNumberGenerator');

    const catInput = category || category_name;
    const subTypeInput = sub_type || sub_category;

    const unitCode = resolveUnitCode(unit);
    const catCode = resolveCategoryCode(catInput);
    const subCatCode = resolveSubCategoryCode(subTypeInput);

    const customTypeDoc = await ItemType.findOne({
      $or: [
        { name_normalized: String(item_type).toLowerCase().trim().replace(/\s+/g, ' ') },
        { name: new RegExp(`^${escapeRegex(String(item_type).trim())}$`, 'i') }
      ],
      is_active: { $ne: false }
    }).lean();
    if (customTypeDoc && customTypeDoc.code) {
      const { registerCustomItemTypeCode } = require('../utils/serialNumberGenerator');
      registerCustomItemTypeCode(customTypeDoc.name, customTypeDoc.code, subCatCode);
    }

    const itemTypeCode = deriveItemTypeCode(item_type, subCatCode);
    const basePrefix = `${CONSTANT_PREFIX}/${unitCode}/${catCode}/${subCatCode}/${itemTypeCode}-`;

    const counterDoc = await SerialCounter.findOne({ prefix: basePrefix }).lean();
    let maxSeq = counterDoc ? (counterDoc.last_sequence || 0) : 0;

    const escapedPrefix = basePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await InventoryItem.find({
      $or: [
        { item_code: new RegExp(`^${escapedPrefix}`) },
        { serial_numbers: new RegExp(`^${escapedPrefix}`) }
      ]
    }).lean();

    existing.forEach(item => {
      const codes = [];
      if (item.item_code) codes.push(item.item_code);
      if (Array.isArray(item.serial_numbers)) codes.push(...item.serial_numbers);
      codes.forEach(c => {
        const m = (c || '').match(new RegExp(`^${escapedPrefix}(\\d+)$`));
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      });
    });

    const serverCounters = { [basePrefix]: maxSeq };

    return generateBatchSerialNumbers({
      unit,
      category: catInput,
      subCategory: subTypeInput,
      itemType: item_type,
      quantity,
      existingItems: [],
      serverCounters
    });
  },

  async updateInventoryItem(id, updates) {
    const existing = await InventoryItem.findOne({ id }).lean();
    if (!existing) return null;

    const merged = {
      ...existing,
      ...updates,
      quantity: updates.quantity !== undefined ? Number(updates.quantity) : existing.quantity
    };
    const serialInfo = resolveItemSerials(merged);
    const finalItem = {
      ...merged,
      ...serialInfo
    };

    const updated = await InventoryItem.findOneAndUpdate(
      { id },
      { $set: finalItem },
      { returnDocument: 'after' }
    ).lean();

    return stripMongo(updated);
  },

  async deleteInventoryItem(id) {
    const res = await InventoryItem.deleteOne({ id });
    return res.deletedCount > 0;
  },

  // --- Transactions ---
  async getReceivedTransactions(unitIds = null, search = '') {
    let list = await ReceivedTransaction.find({}).lean();
    const allUnits = await Unit.find({}).lean();
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));

    if (unitIds && unitIds.length > 0) {
      list = list.filter(t => unitIds.includes(t.unit_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.item_name && t.item_name.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.voucher_no && t.voucher_no.toLowerCase().includes(q)) ||
        (t.from_whom && t.from_whom.toLowerCase().includes(q)) ||
        (t.serial_number && t.serial_number.toLowerCase().includes(q))
      );
    }
    return list.map(t => {
      const unit = unitsMap.get(t.unit_id) || {};
      const clean = stripMongo(t);
      return {
        ...clean,
        item_name: clean.item_name || 'Unknown Item',
        category: clean.category || '',
        unit_name: unit.unit_name || ''
      };
    });
  },

  async getReceivedTransactionById(id) {
    const found = await ReceivedTransaction.findOne({ id }).lean();
    return stripMongo(found);
  },

  async createReceivedTransaction(data) {
    const newTx = {
      id: data.id || uuidv4(),
      item_id: data.item_id || null,
      item_name: data.item_name,
      item_code: data.item_code || '',
      category: data.category || '',
      category_id: data.category_id || null,
      quantity: Number(data.quantity),
      date: (data.date !== undefined && data.date !== null) ? String(data.date).trim() : '',
      unit_id: data.unit_id,
      voucher_image_path: data.voucher_image_path || null,
      voucher_no: (data.voucher_no !== undefined && data.voucher_no !== null) ? String(data.voucher_no).trim() : '',
      serial_number: data.serial_number || null,
      from_whom: (data.from_whom !== undefined && data.from_whom !== null) ? String(data.from_whom).trim() : '',
      notes: data.notes || '',
      created_by: data.created_by || null
    };
    const created = await ReceivedTransaction.create(newTx);
    return stripMongo(created.toObject());
  },

  async updateReceivedTransaction(id, updates) {
    const updated = await ReceivedTransaction.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();
    return stripMongo(updated);
  },

  async deleteReceivedTransaction(id) {
    const res = await ReceivedTransaction.deleteOne({ id });
    return res.deletedCount > 0;
  },

  async getExpendedTransactions(unitIds = null, search = '') {
    let list = await ExpendedTransaction.find({}).lean();
    const [allUnits, allInventory, allReceived] = await Promise.all([
      Unit.find({}).lean(),
      InventoryItem.find({}).lean(),
      ReceivedTransaction.find({}).lean()
    ]);
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));

    if (unitIds && unitIds.length > 0) {
      list = list.filter(t => unitIds.includes(t.unit_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.item_name && t.item_name.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.item_code && t.item_code.toLowerCase().includes(q)) ||
        (t.voucher_no && t.voucher_no.toLowerCase().includes(q)) ||
        (t.disposition && t.disposition.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return list.map(t => {
      const unit = unitsMap.get(t.unit_id) || {};

      // Match item from inventory_items
      let item = null;
      if (t.item_id) {
        item = allInventory.find(i =>
          i.id === t.item_id ||
          (i.item_name && i.item_name.toLowerCase() === String(t.item_id).toLowerCase())
        );
      }
      if (!item && t.item_name && t.item_name !== 'Unknown Item') {
        item = allInventory.find(i =>
          i.item_name && i.item_name.toLowerCase() === t.item_name.toLowerCase()
        );
      }

      // Fallback: match item from received_transactions
      let rec = null;
      if (!item) {
        if (t.item_id) {
          rec = allReceived.find(r =>
            r.item_id === t.item_id ||
            (r.item_name && r.item_name.toLowerCase() === String(t.item_id).toLowerCase())
          );
        }
        if (!rec && t.item_name && t.item_name !== 'Unknown Item') {
          rec = allReceived.find(r =>
            r.item_name && r.item_name.toLowerCase() === t.item_name.toLowerCase()
          );
        }
      }

      let resolvedName = t.item_name;
      if (!resolvedName || resolvedName === 'Unknown Item') {
        if (item && item.item_name) {
          resolvedName = item.item_name;
        } else if (rec && rec.item_name) {
          resolvedName = rec.item_name;
        } else if (t.item_id && typeof t.item_id === 'string' && !t.item_id.match(/^[0-9a-f-]{36}$/i)) {
          resolvedName = t.item_id;
        } else {
          resolvedName = 'Unknown Item';
        }
      }

      const resolvedCode = t.item_code || item?.item_code || rec?.item_code || '';
      const resolvedCategory = t.category || item?.category || rec?.category || '';
      const resolvedItemId = t.item_id || item?.id || rec?.item_id || null;
      const clean = stripMongo(t);

      return {
        ...clean,
        item_id: resolvedItemId,
        item_name: resolvedName,
        item_code: resolvedCode,
        category: resolvedCategory,
        unit_name: unit.unit_name || ''
      };
    });
  },

  async createExpendedTransaction(data) {
    const newTx = {
      id: data.id || uuidv4(),
      item_id: data.item_id || null,
      item_name: data.item_name,
      item_code: data.item_code || '',
      category: data.category || '',
      quantity: Number(data.quantity),
      date: data.date || new Date().toISOString().split('T')[0],
      unit_id: data.unit_id,
      voucher_no: data.voucher_no,
      disposition: data.disposition || '',
      notes: data.notes || '',
      created_by: data.created_by || null
    };
    const created = await ExpendedTransaction.create(newTx);
    return stripMongo(created.toObject());
  },

  async updateExpendedTransaction(id, updates) {
    const updated = await ExpendedTransaction.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();
    return stripMongo(updated);
  },

  async deleteExpendedTransaction(id) {
    const res = await ExpendedTransaction.deleteOne({ id });
    return res.deletedCount > 0;
  },

  // --- Computed Remaining View ---
  getComputedRemaining,

  /**
   * Flat Current Inventory – built directly from inventory_items
   * Expands all serial numbers in batch/serialized items so every individual serial has its own row.
   * Format: No | Serial No. | Inventory Category | Item Description | Unit
   */
  async getFlatCurrentInventory(targetUnits = null, category = null, search = '') {
    await ensureConnected();

    let query = {};
    if (targetUnits && targetUnits.length > 0) {
      query.unit_id = { $in: targetUnits };
    }
    if (category && category !== 'all' && category !== 'All Categories') {
      const catLower = category.toLowerCase().trim();
      query.$or = [
        { category: new RegExp(`^${escapeRegex(catLower)}$`, 'i') },
        { category_id: category }
      ];
    }

    const [items, allUnits] = await Promise.all([
      InventoryItem.find(query).lean(),
      Unit.find({}).lean()
    ]);

    const unitsMap = new Map(allUnits.map(u => [u.id, u.unit_name || 'Unknown Unit']));

    const clean = (t) => (t || '').toString().toLowerCase().trim();
    const searchFilter = (item, serial) => {
      if (!search || !search.trim()) return true;
      const q = clean(search);
      return (
        clean(item.item_name).includes(q) ||
        clean(item.item_code).includes(q) ||
        clean(item.category).includes(q) ||
        clean(item.sub_type).includes(q) ||
        clean(item.sub_classification).includes(q) ||
        clean(item.description).includes(q) ||
        clean(item.brand).includes(q) ||
        clean(serial).includes(q) ||
        (Array.isArray(item.serial_numbers) && item.serial_numbers.some(s => clean(s).includes(q))) ||
        (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.some(m => clean(m).includes(q)))
      );
    };

    const flatRows = [];

    for (const item of items) {
      const unitName = unitsMap.get(item.unit_id) || 'Unknown Unit';
      const rawSerials = Array.isArray(item.serial_numbers) ? item.serial_numbers.filter(Boolean) : [];
      const qty = Number(item.quantity || 0);

      if (rawSerials.length > 0) {
        // Expand ALL serial numbers from the batch/serialized item
        rawSerials.forEach((sn, idx) => {
          if (!searchFilter(item, sn)) return;
          flatRows.push({
            id: `${item.id}_${idx}`,
            inventory_item_id: item.id,
            item_code: sn,
            serial_no: sn,
            serial_number: sn,
            inventory_category: item.category || 'General',
            category: item.category || 'General',
            sub_category: item.sub_type || '',
            sub_type: item.sub_type || '',
            item_description: item.item_name || '',
            item_name: item.item_name || '',
            unit_id: item.unit_id,
            unit_name: unitName,
            quantity: 1,
            stock_status: item.status || 'In Stock'
          });
        });
      } else if (qty > 1) {
        // Legacy items with quantity > 1 but empty serial_numbers array:
        // Try deriving serials if item_code ends with sequential digits
        const baseCode = (item.item_code || '').trim();
        const match = baseCode.match(/^(.*?)(\d+)$/);
        const canDerive = match && match[2].length <= 6 && parseInt(match[2], 10) < 1000000 && qty <= 100;

        if (canDerive) {
          const prefix = match[1];
          const numDigits = Math.max(3, match[2].length);
          const startNum = parseInt(match[2], 10);
          for (let i = 0; i < qty; i++) {
            const derivedSn = `${prefix}${String(startNum + i).padStart(numDigits, '0')}`;
            if (!searchFilter(item, derivedSn)) continue;
            flatRows.push({
              id: `${item.id}_${i}`,
              inventory_item_id: item.id,
              item_code: derivedSn,
              serial_no: derivedSn,
              serial_number: derivedSn,
              inventory_category: item.category || 'General',
              category: item.category || 'General',
              sub_category: item.sub_type || '',
              sub_type: item.sub_type || '',
              item_description: item.item_name || '',
              item_name: item.item_name || '',
              unit_id: item.unit_id,
              unit_name: unitName,
              quantity: 1,
              stock_status: item.status || 'In Stock'
            });
          }
        } else {
          // Cannot derive serials: show 1 row with quantity noted
          const serialNo = item.item_code || '—';
          if (searchFilter(item, serialNo)) {
            flatRows.push({
              id: item.id,
              inventory_item_id: item.id,
              item_code: serialNo,
              serial_no: serialNo,
              serial_number: serialNo,
              inventory_category: item.category || 'General',
              category: item.category || 'General',
              sub_category: item.sub_type || '',
              sub_type: item.sub_type || '',
              item_description: `${item.item_name || 'Item'} (Qty: ${qty})`,
              item_name: `${item.item_name || 'Item'} (Qty: ${qty})`,
              unit_id: item.unit_id,
              unit_name: unitName,
              quantity: qty,
              stock_status: item.status || 'In Stock'
            });
          }
        }
      } else {
        // Single item (qty <= 1 and rawSerials is empty)
        const serialNo = item.item_code || item.serial_number || '—';
        if (searchFilter(item, serialNo)) {
          flatRows.push({
            id: item.id,
            inventory_item_id: item.id,
            item_code: serialNo,
            serial_no: serialNo,
            serial_number: serialNo,
            inventory_category: item.category || 'General',
            category: item.category || 'General',
            sub_category: item.sub_type || '',
            sub_type: item.sub_type || '',
            item_description: item.item_name || '',
            item_name: item.item_name || '',
            unit_id: item.unit_id,
            unit_name: unitName,
            quantity: qty || 1,
            stock_status: item.status || 'In Stock'
          });
        }
      }
    }

    // Sort order: Category, then sub-category, then item name, then serial number (numeric sequence)
    flatRows.sort((a, b) => {
      const catCmp = (a.inventory_category || '').toLowerCase().localeCompare((b.inventory_category || '').toLowerCase());
      if (catCmp !== 0) return catCmp;

      const subCmp = (a.sub_category || '').toLowerCase().localeCompare((b.sub_category || '').toLowerCase());
      if (subCmp !== 0) return subCmp;

      const nameCmp = (a.item_description || '').toLowerCase().localeCompare((b.item_description || '').toLowerCase());
      if (nameCmp !== 0) return nameCmp;

      const serA = a.serial_no || a.serial_number || '';
      const serB = b.serial_no || b.serial_number || '';
      return serA.localeCompare(serB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return flatRows;
  },

  async getRemainingInventory(unitIds = null, category = null, search = '') {
    let list = await getComputedRemaining();
    if (unitIds && unitIds.length > 0) {
      list = list.filter(item => unitIds.includes(item.unit_id));
    }
    if (category) {
      list = list.filter(item => (item.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item =>
        item.item_name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return list;
  },

  async getInventoryItemsForVerification(unitId) {
    const items = await InventoryItem.find({ unit_id: unitId }).lean();
    const rows = [];

    for (const item of items) {
      const rawSerials = Array.isArray(item.serial_numbers) ? item.serial_numbers.filter(Boolean) : [];
      const hasMultipleSerials = rawSerials.length > 1;
      const isBatch = Boolean(item.is_batch) || hasMultipleSerials;

      // Resolve serials & manufacturer serials
      const serialInfo = resolveItemSerials(item);
      let serialsList = [];
      if (rawSerials.length > 0) {
        serialsList = rawSerials;
      } else if (Array.isArray(serialInfo.serial_numbers) && serialInfo.serial_numbers.length > 0) {
        serialsList = serialInfo.serial_numbers;
      } else if (item.item_code) {
        serialsList = [item.item_code];
      }

      let mfgList = [];
      if (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0) {
        mfgList = item.manufacturer_serial_numbers.map(s => (s ? String(s).trim() : ''));
      } else if (Array.isArray(serialInfo.manufacturer_serial_numbers) && serialInfo.manufacturer_serial_numbers.length > 0) {
        mfgList = serialInfo.manufacturer_serial_numbers.map(s => (s ? String(s).trim() : ''));
      } else if (item.serial_number) {
        mfgList = [String(item.serial_number).trim()];
      }

      // If item has quantity > 1 but NO individual serials:
      if (!isBatch && Number(item.quantity) > 1 && rawSerials.length === 0) {
        serialsList = item.item_code ? [item.item_code] : [];
      }

      const qty = Number(item.quantity) || (serialsList.length > 0 ? serialsList.length : 1);
      const primarySerial = (serialsList.length > 0 && serialsList[0]) || item.item_code || '';
      const primaryMfg = (mfgList.length > 0 && mfgList[0]) || item.serial_number || '';

      rows.push({
        id: item.id,
        inventory_item_id: item.id,
        item_id: item.id,
        item_code: primarySerial,
        serial_number: primarySerial,
        serial_numbers: serialsList,
        manufacturer_sn: primaryMfg,
        manufacturer_serial_numbers: mfgList,
        item_name: item.item_name || '',
        category: item.category || 'General',
        sub_type: item.sub_type || '',
        sub_classification: item.sub_classification || '',
        system_qty: qty,
        is_batch: isBatch
      });
    }

    // Sort stably: category, then sub_category, then item name, then serial number / item code
    rows.sort((a, b) => {
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);

      const subA = (a.sub_type || '').toLowerCase();
      const subB = (b.sub_type || '').toLowerCase();
      if (subA !== subB) return subA.localeCompare(subB);

      const nameA = (a.item_name || '').toLowerCase();
      const nameB = (b.item_name || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);

      return (a.item_code || '').localeCompare(b.item_code || '', undefined, { numeric: true, sensitivity: 'base' });
    });

    return rows;
  },

  // --- Verifications ---
  async getVerifications(unitIds = null, year = null) {
    let list = await Verification.find({ status: { $ne: 'draft' } }).lean();
    const [allUnits, allItems] = await Promise.all([
      Unit.find({}).lean(),
      VerificationItem.find({}).lean()
    ]);
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));

    if (unitIds && unitIds.length > 0) {
      list = list.filter(v => unitIds.includes(v.unit_id));
    }
    if (year && year !== 'all' && year !== 'All Years') {
      list = list.filter(v => Number(v.year) === Number(year));
    }

    return list.map(v => {
      const unit = unitsMap.get(v.unit_id) || {};
      const items = allItems.filter(vi => vi.verification_id === v.id).map(stripMongo);
      const clean = stripMongo(v);
      return {
        ...clean,
        unit_name: unit.unit_name || 'Unknown Unit',
        items_count: items.length,
        discrepancies_count: items.filter(i => Number(i.difference) !== 0).length,
        items
      };
    });
  },

  async getVerificationHistoryItems(unitIds = null, year = null, includeNotCounted = false) {
    let verifs = await Verification.find({ status: 'confirmed' })
      .sort({ date: -1, created_at: -1 })
      .lean();

    const [allUnits, allItems, allInventory] = await Promise.all([
      Unit.find({}).lean(),
      VerificationItem.find({}).lean(),
      InventoryItem.find({}).lean()
    ]);
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));
    const invMap = new Map(allInventory.map(i => [i.id, i]));

    if (unitIds && unitIds.length > 0) {
      verifs = verifs.filter(v => unitIds.includes(v.unit_id));
    }
    if (year && year !== 'all' && year !== 'All Years' && year !== 'All') {
      verifs = verifs.filter(v => Number(v.year) === Number(year));
    }

    const rows = [];
    for (const v of verifs) {
      const unit = unitsMap.get(v.unit_id) || {};
      let vItems = allItems.filter(vi => vi.verification_id === v.id);

      // Sort within verification in same order as New Verification: category, sub_type, item_name, serial
      vItems.sort((a, b) => {
        const invA = invMap.get(a.item_id) || {};
        const invB = invMap.get(b.item_id) || {};

        const catA = (a.category || invA.category || '').toLowerCase();
        const catB = (b.category || invB.category || '').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);

        const subA = (invA.sub_type || '').toLowerCase();
        const subB = (invB.sub_type || '').toLowerCase();
        if (subA !== subB) return subA.localeCompare(subB);

        const nameA = (a.item_name || '').toLowerCase();
        const nameB = (b.item_name || '').toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);

        const codeA = (a.item_code || (Array.isArray(a.serial_numbers) ? a.serial_numbers[0] : '') || '');
        const codeB = (b.item_code || (Array.isArray(b.serial_numbers) ? b.serial_numbers[0] : '') || '');
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const vNames = [v.verifier_1, v.verifier_2, v.verifier_3].filter(Boolean);
      const verifiersDisplay = vNames.length > 0
        ? vNames.join(', ')
        : (Array.isArray(v.verified_by) ? v.verified_by.join(', ') : (v.verified_by || ''));

      for (const item of vItems) {
        const sysQty = Number(item.system_qty || 0);
        const hasPhys = item.physical_qty !== null && item.physical_qty !== undefined && item.physical_qty !== '' && !isNaN(Number(item.physical_qty));
        const physQty = hasPhys ? Number(item.physical_qty) : null;
        const physAvail = physQty;
        const physNotAvail = hasPhys ? Math.max(0, sysQty - physQty) : null;

        const hasCondition = Boolean(
          item.condition &&
          item.condition !== '—' &&
          (item.condition !== 'Good' || hasPhys || (item.status && item.status !== 'Not Counted' && item.status !== 'Not counted'))
        );
        const rawDisp = item.issued_destroyed || item.disposition || '';
        const hasDisp = Boolean(
          rawDisp &&
          rawDisp !== '—' &&
          rawDisp !== 'N/A' &&
          String(rawDisp).trim() !== ''
        );
        const trimmedLabel = (item.label_no !== null && item.label_no !== undefined) ? String(item.label_no).trim() : '';
        const hasLabel = Boolean(trimmedLabel && trimmedLabel !== '—');
        const trimmedRemarks = (item.remarks || item.special_remarks || '').trim();
        const hasRemarks = Boolean(trimmedRemarks && trimmedRemarks !== '—');
        const isCountedStatus = item.status && item.status !== 'Not Counted' && item.status !== 'Not counted';

        const hasEnteredData = hasPhys || hasCondition || hasDisp || hasLabel || hasRemarks || isCountedStatus;

        // Skip untouched rows unless explicitly requested
        if (!hasEnteredData && !includeNotCounted) {
          continue;
        }

        const itemSerials = (Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0)
          ? item.serial_numbers
          : (item.item_code ? [item.item_code] : []);
        const itemMfgSerials = (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0)
          ? item.manufacturer_serial_numbers
          : (item.manufacturer_sn ? [item.manufacturer_sn] : []);

        const isCounted = hasEnteredData;
        const statusDisplay = !isCounted ? 'Not counted' : (item.status || (hasPhys ? (physQty === sysQty ? 'Matched' : (physQty < sysQty ? 'Shortage' : 'Excess')) : 'Counted'));

        rows.push({
          id: item.id,
          verification_id: v.id,
          year: v.year,
          unit_id: v.unit_id,
          unit_name: unit.unit_name || 'Unknown Unit',
          date: v.date,
          verified_by: verifiersDisplay,
          item_id: item.item_id || null,
          item_code: item.item_code || (itemSerials[0] || ''),
          serial_numbers: itemSerials,
          manufacturer_sn: item.manufacturer_sn || (itemMfgSerials[0] || ''),
          manufacturer_serial_numbers: itemMfgSerials,
          is_batch: Boolean(item.is_batch) || itemSerials.length > 1,
          item_name: item.item_name || '',
          category: item.category || '',
          in_inventory: item.in_inventory !== false,
          system_qty: sysQty,
          physical_available: physAvail,
          physical_not_available: physNotAvail,
          difference: hasPhys ? physQty - sysQty : 0,
          condition: (item.condition && item.condition !== '—') ? item.condition : (hasEnteredData ? 'Good' : '—'),
          disposition: hasDisp ? rawDisp : '—',
          issued_destroyed: hasDisp ? rawDisp : '—',
          issued_destroyed_id: item.issued_destroyed_id || null,
          issued_destroyed_qty: item.issued_destroyed_qty || null,
          remarks: hasRemarks ? trimmedRemarks : '—',
          label_no: hasLabel ? trimmedLabel : '—',
          is_counted: isCounted,
          status: statusDisplay
        });
      }
    }
    return rows;
  },

  async getVerificationById(id) {
    const v = await Verification.findOne({ id }).lean();
    if (!v) return null;
    const [unit, items, issuedDestroyed] = await Promise.all([
      Unit.findOne({ id: v.unit_id }).lean(),
      VerificationItem.find({ verification_id: id }).lean(),
      IssuedDestroyedItem.find({ verification_id: id }).lean()
    ]);

    const cleanItems = stripMongo(items).map(it => ({
      ...it,
      issued_destroyed: it.issued_destroyed || it.disposition || '',
      issued_destroyed_id: it.issued_destroyed_id || null,
      issued_destroyed_qty: it.issued_destroyed_qty || null,
      serial_numbers: (Array.isArray(it.serial_numbers) && it.serial_numbers.length > 0)
        ? it.serial_numbers
        : (it.item_code ? [it.item_code] : []),
      manufacturer_serial_numbers: (Array.isArray(it.manufacturer_serial_numbers) && it.manufacturer_serial_numbers.length > 0)
        ? it.manufacturer_serial_numbers
        : (it.manufacturer_sn ? [it.manufacturer_sn] : []),
      is_batch: Boolean(it.is_batch) || (Array.isArray(it.serial_numbers) && it.serial_numbers.length > 1)
    }));

    const clean = stripMongo(v);
    return {
      ...clean,
      unit_name: unit ? unit.unit_name : 'Unknown Unit',
      location: unit ? (unit.location || '') : '',
      items: cleanItems,
      issued_destroyed: stripMongo(issuedDestroyed)
    };
  },

  async createVerification(data) {
    const verifierList = [data.verifier_1, data.verifier_2, data.verifier_3].filter(Boolean);
    if (verifierList.length === 0 && data.verified_by) {
      if (Array.isArray(data.verified_by)) verifierList.push(...data.verified_by);
      else verifierList.push(data.verified_by);
    }

    const newVerif = {
      id: data.id || uuidv4(),
      unit_id: data.unit_id,
      date: data.date || new Date().toISOString().split('T')[0],
      year: Number(data.year),
      verifier_1: data.verifier_1 || verifierList[0] || '',
      verifier_2: data.verifier_2 || verifierList[1] || '',
      verifier_3: data.verifier_3 || verifierList[2] || '',
      verified_by: verifierList,
      status: data.status || 'confirmed',
      summary: data.summary || '',
      confirmed_by: data.confirmed_by || null,
      confirmed_at: data.confirmed_at || (data.status === 'confirmed' ? new Date().toISOString() : null)
    };

    let draft = null;
    if ((data.status || 'confirmed') === 'confirmed') {
      draft = await Verification.findOne({ unit_id: data.unit_id, status: 'draft' });
    }

    let created;
    if (draft) {
      draft.date = data.date || draft.date;
      draft.year = Number(data.year) || draft.year;
      draft.verifier_1 = data.verifier_1 || verifierList[0] || '';
      draft.verifier_2 = data.verifier_2 || verifierList[1] || '';
      draft.verifier_3 = data.verifier_3 || verifierList[2] || '';
      draft.verified_by = verifierList;
      draft.status = 'confirmed';
      draft.summary = data.summary || draft.summary;
      draft.confirmed_by = data.confirmed_by || null;
      draft.confirmed_at = data.confirmed_at || new Date().toISOString();
      await draft.save();
      created = draft;
      await VerificationItem.deleteMany({ verification_id: draft.id });
    } else {
      created = await Verification.create(newVerif);
    }

    // If initial items provided
    if (Array.isArray(data.items)) {
      const itemsToInsert = [];
      for (const item of data.items) {
        const sysQty = Number(item.system_qty || 0);
        const physQty = item.physical_qty !== null && item.physical_qty !== undefined && item.physical_qty !== ''
          ? Number(item.physical_qty)
          : null;
        const diff = physQty !== null ? physQty - sysQty : 0;

        let status = item.status;
        if (!status) {
          if (physQty === null) status = 'Not Counted';
          else if (diff === 0) status = 'Matched';
          else if (diff < 0) status = 'Shortage';
          else status = 'Excess';
        }

        const sList = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
          ? item.serial_numbers
          : (item.item_code ? [item.item_code] : []);
        const mList = Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0
          ? item.manufacturer_serial_numbers
          : (item.manufacturer_sn ? [item.manufacturer_sn] : []);

        itemsToInsert.push({
          id: (item.id && typeof item.id === 'string' && item.id.match(/^[0-9a-f-]{36}$/i)) ? item.id : uuidv4(),
          verification_id: created.id,
          item_id: item.item_id || item.inventory_item_id || null,
          item_code: item.item_code || (sList[0] || ''),
          serial_numbers: sList,
          manufacturer_sn: item.manufacturer_sn || (mList[0] || ''),
          manufacturer_serial_numbers: mList,
          is_batch: Boolean(item.is_batch) || sList.length > 1,
          item_name: item.item_name || '',
          category: item.category || '',
          system_qty: sysQty,
          physical_qty: physQty,
          difference: diff,
          condition: item.condition && item.condition !== '—' ? item.condition : 'Good',
          label_no: (item.label_no !== undefined && item.label_no !== null) ? String(item.label_no).trim() : '',
          remarks: item.remarks ? String(item.remarks).trim() : '',
          disposition: (item.issued_destroyed && item.issued_destroyed !== '—' && item.issued_destroyed !== 'N/A') ? item.issued_destroyed : (item.disposition || ''),
          issued_destroyed: (item.issued_destroyed && item.issued_destroyed !== '—') ? item.issued_destroyed : (item.disposition || ''),
          issued_destroyed_id: item.issued_destroyed_id || null,
          issued_destroyed_qty: (item.issued_destroyed === 'Issued' || item.issued_destroyed === 'Destroyed' || item.disposition === 'Issued' || item.disposition === 'Destroyed')
            ? (Number(item.issued_destroyed_qty) > 0 ? Math.min(Number(item.issued_destroyed_qty), sysQty) : 1)
            : null,
          in_inventory: item.in_inventory !== false,
          status
        });
      }
      if (itemsToInsert.length > 0) {
        await VerificationItem.insertMany(itemsToInsert);
      }
    }

    return stripMongo(created.toObject());
  },

  async updateVerification(id, updates) {
    const existing = await Verification.findOne({ id }).lean();
    if (!existing) return null;
    if (existing.status === 'confirmed') {
      throw new Error('Confirmed verification records are immutable for audit compliance');
    }

    const updated = await Verification.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    ).lean();

    if (Array.isArray(updates.items)) {
      await VerificationItem.deleteMany({ verification_id: id });
      const itemsToInsert = [];
      for (const item of updates.items) {
        const sysQty = Number(item.system_qty || 0);
        const physQty = Number(item.physical_qty || 0);
        const sList = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
          ? item.serial_numbers
          : (item.item_code ? [item.item_code] : []);
        const mList = Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0
          ? item.manufacturer_serial_numbers
          : (item.manufacturer_sn ? [item.manufacturer_sn] : []);

        itemsToInsert.push({
          id: (item.id && typeof item.id === 'string' && item.id.match(/^[0-9a-f-]{36}$/i)) ? item.id : uuidv4(),
          verification_id: id,
          item_id: item.item_id || item.inventory_item_id || null,
          item_code: item.item_code || (sList[0] || ''),
          serial_numbers: sList,
          manufacturer_sn: item.manufacturer_sn || (mList[0] || ''),
          manufacturer_serial_numbers: mList,
          is_batch: Boolean(item.is_batch) || sList.length > 1,
          item_name: item.item_name,
          category: item.category || '',
          system_qty: sysQty,
          physical_qty: physQty,
          difference: physQty - sysQty,
          condition: item.condition || 'Good',
          label_no: (item.label_no !== undefined && item.label_no !== null) ? String(item.label_no).trim() : '',
          remarks: item.remarks ? String(item.remarks).trim() : '',
          disposition: (item.issued_destroyed && item.issued_destroyed !== '—' && item.issued_destroyed !== 'N/A') ? item.issued_destroyed : (item.disposition || ''),
          issued_destroyed: (item.issued_destroyed && item.issued_destroyed !== '—') ? item.issued_destroyed : (item.disposition || ''),
          issued_destroyed_id: item.issued_destroyed_id || null,
          issued_destroyed_qty: (item.issued_destroyed === 'Issued' || item.issued_destroyed === 'Destroyed' || item.disposition === 'Issued' || item.disposition === 'Destroyed')
            ? (Number(item.issued_destroyed_qty) > 0 ? Math.min(Number(item.issued_destroyed_qty), sysQty) : 1)
            : null,
          status: item.status || (physQty === sysQty ? 'Counted' : 'Discrepancy')
        });
      }
      if (itemsToInsert.length > 0) {
        await VerificationItem.insertMany(itemsToInsert);
      }
    }

    return stripMongo(updated);
  },

  async confirmVerification(id, userId) {
    const updated = await Verification.findOneAndUpdate(
      { id },
      {
        $set: {
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: userId
        }
      },
      { returnDocument: 'after' }
    ).lean();
    return stripMongo(updated);
  },

  // --- Draft Verification Methods ---
  async getDraftVerification(unitId) {
    if (!unitId) return null;
    const draft = await Verification.findOne({ unit_id: unitId, status: 'draft' }).lean();
    if (!draft) return null;
    const items = await VerificationItem.find({ verification_id: draft.id }).lean();
    return {
      ...stripMongo(draft),
      items: items.map(stripMongo)
    };
  },

  async saveDraftHeader(data) {
    if (!data.unit_id) throw new Error('unit_id is required');
    let draft = await Verification.findOne({ unit_id: data.unit_id, status: 'draft' });
    const verifierList = [data.verifier_1, data.verifier_2, data.verifier_3].filter(Boolean);
    if (verifierList.length === 0 && data.verified_by) {
      if (Array.isArray(data.verified_by)) verifierList.push(...data.verified_by);
      else verifierList.push(data.verified_by);
    }

    if (draft) {
      if (data.date) draft.date = data.date;
      if (data.year) draft.year = Number(data.year);
      if (data.verifier_1 !== undefined) draft.verifier_1 = data.verifier_1;
      if (data.verifier_2 !== undefined) draft.verifier_2 = data.verifier_2;
      if (data.verifier_3 !== undefined) draft.verifier_3 = data.verifier_3;
      draft.verified_by = verifierList.length > 0 ? verifierList : draft.verified_by;
      if (data.summary !== undefined) draft.summary = data.summary;
      draft.updated_at = new Date();
      await draft.save();
    } else {
      draft = await Verification.create({
        id: uuidv4(),
        unit_id: data.unit_id,
        date: data.date || new Date().toISOString().split('T')[0],
        year: Number(data.year || new Date().getFullYear()),
        verifier_1: data.verifier_1 || (verifierList[0] || ''),
        verifier_2: data.verifier_2 || (verifierList[1] || ''),
        verifier_3: data.verifier_3 || (verifierList[2] || ''),
        verified_by: verifierList,
        status: 'draft',
        summary: data.summary || ''
      });
    }
    return stripMongo(draft.toObject());
  },

  async saveDraftItem({ unit_id, item_id, rowData = {}, headerData = {} }) {
    if (!unit_id || !item_id) {
      throw new Error('unit_id and item_id are required');
    }

    // 1. Ensure draft exists
    let draft = await Verification.findOne({ unit_id, status: 'draft' });
    if (!draft) {
      draft = await Verification.create({
        id: uuidv4(),
        unit_id,
        date: headerData.date || new Date().toISOString().split('T')[0],
        year: Number(headerData.year || new Date().getFullYear()),
        verifier_1: headerData.verifier_1 || '',
        verifier_2: headerData.verifier_2 || '',
        verifier_3: headerData.verifier_3 || '',
        verified_by: [headerData.verifier_1, headerData.verifier_2, headerData.verifier_3].filter(Boolean),
        status: 'draft',
        summary: headerData.summary || ''
      });
    } else if (headerData && (headerData.date || headerData.verifier_1 !== undefined)) {
      if (headerData.date) draft.date = headerData.date;
      if (headerData.year) draft.year = Number(headerData.year);
      if (headerData.verifier_1 !== undefined) draft.verifier_1 = headerData.verifier_1;
      if (headerData.verifier_2 !== undefined) draft.verifier_2 = headerData.verifier_2;
      if (headerData.verifier_3 !== undefined) draft.verifier_3 = headerData.verifier_3;
      draft.verified_by = [draft.verifier_1, draft.verifier_2, draft.verifier_3].filter(Boolean);
      draft.updated_at = new Date();
      await draft.save();
    }

    // 2. Fetch inventory item details
    const invItem = await InventoryItem.findOne({ id: item_id }).lean();

    // 3. Validate and parse numbers/strings
    const system_qty = rowData.system_qty !== undefined
      ? Number(rowData.system_qty)
      : (invItem ? Number(invItem.quantity) : 0);

    const rawPhys = rowData.physical_qty;
    const hasPhys = rawPhys !== '' && rawPhys !== null && rawPhys !== undefined && !isNaN(Number(rawPhys));
    const phys = hasPhys ? Number(rawPhys) : null;
    if (hasPhys && phys < 0) {
      throw new Error('Physical quantity cannot be negative.');
    }

    const diff = hasPhys ? phys - system_qty : null;
    let status = rowData.status;
    if (!status || status === 'Not Counted') {
      if (hasPhys) status = diff === 0 ? 'Matched' : (diff < 0 ? 'Shortage' : 'Excess');
      else status = 'Not Counted';
    }

    const condition = (rowData.condition && rowData.condition !== '—') ? String(rowData.condition).trim() : 'Good';
    const rawIssuedDestroyed = rowData.issued_destroyed;
    const issued_destroyed = (rawIssuedDestroyed && rawIssuedDestroyed !== '—') ? String(rawIssuedDestroyed).trim() : '';
    const issued_destroyed_id = rowData.issued_destroyed_id || null;
    let issued_destroyed_qty = null;
    if (issued_destroyed === 'Issued' || issued_destroyed === 'Destroyed') {
      const parsedQty = Number(rowData.issued_destroyed_qty);
      issued_destroyed_qty = (!isNaN(parsedQty) && parsedQty > 0) ? Math.min(parsedQty, system_qty) : 1;
    }

    const sList = Array.isArray(rowData.serial_numbers) && rowData.serial_numbers.length > 0
      ? rowData.serial_numbers
      : (invItem?.serial_numbers || (invItem?.item_code ? [invItem.item_code] : []));

    const mList = Array.isArray(rowData.manufacturer_serial_numbers) && rowData.manufacturer_serial_numbers.length > 0
      ? rowData.manufacturer_serial_numbers
      : (invItem?.manufacturer_serial_numbers || (invItem?.serial_number ? [invItem.serial_number] : []));

    // 4. Upsert item into VerificationItem for this draft
    let itemDoc = await VerificationItem.findOne({ verification_id: draft.id, item_id });
    const label_no = rowData.label_no !== undefined
      ? String(rowData.label_no || '').trim()
      : (itemDoc ? (itemDoc.label_no || '') : '');
    const remarks = rowData.remarks !== undefined
      ? String(rowData.remarks || '').trim()
      : (itemDoc ? (itemDoc.remarks || '') : '');

    if (itemDoc) {
      itemDoc.system_qty = system_qty;
      itemDoc.physical_qty = phys;
      itemDoc.difference = diff !== null ? diff : 0;
      itemDoc.condition = condition;
      itemDoc.label_no = label_no;
      itemDoc.remarks = remarks;
      itemDoc.issued_destroyed = issued_destroyed;
      itemDoc.issued_destroyed_qty = issued_destroyed_qty;
      if (issued_destroyed_id) itemDoc.issued_destroyed_id = issued_destroyed_id;
      if (issued_destroyed && issued_destroyed !== 'N/A') {
        itemDoc.disposition = issued_destroyed;
      }
      itemDoc.status = status;
      if (rowData.item_name || invItem?.item_name) itemDoc.item_name = rowData.item_name || invItem.item_name;
      if (rowData.category || invItem?.category) itemDoc.category = rowData.category || invItem.category;
      if (sList.length > 0) itemDoc.serial_numbers = sList;
      if (mList.length > 0) itemDoc.manufacturer_serial_numbers = mList;
      itemDoc.is_batch = Boolean(rowData.is_batch ?? (invItem?.is_batch || sList.length > 1));
      await itemDoc.save();
    } else {
      itemDoc = await VerificationItem.create({
        id: uuidv4(),
        verification_id: draft.id,
        item_id,
        item_code: rowData.item_code || invItem?.item_code || (sList[0] || ''),
        serial_numbers: sList,
        manufacturer_sn: rowData.manufacturer_sn || invItem?.serial_number || (mList[0] || ''),
        manufacturer_serial_numbers: mList,
        is_batch: Boolean(rowData.is_batch ?? (invItem?.is_batch || sList.length > 1)),
        item_name: rowData.item_name || invItem?.item_name || '',
        category: rowData.category || invItem?.category || '',
        system_qty,
        physical_qty: phys,
        difference: diff !== null ? diff : 0,
        condition,
        issued_destroyed,
        issued_destroyed_id,
        issued_destroyed_qty,
        disposition: (issued_destroyed && issued_destroyed !== 'N/A') ? issued_destroyed : (rowData.disposition || ''),
        label_no,
        remarks,
        status,
        in_inventory: true
      });
    }

    draft.updated_at = new Date();
    await draft.save();

    return {
      draft: stripMongo(draft.toObject()),
      item: stripMongo(itemDoc.toObject())
    };
  },

  async saveDraftAllItems({ unit_id, items = [], headerData = {} }) {
    if (!unit_id) throw new Error('unit_id is required');
    let savedCount = 0;
    let lastDraft = null;

    for (const row of items) {
      const itemId = row.inventory_item_id || row.item_id || row.id;
      if (itemId) {
        const res = await this.saveDraftItem({
          unit_id,
          item_id: itemId,
          rowData: row,
          headerData
        });
        lastDraft = res.draft;
        savedCount++;
      }
    }

    return {
      success: true,
      savedCount,
      draft: lastDraft
    };
  },

  async discardDraft(unitId) {
    if (!unitId) return false;
    const draft = await Verification.findOne({ unit_id: unitId, status: 'draft' });
    if (draft) {
      await VerificationItem.deleteMany({ verification_id: draft.id });
      await Verification.deleteOne({ id: draft.id });
      return true;
    }
    return false;
  },

  async clearDraftTestItems(unitId) {
    if (!unitId) return { clearedCount: 0, remainingCount: 0 };
    const draft = await Verification.findOne({ unit_id: unitId, status: 'draft' });
    if (!draft) return { clearedCount: 0, remainingCount: 0 };

    const delRes = await VerificationItem.deleteMany({
      verification_id: draft.id,
      label_no: /^TEST-/i
    });

    let headerChanged = false;
    ['verifier_1', 'verifier_2', 'verifier_3'].forEach(k => {
      if (draft[k] && /^Test Verifier/i.test(draft[k])) {
        draft[k] = '';
        headerChanged = true;
      }
    });
    if (headerChanged) {
      draft.verified_by = [draft.verifier_1, draft.verifier_2, draft.verifier_3].filter(Boolean);
      await draft.save();
    }

    const remainingCount = await VerificationItem.countDocuments({ verification_id: draft.id });
    return {
      clearedCount: delRes.deletedCount,
      remainingCount
    };
  },

  // --- Issued / Destroyed Items ---
  async getIssuedDestroyedItems(unitIds = null) {
    const list = await IssuedDestroyedItem.find({}).sort({ date: -1, created_at: -1 }).lean();
    const [allItems, allUnits] = await Promise.all([
      InventoryItem.find({}).lean(),
      Unit.find({}).lean()
    ]);
    const itemsMap = new Map(allItems.map(i => [i.id, i]));
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));

    return list.map(entry => {
      const item = itemsMap.get(entry.item_id) || {};
      const unitId = entry.unit_id || item.unit_id;
      const unit = unitsMap.get(unitId) || {};
      const clean = stripMongo(entry);
      const sList = Array.isArray(entry.serial_numbers) && entry.serial_numbers.length > 0
        ? entry.serial_numbers
        : (entry.serial_number ? [entry.serial_number] : (item.serial_number || item.item_code ? [item.serial_number || item.item_code] : []));

      return {
        ...clean,
        serial_number: entry.serial_number || (sList[0] || ''),
        serial_numbers: sList,
        item_name: item.item_name || 'Unknown Item',
        item_code: item.item_code || '',
        category: item.category || '',
        unit_id: unitId,
        unit_name: unit.unit_name || ''
      };
    }).filter(e => !unitIds || unitIds.includes(e.unit_id));
  },

  async getIssuedDestroyedItemById(id) {
    const entry = await IssuedDestroyedItem.findOne({ id }).lean();
    if (!entry) return null;

    const [item, allUnits] = await Promise.all([
      InventoryItem.findOne({ id: entry.item_id }).lean(),
      Unit.find({}).lean()
    ]);
    const unitsMap = new Map(allUnits.map(u => [u.id, u]));
    const unitId = entry.unit_id || (item ? item.unit_id : null);
    const unit = unitsMap.get(unitId) || {};
    const clean = stripMongo(entry);
    const sList = Array.isArray(entry.serial_numbers) && entry.serial_numbers.length > 0
      ? entry.serial_numbers
      : (entry.serial_number ? [entry.serial_number] : (item ? (item.serial_number || item.item_code ? [item.serial_number || item.item_code] : []) : []));

    return {
      ...clean,
      serial_number: entry.serial_number || (sList[0] || ''),
      serial_numbers: sList,
      item_name: item ? (item.item_name || 'Unknown Item') : 'Unknown Item',
      item_code: item ? (item.item_code || '') : '',
      category: item ? (item.category || '') : '',
      unit_id: unitId,
      unit_name: unit.unit_name || ''
    };
  },

  async createIssuedDestroyedItem(data) {
    const item = await InventoryItem.findOne({ id: data.item_id });
    const unitId = data.unit_id || (item ? item.unit_id : null);

    const sList = Array.isArray(data.serial_numbers) && data.serial_numbers.length > 0
      ? data.serial_numbers
      : (data.serial_number ? [data.serial_number] : []);

    const numQty = Number(data.quantity || (sList.length > 0 ? sList.length : 1));

    // Check duplicate serial recording
    if (sList.length > 0) {
      const existingRecords = await IssuedDestroyedItem.find({
        $or: [
          { item_id: data.item_id },
          { unit_id: unitId }
        ]
      }).lean();

      const alreadyRecordedSerials = new Set();
      for (const rec of existingRecords) {
        if (Array.isArray(rec.serial_numbers)) {
          rec.serial_numbers.forEach(sn => sn && alreadyRecordedSerials.add(sn));
        }
        if (rec.serial_number) alreadyRecordedSerials.add(rec.serial_number);
      }

      for (const sn of sList) {
        if (alreadyRecordedSerials.has(sn)) {
          throw new Error(`Serial number "${sn}" is already recorded as Issued or Destroyed.`);
        }
      }
    }

    // Check verification candidate remaining quantity
    let vItem = null;
    if (data.verification_id) {
      vItem = await VerificationItem.findOne({
        verification_id: data.verification_id,
        item_id: data.item_id
      }).lean();
    } else {
      const candidateVerifs = await Verification.find({
        unit_id: unitId,
        status: { $in: ['draft', 'confirmed'] }
      }).lean();
      candidateVerifs.sort((a, b) => {
        if (a.status === 'draft' && b.status !== 'draft') return -1;
        if (b.status === 'draft' && a.status !== 'draft') return 1;
        return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0);
      });
      const vIds = candidateVerifs.map(v => v.id);
      vItem = await VerificationItem.findOne({
        verification_id: { $in: vIds },
        item_id: data.item_id,
        issued_destroyed: { $in: ['Issued', 'Destroyed'] }
      }).lean();
    }

    if (vItem && (vItem.issued_destroyed === 'Issued' || vItem.issued_destroyed === 'Destroyed')) {
      const markedQty = Number(vItem.issued_destroyed_qty || 1);
      const existingForVerif = await IssuedDestroyedItem.find({
        item_id: data.item_id,
        unit_id: unitId
      }).lean();
      const alreadyQty = existingForVerif.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      const remainingQty = Math.max(0, markedQty - alreadyQty);
      if (numQty > remainingQty) {
        throw new Error(`Quantity (${numQty}) exceeds remaining quantity to record (${remainingQty}).`);
      }
    }

    const newItem = {
      id: data.id || uuidv4(),
      item_id: data.item_id,
      unit_id: unitId,
      serial_number: sList[0] || data.serial_number || null,
      serial_numbers: sList,
      quantity: numQty,
      disposition: data.disposition,
      reason: data.reason || '',
      date: data.date || new Date().toISOString().split('T')[0],
      verification_id: data.verification_id || null
    };

    const created = await IssuedDestroyedItem.create(newItem);

    // Deduct quantity from inventory item
    if (item) {
      item.quantity = Math.max(0, Number(item.quantity) - numQty);
      await item.save();
    }

    return await db.getIssuedDestroyedItemById(created.id);
  },

  async updateIssuedDestroyedItem(id, updates) {
    const existing = await IssuedDestroyedItem.findOne({ id });
    if (!existing) return null;

    const oldItemId = existing.item_id;
    const oldQty = Number(existing.quantity);
    const newItemId = updates.item_id || oldItemId;

    let sList = existing.serial_numbers || [];
    if (updates.serial_numbers !== undefined) {
      sList = Array.isArray(updates.serial_numbers) ? updates.serial_numbers : [];
    } else if (updates.serial_number !== undefined) {
      sList = updates.serial_number ? [updates.serial_number] : [];
    }

    const newQty = updates.quantity !== undefined
      ? Number(updates.quantity)
      : (sList.length > 0 ? sList.length : oldQty);

    // Check duplicate serial recording excluding this record
    if (sList.length > 0) {
      const otherRecords = await IssuedDestroyedItem.find({
        id: { $ne: id },
        $or: [
          { item_id: newItemId },
          { unit_id: existing.unit_id }
        ]
      }).lean();

      const alreadyRecordedSerials = new Set();
      for (const rec of otherRecords) {
        if (Array.isArray(rec.serial_numbers)) {
          rec.serial_numbers.forEach(sn => sn && alreadyRecordedSerials.add(sn));
        }
        if (rec.serial_number) alreadyRecordedSerials.add(rec.serial_number);
      }

      for (const sn of sList) {
        if (alreadyRecordedSerials.has(sn)) {
          throw new Error(`Serial number "${sn}" is already recorded as Issued or Destroyed.`);
        }
      }
    }

    const verifId = updates.verification_id !== undefined ? updates.verification_id : existing.verification_id;
    if (verifId) {
      const vItem = await VerificationItem.findOne({
        verification_id: verifId,
        item_id: newItemId
      }).lean();

      if (vItem && (vItem.issued_destroyed === 'Issued' || vItem.issued_destroyed === 'Destroyed')) {
        const markedQty = Number(vItem.issued_destroyed_qty || 1);
        const existingForVerif = await IssuedDestroyedItem.find({
          id: { $ne: id },
          verification_id: verifId,
          item_id: newItemId
        }).lean();
        const alreadyQty = existingForVerif.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
        const remainingQty = Math.max(0, markedQty - alreadyQty);
        if (newQty > remainingQty) {
          throw new Error(`Cannot record ${newQty} units. Only ${remainingQty} remaining to record for this verification.`);
        }
      }
    }

    if (newItemId === oldItemId) {
      const qtyDiff = newQty - oldQty;
      if (qtyDiff !== 0) {
        const item = await InventoryItem.findOne({ id: oldItemId });
        if (item) {
          item.quantity = Math.max(0, Number(item.quantity) - qtyDiff);
          await item.save();
        }
      }
    } else {
      // Revert old item quantity
      const oldItem = await InventoryItem.findOne({ id: oldItemId });
      if (oldItem) {
        oldItem.quantity = Number(oldItem.quantity) + oldQty;
        await oldItem.save();
      }
      // Deduct from new item
      const newItem = await InventoryItem.findOne({ id: newItemId });
      if (newItem) {
        newItem.quantity = Math.max(0, Number(newItem.quantity) - newQty);
        await newItem.save();
        if (!updates.unit_id) updates.unit_id = newItem.unit_id;
      }
    }

    if (updates.item_id) existing.item_id = updates.item_id;
    if (updates.unit_id !== undefined) existing.unit_id = updates.unit_id;
    existing.serial_numbers = sList;
    existing.serial_number = sList[0] || (updates.serial_number !== undefined ? updates.serial_number : existing.serial_number);
    existing.quantity = newQty;
    if (updates.disposition) existing.disposition = updates.disposition;
    if (updates.reason !== undefined) existing.reason = updates.reason;
    if (updates.date) existing.date = updates.date;
    if (updates.verification_id !== undefined) existing.verification_id = updates.verification_id;

    await existing.save();
    return await db.getIssuedDestroyedItemById(id);
  },

  async deleteIssuedDestroyedItem(id) {
    const existing = await IssuedDestroyedItem.findOne({ id });
    if (!existing) return false;

    // Restore inventory item quantity
    const item = await InventoryItem.findOne({ id: existing.item_id });
    if (item) {
      item.quantity = Number(item.quantity || 0) + Number(existing.quantity || 0);
      await item.save();
    }

    const res = await IssuedDestroyedItem.deleteOne({ id });
    return res.deletedCount > 0;
  },

  async getIssuedDestroyedCandidates(unitId) {
    if (!unitId) return [];

    // 1. Find draft and confirmed verifications for this unit
    const verifications = await Verification.find({
      unit_id: unitId,
      status: { $in: ['draft', 'confirmed'] }
    }).lean();

    if (verifications.length === 0) return [];

    // Prioritize open draft verifications first, then newer verifications
    verifications.sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (b.status === 'draft' && a.status !== 'draft') return 1;
      return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0);
    });

    const verifMap = new Map(verifications.map(v => [v.id, v]));
    const verifIds = verifications.map(v => v.id);

    // 2. Find verification items marked Issued or Destroyed
    const markedItems = await VerificationItem.find({
      verification_id: { $in: verifIds },
      issued_destroyed: { $in: ['Issued', 'Destroyed'] }
    }).lean();

    if (markedItems.length === 0) return [];

    // Order marked items according to verification priority
    const verifOrder = new Map(verifIds.map((id, index) => [id, index]));
    markedItems.sort((a, b) => (verifOrder.get(a.verification_id) ?? 999) - (verifOrder.get(b.verification_id) ?? 999));

    // 3. Find all existing issued/destroyed items for this unit
    const recordedEntries = await IssuedDestroyedItem.find({ unit_id: unitId }).lean();

    // Track recorded quantities separately for each disposition (Issued / Destroyed)
    const recordedByItemDisposition = new Map(); // Map<itemId, {Issued: number, Destroyed: number}>
    const recordedSerialsByItemDisposition = new Map(); // Map<itemId, {issued:Set, destroyed:Set}>

    for (const rec of recordedEntries) {
      const itId = rec.item_id;
      const disp = (rec.disposition || '').toLowerCase(); // assume stored disposition field
      const qty = Number(rec.quantity || 0);
      // Initialize quantity map entry if needed
      if (!recordedByItemDisposition.has(itId)) {
        recordedByItemDisposition.set(itId, { issued: 0, destroyed: 0 });
      }
      const dispEntry = recordedByItemDisposition.get(itId);
      if (disp === 'issued') {
        dispEntry.issued += qty;
      } else if (disp === 'destroyed') {
        dispEntry.destroyed += qty;
      }

      // Initialize serials map entry if needed
      if (!recordedSerialsByItemDisposition.has(itId)) {
        recordedSerialsByItemDisposition.set(itId, { issued: new Set(), destroyed: new Set() });
      }
      const sDispSet = recordedSerialsByItemDisposition.get(itId);
      const targetSet = disp === 'issued' ? sDispSet.issued : disp === 'destroyed' ? sDispSet.destroyed : null;
      if (targetSet) {
        if (Array.isArray(rec.serial_numbers)) {
          rec.serial_numbers.forEach(s => s && targetSet.add(s));
        }
        if (rec.serial_number) {
          targetSet.add(rec.serial_number);
        }
      }
    }

    // 4. Fetch the inventory items for names, codes, serial_numbers
    const itemIds = [...new Set(markedItems.map(m => m.item_id).filter(Boolean))];
    const invItems = await InventoryItem.find({ id: { $in: itemIds } }).lean();
    const invMap = new Map(invItems.map(i => [i.id, i]));

    const candidates = [];
    const processedItemIds = new Set();

    for (const vItem of markedItems) {
      const itemId = vItem.item_id;
      if (!itemId || processedItemIds.has(itemId)) continue;
      processedItemIds.add(itemId);

      const invItem = invMap.get(itemId);
      const markedQty = Number(vItem.issued_destroyed_qty || 1);
      const dispKey = (vItem.issued_destroyed || '').toLowerCase();
      const dispMap = recordedByItemDisposition.get(itemId) || {issued:0,destroyed:0};
      const alreadyRecorded = dispKey === 'issued' ? dispMap.issued : dispKey === 'destroyed' ? dispMap.destroyed : 0;
      const remainingQty = Math.max(0, markedQty - alreadyRecorded);

      if (remainingQty <= 0) {
        // Fully recorded already
        continue;
      }

      // Gather item serial numbers
      const itemSerials = (Array.isArray(vItem.serial_numbers) && vItem.serial_numbers.length > 0)
        ? vItem.serial_numbers
        : (invItem?.serial_numbers || (invItem?.item_code ? [invItem.item_code] : []));

      const dispKey2 = (vItem.issued_destroyed || '').toLowerCase();
      const serialsMap = recordedSerialsByItemDisposition.get(itemId) || { issued: new Set(), destroyed: new Set() };
      const recordedSet = dispKey2 === 'issued' ? serialsMap.issued : dispKey2 === 'destroyed' ? serialsMap.destroyed : new Set();

      const serialsWithFlags = itemSerials.map(sn => ({
        serial_number: sn,
        is_recorded: recordedSet.has(sn)
      }));

      const verif = verifMap.get(vItem.verification_id);

      candidates.push({
        inventory_item_id: itemId,
        item_id: itemId,
        item_name: vItem.item_name || invItem?.item_name || 'Unknown Item',
        item_code: vItem.item_code || invItem?.item_code || (itemSerials[0] || ''),
        category: vItem.category || invItem?.category || '',
        sub_type: invItem?.sub_type || '',
        disposition: vItem.issued_destroyed,
        marked_quantity: markedQty,
        already_recorded_quantity: alreadyRecorded,
        remaining_quantity: remainingQty,
        verification_id: vItem.verification_id,
        verification_item_id: vItem.id,
        verification_date: verif?.date || '',
        is_batch: Boolean(vItem.is_batch ?? invItem?.is_batch ?? (itemSerials.length > 1)),
        serial_numbers: serialsWithFlags
      });
    }

    return candidates;
  }
};

// Wrap all methods to auto-ensure DB connection
const wrappedDb = {};
for (const [key, value] of Object.entries(db)) {
  if (typeof value === 'function') {
    wrappedDb[key] = async function (...args) {
      await ensureConnected();
      return value.apply(wrappedDb, args);
    };
  } else {
    wrappedDb[key] = value;
  }
}

module.exports = wrappedDb;
