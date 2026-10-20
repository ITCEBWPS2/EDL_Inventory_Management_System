import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatNumber } from '../utils/formatters';
import { CATEGORY_SUBTYPES, SUBTYPE_METADATA, generateNextItemCode, itemMatchesSubType } from '../constants/categorySubtypes';
import { generateSerialNumber, generateBatchSerialNumbers, isBatchItem } from '../utils/serialNumberGenerator';
import { BatchSerialSubTable } from '../components/inventory/BatchSerialSubTable';
import { BackButton } from '../components/common/BackButton';
import { Tag, ShieldAlert, CheckCircle2, Settings, ArrowRight, Boxes, Plus, Filter, X, ChevronRight } from 'lucide-react';

export const slugifyCategory = (name) => {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export const CategoryInventoryPage = () => {
  const { categoryId, subType: paramSubType } = useParams();
  const [searchParams] = useSearchParams();
  const querySubType = searchParams.get('type') || searchParams.get('sub_type') || null;
  const activeSubTypeSlug = paramSubType || querySubType || null;

  const navigate = useNavigate();
  const { user, selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [batchSerials, setBatchSerials] = useState([]);
  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
    quantity: 1,
    serial_number: '',
    status: 'In Stock',
    sub_type: '',
    brand: '',
    description: ''
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Find the active category based on URL param (matches ID, slug, or raw name)
  const currentCategory = useMemo(() => {
    if (!categories.length) return null;
    const target = (categoryId || '').toLowerCase().trim();
    return categories.find(c => 
      c.id === categoryId ||
      c.id.toLowerCase() === target ||
      slugifyCategory(c.name) === target ||
      c.name.toLowerCase().trim() === target
    ) || null;
  }, [categories, categoryId]);

  const categorySlug = currentCategory ? slugifyCategory(currentCategory.name) : (categoryId || '');
  const isITCategory = categorySlug === 'it-computing-equipment' || 
    categoryId === 'it-computing-equipment' || 
    Boolean(currentCategory?.name && currentCategory.name.toLowerCase().includes('it & computing'));
  const isNetworkCategory = categorySlug === 'network-communication-equipment' || 
    categoryId === 'network-communication-equipment' || 
    Boolean(currentCategory?.name && currentCategory.name.toLowerCase().includes('network & communication'));
  const isAVCategory = categorySlug === 'audio-visual-presentation-equipment' || 
    categoryId === 'audio-visual-presentation-equipment' || 
    Boolean(currentCategory?.name && currentCategory.name.toLowerCase().includes('audio visual'));

  const isToolsCategory = categorySlug === 'tools-equipment' || 
    categoryId === 'tools-equipment' || 
    Boolean(currentCategory?.name && currentCategory.name.toLowerCase().includes('tools & equipment'));
  const hasDescriptionField = isITCategory || isAVCategory || isToolsCategory || [
    'network-equipment',
    'servers-storage',
    'telephones-phones',
    'cameras',
    'cctv-recording-display',
    'audio-equipment',
    'display-presentation'
  ].includes(activeSubTypeSlug);
  const hasBrandField = activeSubTypeSlug === 'network-equipment';
  const availableSubTypes = CATEGORY_SUBTYPES[categorySlug] || [];
  const activeSubType = useMemo(() => {
    if (!activeSubTypeSlug) return null;
    return availableSubTypes.find(s => s.slug === activeSubTypeSlug) || {
      name: activeSubTypeSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      slug: activeSubTypeSlug
    };
  }, [availableSubTypes, activeSubTypeSlug]);

  const subMeta = activeSubTypeSlug ? SUBTYPE_METADATA[activeSubTypeSlug] : null;

  const fetchData = async () => {
    setLoading(true);
    try {
      const catsRes = await api.get('/inventory/categories');
      if (catsRes.success && catsRes.data) {
        setCategories(catsRes.data);
      }

      // Fetch items for this unit and category
      const params = { unit_id: selectedUnitId };
      if (categoryId) {
        params.category = categoryId;
      }
      if (activeSubTypeSlug) {
        params.sub_type = activeSubTypeSlug;
      }
      const itemsRes = await api.get('/inventory', params);
      if (itemsRes.success && itemsRes.data) {
        // Also apply client-side itemMatchesSubType to guarantee exact filtering
        const filtered = activeSubTypeSlug
          ? itemsRes.data.filter(item => itemMatchesSubType(item, activeSubTypeSlug))
          : itemsRes.data;
        setItems(filtered);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load category inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryId, activeSubTypeSlug, selectedUnitId]);

  const typeLabel = subMeta?.subTypeFieldLabel || (subMeta?.singularTitle ? `${subMeta.singularTitle} Type` : (activeSubType ? `${activeSubType.name.replace(/s$/i, '')} Type` : 'Type'));

  const handleOpenAdd = () => {
    setEditingItem(null);
    const nextSeqNo = (items?.length || 0) + 1;
    const defaultOption = subMeta?.subTypeOptions?.[0] || '';
    const activeUnit = selectedUnit || user?.units?.[0] || 'EDL-HQ';
    const catName = currentCategory ? currentCategory.name : (categoryId || 'Furniture');

    const nextSerial = generateSerialNumber({
      unit: activeUnit,
      category: catName,
      subCategory: activeSubTypeSlug || '',
      itemType: defaultOption,
      existingItems: items
    });

    setBatchSerials([nextSerial]);
    setFormData({
      seq_no: nextSeqNo,
      item_name: defaultOption,
      item_code: nextSerial,
      quantity: 1,
      serial_number: '',
      manufacturer_serial_numbers: [''],
      status: 'In Stock',
      sub_type: activeSubTypeSlug || '',
      chair_type: defaultOption,
      custom_type: '',
      brand: '',
      description: ''
    });
    setModalOpen(true);
  };

  const handleQuantityChange = (val) => {
    const qty = Math.max(1, parseInt(val) || 1);
    setFormData(prev => {
      const currentMfg = Array.isArray(prev.manufacturer_serial_numbers)
        ? [...prev.manufacturer_serial_numbers]
        : (prev.serial_number ? [prev.serial_number] : []);
      const newMfg = [...currentMfg];
      if (newMfg.length < qty) {
        while (newMfg.length < qty) newMfg.push('');
      } else if (newMfg.length > qty) {
        newMfg.length = qty;
      }
      return {
        ...prev,
        quantity: qty,
        manufacturer_serial_numbers: newMfg,
        serial_number: qty === 1 ? (newMfg[0] ?? prev.serial_number) : prev.serial_number
      };
    });
  };

  const handleUnitMfgChange = (idx, value) => {
    setFormData(prev => {
      const list = Array.isArray(prev.manufacturer_serial_numbers)
        ? [...prev.manufacturer_serial_numbers]
        : [];
      while (list.length < prev.quantity) list.push('');
      list[idx] = value;
      return {
        ...prev,
        manufacturer_serial_numbers: list
      };
    });
  };

  // Live regeneration of Serial No. preview when inputs change during Add
  useEffect(() => {
    if (!modalOpen || editingItem) return;
    const activeUnit = selectedUnit || user?.units?.[0] || 'EDL-HQ';
    const catName = currentCategory ? currentCategory.name : (categoryId || 'Furniture');
    const currentType = formData.chair_type === '__custom__'
      ? (formData.custom_type || '')
      : (formData.chair_type || subMeta?.subTypeOptions?.[0] || formData.item_name || '');

    const qty = Math.max(1, parseInt(formData.quantity) || 1);

    if (qty > 1) {
      const batchResult = generateBatchSerialNumbers({
        unit: activeUnit,
        category: catName,
        subCategory: activeSubTypeSlug || formData.sub_type || '',
        itemType: currentType,
        quantity: qty,
        existingItems: items
      });
      setBatchSerials(batchResult.serialNumbers);
      setFormData(prev => ({
        ...prev,
        item_code: batchResult.firstSerial
      }));
    } else {
      const generated = generateSerialNumber({
        unit: activeUnit,
        category: catName,
        subCategory: activeSubTypeSlug || formData.sub_type || '',
        itemType: currentType,
        existingItems: items
      });
      setBatchSerials([generated]);
      if (generated && formData.item_code !== generated) {
        setFormData(prev => ({ ...prev, item_code: generated }));
      }
    }
  }, [modalOpen, editingItem, formData.chair_type, formData.custom_type, formData.item_name, formData.quantity, selectedUnit, activeSubTypeSlug, items]);

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const itemIndex = items.findIndex(i => i.id === item.id);
    const seqNo = itemIndex >= 0 ? itemIndex + 1 : 1;

    const currentVal = item.sub_classification || item.item_name || '';
    const CHAIR_RENAME_MAP = {
      'computer executive': 'Computer Executive Chair',
      'computer typist': 'Computer Typist Chair',
      'computer assistant': 'Computer Assistant Chair'
    };
    const mappedVal = CHAIR_RENAME_MAP[currentVal.toLowerCase().trim()] || currentVal;
    const matchedType = subMeta?.subTypeOptions?.find(opt =>
      opt.toLowerCase() === mappedVal.toLowerCase() ||
      opt.toLowerCase() === currentVal.toLowerCase() ||
      currentVal.toLowerCase().includes(opt.toLowerCase()) ||
      opt.toLowerCase().includes(currentVal.toLowerCase())
    );

    const isCustom = subMeta?.subTypeOptions && !matchedType;
    const qty = parseInt(item.quantity) || 1;
    let initialMfg = [];
    if (Array.isArray(item.manufacturer_serial_numbers) && item.manufacturer_serial_numbers.length > 0) {
      initialMfg = [...item.manufacturer_serial_numbers];
    } else if (item.serial_number) {
      initialMfg = [item.serial_number];
    }
    while (initialMfg.length < qty) {
      initialMfg.push('');
    }

    setBatchSerials(Array.isArray(item.serial_numbers) ? item.serial_numbers : [item.item_code]);
    setFormData({
      seq_no: seqNo,
      item_name: currentVal,
      item_code: item.item_code,
      quantity: qty,
      serial_number: item.serial_number || '',
      manufacturer_serial_numbers: initialMfg,
      status: item.status,
      sub_type: item.sub_type || activeSubTypeSlug || '',
      chair_type: isCustom ? '__custom__' : (matchedType || currentVal || subMeta?.subTypeOptions?.[0] || ''),
      custom_type: isCustom ? currentVal : '',
      brand: item.brand || '',
      description: item.description || ''
    });
    setModalOpen(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.item_name}"?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast.success('Inventory item deleted successfully.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete item.');
    }
  };

  const handleSave = async () => {
    let finalType = '';
    if (subMeta) {
      finalType = formData.chair_type === '__custom__'
        ? (formData.custom_type || '').trim()
        : (formData.chair_type || subMeta.subTypeOptions?.[0] || '').trim();
    } else {
      finalType = (formData.item_name || formData.chair_type || '').trim();
    }

    if (!finalType || !formData.item_code.trim()) {
      toast.error(`${subMeta ? typeLabel : 'Item type'} and serial no. are required.`);
      return;
    }

    const catName = currentCategory ? currentCategory.name : 'Furniture';
    const catId = currentCategory ? currentCategory.id : null;
    const qty = Math.max(1, parseInt(formData.quantity) || 1);
    const isBatch = qty > 1;

    let serialList = null;
    let batchLabel = null;

    if (isBatch) {
      if (batchSerials && batchSerials.length === qty) {
        serialList = batchSerials;
      } else {
        const batchResult = generateBatchSerialNumbers({
          unit: selectedUnit || user?.units?.[0] || 'EDL-HQ',
          category: catName,
          subCategory: formData.sub_type || activeSubTypeSlug || '',
          itemType: finalType,
          quantity: qty,
          existingItems: items
        });
        serialList = batchResult.serialNumbers;
      }
      batchLabel = `${finalType} Batch (Multi-Serial)`;
    } else {
      serialList = [formData.item_code.trim()];
    }

    const mfgSerials = isBatch
      ? Array.from({ length: qty }).map((_, idx) => (formData.manufacturer_serial_numbers?.[idx] || '').trim())
      : [(formData.serial_number || formData.manufacturer_serial_numbers?.[0] || '').trim()];

    setModalLoading(true);
    try {
      const payload = {
        item_name: finalType,
        item_code: formData.item_code.trim(),
        category: catName,
        category_id: catId,
        sub_type: formData.sub_type || activeSubTypeSlug || null,
        sub_classification: finalType,
        brand: hasBrandField ? (formData.brand?.trim() || null) : undefined,
        description: hasDescriptionField ? (formData.description?.trim() || null) : undefined,
        quantity: qty,
        serial_number: isBatch ? null : (mfgSerials[0] || null),
        manufacturer_serial_numbers: mfgSerials,
        status: formData.status || 'In Stock',
        unit_id: selectedUnitId || (user?.units?.[0]?.id),
        serial_numbers: serialList,
        is_batch: isBatch,
        batch_label: batchLabel
      };

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success('Item updated successfully.');
      } else {
        await api.post('/inventory', payload);
        toast.success(`New ${subMeta?.singularTitle?.toLowerCase() || 'item'} added successfully.`);
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save inventory item.');
    } finally {
      setModalLoading(false);
    }
  };

  // For sub-type pages (e.g. Chairs): No. | Serial No. | Chair Type / Type | Item Description (if applicable) | Quantity | Unit/Location
  // For generic category pages: Item Code | Category | Quantity | Unit/Location
  const columns = [
    ...(activeSubTypeSlug
      ? [{
          header: 'No.',
          accessor: '_seq_no',
          tabular: true,
          render: (_row, index) => (
            <span className="font-mono text-slate text-xs">{(index ?? 0) + 1}</span>
          )
        }]
      : []
    ),
    {
      header: 'Serial No.',
      accessor: 'item_code',
      tabular: true,
      render: (row, _idx, meta) => {
        const isBatch = isBatchItem(row);
        if (isBatch) {
          return (
            <div className="flex items-start gap-2 select-none group/batch">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.toggleExpand?.();
                }}
                className={`mt-0.5 p-1 -ml-1 rounded hover:bg-surface text-slate group-hover/batch:text-signal transition-transform duration-150 inline-flex items-center justify-center ${
                  meta?.isExpanded ? 'rotate-90 text-signal font-bold' : ''
                }`}
                title={meta?.isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  meta?.toggleExpand?.();
                }}
                className="cursor-pointer py-0.5"
                title="Click to expand/collapse batch serial numbers"
              >
                <div className="font-semibold text-ink text-xs group-hover/batch:text-signal transition-colors">
                  {row.batch_label || `${row.sub_classification || row.item_name} Batch (Multi-Serial)`}
                </div>
              </div>
            </div>
          );
        }
        return (
          <span className="font-mono font-medium text-ink text-xs">{row.item_code}</span>
        );
      }
    },
    {
      header: 'Manufacturer S/N',
      accessor: 'serial_number',
      tabular: true,
      render: (row) => {
        const isBatch = isBatchItem(row);
        if (isBatch) {
          return <span className="text-slate text-xs font-mono select-none">—</span>;
        }
        return (
          <span className="font-mono text-ink text-xs">
            {row.serial_number?.trim() ? row.serial_number : '—'}
          </span>
        );
      }
    },
    ...(activeSubTypeSlug
      ? [{
          header: typeLabel,
          accessor: 'sub_classification',
          render: (row) => {
            const val = row.sub_classification || row.item_name || '';
            const normalized = val === 'Computer Executive' ? 'Computer Executive Chair'
              : val === 'Computer Typist' ? 'Computer Typist Chair'
              : val === 'Computer Assistant' ? 'Computer Assistant Chair'
              : val;
            return (
              <span className="font-medium text-ink">
                {normalized}
              </span>
            );
          }
        }]
      : [{
          header: 'Category',
          accessor: 'category',
          render: (row) => (
            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-surface border border-line text-slate">
              {row.category}
            </span>
          )
        }]
    ),
    ...(hasBrandField && activeSubTypeSlug
      ? [{
          header: 'Brand Name',
          accessor: 'brand',
          render: (row) => (
            <span className="font-medium text-ink text-xs">
              {row.brand || '—'}
            </span>
          )
        }]
      : []
    ),
    ...(hasDescriptionField && activeSubTypeSlug
      ? [{
          header: 'Item Description',
          accessor: 'description',
          render: (row) => (
            <span className="text-slate text-xs line-clamp-2 max-w-xs font-normal" title={row.description || ''}>
              {row.description || '—'}
            </span>
          )
        }]
      : []
    ),
    {
      header: 'Quantity',
      accessor: 'quantity',
      align: 'right',
      tabular: true,
      render: (row) => (
        <span className="font-semibold text-ink">{formatNumber(row.quantity)}</span>
      )
    },
    {
      header: 'Unit / Location',
      accessor: 'unit_name',
      render: (row) => (
        <span className="text-slate text-[11px]">{row.unit_name}</span>
      )
    }
  ];

  const searchFieldOptions = activeSubTypeSlug ? [
    { value: 'all', label: 'All Fields' },
    { value: 'item_code', label: 'Serial No.' },
    { value: 'serial_number', label: 'Manufacturer S/N' },
    { value: 'type', label: typeLabel },
    ...(hasBrandField ? [{ value: 'brand', label: 'Brand Name' }] : []),
    ...(hasDescriptionField ? [{ value: 'description', label: 'Item Description' }] : [])
  ] : [
    { value: 'all', label: 'All Fields' },
    { value: 'item_code', label: 'Serial No.' },
    { value: 'serial_number', label: 'Manufacturer S/N' },
    { value: 'category', label: 'Category' }
  ];

  const categoryDisplayName = currentCategory?.name || (categoryId ? categoryId.replace(/-/g, ' ') : 'Category');

  // Breadcrumbs: Include sub-type if selected
  const breadcrumbs = [
    { label: 'Inventory', path: '/inventory' },
    { label: 'Item Categories', path: '/inventory/categories' }
  ];
  if (activeSubType) {
    breadcrumbs.push({
      label: categoryDisplayName,
      path: `/inventory/category/${categorySlug || categoryId}`
    });
    breadcrumbs.push({ label: activeSubType.name });
  } else {
    breadcrumbs.push({ label: categoryDisplayName });
  }

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-md bg-signal/15 text-signal flex items-center justify-center">
              <Tag className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-xl font-semibold text-ink tracking-tight capitalize">
              {activeSubType ? activeSubType.name : categoryDisplayName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/inventory/categories"
            className="px-3 py-1.5 bg-surface hover:bg-card text-slate hover:text-ink text-xs font-medium rounded border border-line transition-colors flex items-center gap-1.5"
            title="Manage all categories, requirements, and settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage Categories</span>
          </Link>

          {canWrite && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-1.5 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-signal" />
              <span>Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Types Card Grid View (when category has sub-types and no specific sub-type is selected) */}
      {availableSubTypes.length > 0 && !activeSubTypeSlug ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableSubTypes.map((st) => {
            const subItems = items.filter(i => itemMatchesSubType(i, st.slug));
            const itemCount = subItems.length;
            const totalQty = subItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            const targetPath = `/inventory/category/${categorySlug}/${st.slug}`;

            return (
              <div
                key={st.slug}
                id={`card-subtype-${st.slug}`}
                onClick={() => navigate(targetPath)}
                className="bg-card hover:bg-surface/50 rounded-xl border border-line p-5 shadow-card hover:border-signal/50 hover:shadow-subtle transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-slate group-hover:text-signal group-hover:border-signal/30 transition-colors">
                      <Tag className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-semibold text-ink group-hover:text-signal transition-colors">
                      {st.name}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[11px]">
                  <Link
                    to={targetPath}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-signal hover:underline flex items-center gap-1 group/btn py-0.5"
                  >
                    <span>View Items</span>
                    <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Filtered or Flat Item Table */
        <div>


          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            onAdd={canWrite ? handleOpenAdd : null}
            onEdit={canWrite ? handleOpenEdit : null}
            onDelete={canWrite ? handleDelete : null}
            addLabel="+ Add Item"
            renderExpandedRow={(row) => <BatchSerialSubTable item={row} />}
            isRowExpandable={(row) => isBatchItem(row)}
            searchFieldOptions={searchFieldOptions}
            searchPlaceholder={activeSubType ? `Search within ${activeSubType.name}...` : `Search within ${categoryDisplayName}...`}
            emptyMessage={activeSubType ? `No inventory items found under "${activeSubType.name}".` : `No inventory items found in category "${categoryDisplayName}".`}
          />
        </div>
      )}

      {/* Bottom Back Button */}
      <BackButton
        to={activeSubType ? `/inventory/category/${categorySlug || categoryId}` : '/inventory/categories'}
        id="btn-back-category"
      />

      {/* Add / Edit Item Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? (subMeta ? `Edit ${subMeta.singularTitle} Item` : `Edit ${categoryDisplayName} Item`)
            : (subMeta ? `Add New ${subMeta.singularTitle} Item` : `Add New ${categoryDisplayName} Item`)
        }
        onSubmit={handleSave}
        submitLabel={editingItem ? 'Update Item' : 'Add Item'}
        loading={modalLoading}
      >
        <div className="space-y-4 text-xs">
          {subMeta ? (
            <>
              {/* Row 1: No. & Serial No. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">
                    No.
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={formData.seq_no || 1}
                    className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate font-mono font-medium cursor-not-allowed select-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">
                    Serial No.
                  </label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={
                      !editingItem && formData.quantity > 1 && batchSerials.length > 1
                        ? `${batchSerials[0]} to ...-${batchSerials[batchSerials.length - 1].split('-').pop()}`
                        : formData.item_code
                    }
                    className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate font-mono font-semibold cursor-not-allowed select-none tracking-wide text-xs"
                  />
                  {!editingItem && formData.quantity > 1 && (
                    <div className="mt-1 text-[11px] text-signal font-medium">
                      Batch: {formData.quantity} sequential serial numbers will be generated
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Category & Type (e.g. Chair Type) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Category</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={categoryDisplayName}
                    className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate cursor-not-allowed font-medium select-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">
                    {typeLabel} <span className="text-signal">*</span>
                  </label>
                  {subMeta.subTypeOptions ? (
                    <select
                      id="item-type-select"
                      value={formData.chair_type || subMeta.subTypeOptions[0]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          chair_type: val,
                          item_name: val
                        }));
                      }}
                      className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
                    >
                      {editingItem && formData.chair_type && !subMeta.subTypeOptions.includes(formData.chair_type) && (
                        <option value={formData.chair_type} disabled>
                          {formData.chair_type} (Current / Unmapped)
                        </option>
                      )}
                      {subMeta.subTypeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={`e.g. ${typeLabel}`}
                      value={formData.chair_type}
                      onChange={(e) => setFormData(p => ({ ...p, chair_type: e.target.value, item_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
                    />
                  )}
                </div>
              </div>

              {/* Row: Brand Name */}
              {hasBrandField && (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Brand Name <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    id="brand-name-input"
                    type="text"
                    placeholder="e.g. Cisco, TP-Link, MikroTik, Ubiquiti, Huawei..."
                    value={formData.brand || ''}
                    onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink text-xs font-medium"
                  />
                </div>
              )}

              {/* Row: Item Description (Only for IT & selected Network subcategories) */}
              {hasDescriptionField && (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Item Description <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  {activeSubTypeSlug === 'cameras' ? (
                    <input
                      type="text"
                      placeholder="e.g. Outdoor Bullet Camera 4MP"
                      value={formData.description || ''}
                      onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink text-xs font-medium"
                    />
                  ) : (
                    <textarea
                      rows={2}
                      placeholder="e.g. Condition, model detail, extra specs..."
                      value={formData.description || ''}
                      onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                      className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink text-xs resize-none"
                    />
                  )}
                </div>
              )}

              {/* Row 3: Quantity */}
              <div>
                <label className="block font-medium text-ink mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
                />
              </div>

              {/* Manufacturer S/N: Single input if quantity === 1, or per-unit inputs if quantity > 1 */}
              {formData.quantity > 1 ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-medium text-ink">
                      Manufacturer S/N per Unit <span className="text-slate text-[11px] font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11px] text-slate font-medium">
                      {formData.quantity} Units
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-line bg-surface/40 p-2.5">
                    {Array.from({ length: formData.quantity }).map((_, idx) => {
                      const assignedSerial = batchSerials?.[idx] || '';
                      return (
                        <div key={idx} className="flex items-center gap-2.5 bg-card p-2 rounded border border-line">
                          <div className="w-16 shrink-0">
                            <span className="text-xs font-semibold text-ink block">Unit {idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder={`Unit ${idx + 1} Manufacturer S/N (Optional)`}
                              value={formData.manufacturer_serial_numbers?.[idx] || ''}
                              onChange={(e) => handleUnitMfgChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate">
                    Enter individual manufacturer serial numbers per unit if available (all optional).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Manufacturer S/N <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-2024-8849"
                    value={formData.serial_number || formData.manufacturer_serial_numbers?.[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(p => ({
                        ...p,
                        serial_number: val,
                        manufacturer_serial_numbers: [val]
                      }));
                    }}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Fallback for generic category items */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Item Name / Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ergonomic Office Desk"
                    value={formData.item_name}
                    onChange={(e) => setFormData(p => ({ ...p, item_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">Serial No.</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DGM(WPSII)/CE(COM)/..."
                    value={formData.item_code}
                    onChange={(e) => setFormData(p => ({ ...p, item_code: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-ink mb-1">Category</label>
                  <input
                    type="text"
                    disabled
                    value={categoryDisplayName}
                    className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate cursor-not-allowed font-medium"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
                  />
                </div>
              </div>

              {hasBrandField && (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Brand Name <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cisco, TP-Link, MikroTik, Ubiquiti..."
                    value={formData.brand || ''}
                    onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink text-xs font-medium"
                  />
                </div>
              )}

              {hasDescriptionField && (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Item Description <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Condition, model detail, extra specs..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink text-xs resize-none"
                  />
                </div>
              )}

              {availableSubTypes.length > 0 && (
                <div>
                  <label className="block font-medium text-ink mb-1">Sub-Type / Classification</label>
                  <select
                    value={formData.sub_type || ''}
                    onChange={(e) => setFormData(p => ({ ...p, sub_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
                  >
                    <option value="">-- None / General ({categoryDisplayName}) --</option>
                    {availableSubTypes.map(st => (
                      <option key={st.slug} value={st.slug}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manufacturer S/N in fallback */}
              {formData.quantity > 1 ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-medium text-ink">
                      Manufacturer S/N per Unit <span className="text-slate text-[11px] font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11px] text-slate font-medium">
                      {formData.quantity} Units
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-line bg-surface/40 p-2.5">
                    {Array.from({ length: formData.quantity }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 bg-card p-2 rounded border border-line">
                        <div className="w-20 shrink-0">
                          <span className="text-xs font-semibold text-ink block">Unit {idx + 1}</span>
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder={`Unit ${idx + 1} Manufacturer S/N (Optional)`}
                            value={formData.manufacturer_serial_numbers?.[idx] || ''}
                            onChange={(e) => handleUnitMfgChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-ink mb-1">
                    Manufacturer S/N <span className="text-slate text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-2024-8849"
                    value={formData.serial_number || formData.manufacturer_serial_numbers?.[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(p => ({
                        ...p,
                        serial_number: val,
                        manufacturer_serial_numbers: [val]
                      }));
                    }}
                    className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
                  />
                </div>
              )}


            </>
          )}
        </div>
      </RecordModal>
    </AppShell>
  );
};
