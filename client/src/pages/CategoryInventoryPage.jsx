import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/common/DataTable';
import { RecordModal } from '../components/common/RecordModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatNumber } from '../utils/formatters';
import {
  CATEGORY_SUBTYPES,
  SUBTYPE_METADATA,
  generateNextItemCode,
  itemMatchesSubType,
  getCategorySubtypes,
  registerCustomSubtypes,
  unregisterCustomSubtype,
  syncCategoryCustomSubtypes,
  getSubTypeOptions,
  registerCustomItemTypes,
  syncCustomItemTypes,
  getCustomItemTypes,
  unregisterCustomItemType
} from '../constants/categorySubtypes';
import {
  generateSerialNumber,
  generateBatchSerialNumbers,
  isBatchItem,
  generateUniqueTypeCodes,
  registerCustomItemTypeCode,
  resolveSubCategoryCode
} from '../utils/serialNumberGenerator';
import { canManageCategoryTypes } from '../utils/permissions';
import { BatchSerialSubTable } from '../components/inventory/BatchSerialSubTable';
import { BackButton } from '../components/common/BackButton';
import { AddButton } from '../components/ui/AddButton';
import { Button } from '../components/common/Button';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { Tag, ShieldAlert, CheckCircle2, Settings, ArrowRight, Boxes, Plus, Filter, X, ChevronRight, AlertCircle, Trash2, Pencil, RotateCcw, ArrowLeft, Loader2 } from 'lucide-react';

export const slugifyCategory = (name) => {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export const CategoryInventoryPage = () => {
  const { categoryId, subType: paramSubType } = useParams();
  const [searchParams] = useSearchParams();
  const querySubType = searchParams.get('type') || searchParams.get('sub_type') || null;
  const activeSubTypeSlug = paramSubType || querySubType || null;

  const navigate = useNavigate();
  const { user, selectedUnitId, selectedUnit, canWrite, can } = useAuth();
  const canManageTypes = canManageCategoryTypes(user);
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
  const categoryDisplayName = currentCategory?.name || (categoryId ? categoryId.replace(/-/g, ' ') : 'Category');
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

  // New Type Modal & Custom Subtypes State
  const [customTypes, setCustomTypes] = useState([]);
  const [addTypeModalOpen, setAddTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeFieldError, setNewTypeFieldError] = useState('');
  const [addTypeError, setAddTypeError] = useState('');
  const [addTypeSubmitting, setAddTypeSubmitting] = useState(false);
  const [highlightedTypeSlug, setHighlightedTypeSlug] = useState(null);
  const newTypeNameInputRef = useRef(null);

  // Edit Type Modal State
  const [editingType, setEditingType] = useState(null);
  const [editTypeModalOpen, setEditTypeModalOpen] = useState(false);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeDescription, setEditTypeDescription] = useState('');
  const [editTypeFieldError, setEditTypeFieldError] = useState('');
  const [editTypeError, setEditTypeError] = useState('');
  const [editTypeSubmitting, setEditTypeSubmitting] = useState(false);

  // Custom Item Types within Subcategory (e.g. Bench under Chairs)
  const [customItemTypes, setCustomItemTypes] = useState([]);
  const [showInlineAddType, setShowInlineAddType] = useState(false);
  const [inlineTypeName, setInlineTypeName] = useState('');
  const [inlineTypeLoading, setInlineTypeLoading] = useState(false);
  const [inlineTypeError, setInlineTypeError] = useState('');

  // Modal State for Managing Subcategory Item Types
  const [isManageItemTypesModalOpen, setIsManageItemTypesModalOpen] = useState(false);
  const [editingItemType, setEditingItemType] = useState(null);
  const [editItemTypeName, setEditItemTypeName] = useState('');
  const [editItemTypeLoading, setEditItemTypeLoading] = useState(false);
  const [editItemTypeError, setEditItemTypeError] = useState('');
  const [deletingItemTypeId, setDeletingItemTypeId] = useState(null);
  const [manageItemTypesError, setManageItemTypesError] = useState('');

  // Delete Sub-Category State
  const [deletingSubCategory, setDeletingSubCategory] = useState(null);
  const [deleteSubCategoryModalOpen, setDeleteSubCategoryModalOpen] = useState(false);
  const [deleteSubCategoryLoading, setDeleteSubCategoryLoading] = useState(false);
  const [isDeleteSubCategoryBlocked, setIsDeleteSubCategoryBlocked] = useState(false);
  const [deleteSubCategoryBlockReason, setDeleteSubCategoryBlockReason] = useState('');

  const availableSubTypes = useMemo(() => {
    const base = getCategorySubtypes(categorySlug);
    const combined = [...base];
    (customTypes || []).forEach(ct => {
      if (ct.is_active === false) {
        const idx = combined.findIndex(b => b.slug === ct.slug || (ct.original_slug && b.slug === ct.original_slug));
        if (idx >= 0) combined.splice(idx, 1);
        return;
      }
      const existingIdx = combined.findIndex(b => b.slug === ct.slug || (ct.original_slug && b.slug === ct.original_slug));
      if (existingIdx >= 0) {
        combined[existingIdx] = { ...combined[existingIdx], ...ct };
      } else if (!combined.some(b => b.name.toLowerCase() === ct.name.toLowerCase())) {
        combined.push(ct);
      }
    });
    return combined;
  }, [categorySlug, customTypes]);

  const activeSubType = useMemo(() => {
    if (!activeSubTypeSlug) return null;
    return availableSubTypes.find(
      s => s.slug === activeSubTypeSlug || s.slug?.toLowerCase() === activeSubTypeSlug.toLowerCase()
    ) || {
      name: activeSubTypeSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      slug: activeSubTypeSlug
    };
  }, [availableSubTypes, activeSubTypeSlug]);

  const isTypeNotFound = !loading && Boolean(activeSubTypeSlug) && !availableSubTypes.some(
    s => s.slug === activeSubTypeSlug || s.slug?.toLowerCase() === activeSubTypeSlug.toLowerCase()
  );

  const resolvedSubMeta = useMemo(() => {
    if (!activeSubTypeSlug) return null;
    let base = SUBTYPE_METADATA[activeSubTypeSlug];
    if (!base) {
      const found = availableSubTypes.find(
        s => s.slug === activeSubTypeSlug || s.slug?.toLowerCase() === activeSubTypeSlug.toLowerCase()
      );
      if (!found) return null;

      const typeName = found.name || activeSubTypeSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const codePrefix = found.sub_category_code || found.code || typeName.substring(0, 3).toUpperCase();
      base = {
        codePrefix,
        singularTitle: typeName,
        subTypeFieldLabel: `${typeName} Type`,
        subTypeOptions: [typeName],
        isGeneric: true
      };
    }
    const merged = getSubTypeOptions(activeSubTypeSlug);
    return {
      ...base,
      subTypeOptions: (merged && merged.length > 0) ? merged : (base.subTypeOptions || [])
    };
  }, [activeSubTypeSlug, availableSubTypes, customItemTypes]);

  const subMeta = resolvedSubMeta;
  const [fetchError, setFetchError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [catsRes, typesRes] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/types', { category: categorySlug })
      ]);

      if (catsRes.success && catsRes.data) {
        setCategories(catsRes.data);
      }

      if (typesRes.success && Array.isArray(typesRes.data)) {
        setCustomTypes(typesRes.data);
        syncCategoryCustomSubtypes(categorySlug, typesRes.data);
      }

      // Fetch custom item types for this subcategory (e.g. Bench under Chairs)
      if (activeSubTypeSlug) {
        try {
          const itemTypesRes = await api.get('/inventory/item-types', { subcategory: activeSubTypeSlug });
          if (itemTypesRes.success && Array.isArray(itemTypesRes.itemTypes)) {
            setCustomItemTypes(itemTypesRes.itemTypes);
            syncCustomItemTypes(activeSubTypeSlug, itemTypesRes.itemTypes);
            itemTypesRes.itemTypes.forEach(t => {
              if (t.code) {
                try {
                  registerCustomItemTypeCode(activeSubTypeSlug, t.name, t.code);
                } catch {
                  // ignore
                }
              }
            });
          }
        } catch (itemTypesErr) {
          console.warn('Failed to load subcategory item types:', itemTypesErr);
        }
      }

      // Fetch items for this unit and category
      const params = {};
      if (selectedUnitId && selectedUnitId !== 'all') {
        params.unit_id = selectedUnitId;
      }
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
      setFetchError(err.message || 'Failed to load category inventory.');
      toast.error(err.message || 'Failed to load category inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [categoryId, activeSubTypeSlug, selectedUnitId]);

  // Deep-link / action parameter protection: redirect unauthorised attempts
  useEffect(() => {
    const action = searchParams.get('action');
    const addParam = searchParams.get('add');
    if (action === 'add-type' || addParam === 'type' || action === 'manage-type') {
      if (!canManageTypes) {
        toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
        navigate(`/inventory/category/${categorySlug}`, { replace: true });
      } else if (!activeSubTypeSlug) {
        handleOpenAddType();
      }
    }
  }, [searchParams, canManageTypes, activeSubTypeSlug, categorySlug]);

  const validateNewTypeName = (rawName) => {
    const trimmed = (rawName || '').trim();
    if (!trimmed) {
      setNewTypeFieldError('Type name is required.');
      return false;
    }
    if (trimmed.length < 2) {
      setNewTypeFieldError('Type name must be at least 2 characters.');
      return false;
    }
    if (trimmed.length > 60) {
      setNewTypeFieldError('Type name cannot exceed 60 characters.');
      return false;
    }
    if (/<[^>]*>/i.test(trimmed)) {
      setNewTypeFieldError('HTML tags are not allowed in type name.');
      return false;
    }
    const norm = trimmed.toLowerCase();
    const slug = norm.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const isDuplicate = availableSubTypes.some(
      st => st.name.trim().toLowerCase() === norm || st.slug === slug
    );
    if (isDuplicate) {
      setNewTypeFieldError(`This type already exists in ${categoryDisplayName}.`);
      return false;
    }
    setNewTypeFieldError('');
    return true;
  };

  // Derive unique sub_category_code and item_type_code automatically from name
  const generatedCodes = useMemo(() => {
    if (!newTypeName.trim()) return { sub_category_code: '', item_type_code: '' };
    return generateUniqueTypeCodes({
      typeName: newTypeName,
      category: categoryDisplayName,
      existingTypes: availableSubTypes
    });
  }, [newTypeName, categoryDisplayName, availableSubTypes]);

  const handleOpenAddType = () => {
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    setNewTypeName('');
    setNewTypeDescription('');
    setNewTypeFieldError('');
    setAddTypeError('');
    setAddTypeModalOpen(true);
    setTimeout(() => {
      newTypeNameInputRef.current?.focus();
    }, 50);
  };

  const handleCloseAddTypeModal = () => {
    setAddTypeModalOpen(false);
    setNewTypeName('');
    setNewTypeDescription('');
    setNewTypeFieldError('');
    setAddTypeError('');
  };

  const handleSaveNewType = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (addTypeSubmitting) return;

    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      setAddTypeModalOpen(false);
      return;
    }

    if (!validateNewTypeName(newTypeName)) {
      newTypeNameInputRef.current?.focus();
      return;
    }

    const trimmed = newTypeName.trim();
    setAddTypeSubmitting(true);
    setAddTypeError('');

    try {
      const res = await api.post('/inventory/types', {
        name: trimmed,
        category: categoryDisplayName,
        category_id: currentCategory?.id || null,
        sub_category_code: generatedCodes.sub_category_code,
        item_type_code: generatedCodes.item_type_code,
        description: newTypeDescription.trim()
      });

      if (res.success && res.data) {
        const created = res.data;
        registerCustomSubtypes([created]);
        setCustomTypes(prev => {
          if (prev.some(t => t.slug === created.slug)) return prev;
          return [...prev, created];
        });

        setAddTypeModalOpen(false);
        setNewTypeName('');
        setNewTypeDescription('');
        setNewTypeFieldError('');
        setAddTypeError('');
        toast.success('Type added successfully.');

        setHighlightedTypeSlug(created.slug);
        setTimeout(() => {
          setHighlightedTypeSlug(null);
        }, 1500);
      } else {
        setAddTypeError(res.message || 'Failed to add type.');
      }
    } catch (err) {
      setAddTypeError(err.message || 'Failed to add type.');
    } finally {
      setAddTypeSubmitting(false);
    }
  };

  const handleOpenEditType = (e, typeItem) => {
    e.stopPropagation();
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    setEditingType(typeItem);
    setEditTypeName(typeItem.name || '');
    setEditTypeDescription(typeItem.description || '');
    setEditTypeFieldError('');
    setEditTypeError('');
    setEditTypeModalOpen(true);
  };

  const handleSaveEditType = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (editTypeSubmitting || !editingType) return;

    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      setEditTypeModalOpen(false);
      return;
    }

    const trimmed = editTypeName.trim();
    if (!trimmed) {
      setEditTypeFieldError('Type name is required.');
      return;
    }
    if (trimmed.length < 2) {
      setEditTypeFieldError('Type name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 60) {
      setEditTypeFieldError('Type name cannot exceed 60 characters.');
      return;
    }
    if (/<[^>]*>/i.test(trimmed)) {
      setEditTypeFieldError('HTML tags are not allowed in type name.');
      return;
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-/&().]+$/;
    if (!validCharsRegex.test(trimmed)) {
      setEditTypeFieldError('Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.');
      return;
    }

    // Duplicate check within same category
    const isDuplicate = availableSubTypes.some(
      s => (s.id ? s.id !== editingType.id : s.slug !== editingType.slug) &&
        s.name?.toLowerCase().trim() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setEditTypeFieldError(`This type already exists in ${categoryDisplayName}`);
      return;
    }

    setEditTypeSubmitting(true);
    setEditTypeError('');

    try {
      const targetId = editingType.id || editingType.slug;
      const res = await api.put(`/inventory/types/${targetId}`, {
        name: trimmed,
        description: editTypeDescription.trim()
      });

      if (res.success) {
        const updated = res.data || { ...editingType, name: trimmed, description: editTypeDescription.trim() };
        registerCustomSubtypes([updated]);
        setCustomTypes(prev => {
          const exists = prev.some(t => t.id === updated.id || t.slug === updated.slug);
          if (exists) {
            return prev.map(t => (t.id === updated.id || t.slug === updated.slug) ? { ...t, ...updated } : t);
          }
          return [...prev, updated];
        });
        setEditTypeModalOpen(false);
        setEditingType(null);
        toast.success('Updated successfully.');
        fetchData();
      } else {
        setEditTypeError(res.message || 'Failed to update type.');
      }
    } catch (err) {
      setEditTypeError(err.message || 'Failed to update type.');
    } finally {
      setEditTypeSubmitting(false);
    }
  };

  const handleOpenDeleteSubCategory = (e, typeItem) => {
    e?.stopPropagation?.();
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    setDeletingSubCategory(typeItem);
    setDeleteSubCategoryModalOpen(true);

    const subItems = items.filter(i => itemMatchesSubType(i, typeItem.slug));
    const itemCount = subItems.length;
    const isBuiltin = !typeItem.is_custom;

    if (itemCount > 0) {
      setIsDeleteSubCategoryBlocked(true);
      setDeleteSubCategoryBlockReason(
        `${typeItem.name} has ${itemCount} item${itemCount === 1 ? '' : 's'}. Remove or move them first.`
      );
    } else if (isBuiltin && user?.role !== 'super_admin') {
      setIsDeleteSubCategoryBlocked(true);
      setDeleteSubCategoryBlockReason('Only Super Admin can delete built-in sub-categories.');
    } else {
      setIsDeleteSubCategoryBlocked(false);
      setDeleteSubCategoryBlockReason('');
    }
  };

  const handleConfirmDeleteSubCategory = async () => {
    if (!deletingSubCategory || isDeleteSubCategoryBlocked || deleteSubCategoryLoading) return;
    setDeleteSubCategoryLoading(true);
    try {
      const targetId = deletingSubCategory.id || deletingSubCategory.slug;
      const res = await api.delete(`/inventory/types/${targetId}`);
      if (res.success) {
        unregisterCustomSubtype(deletingSubCategory.id || deletingSubCategory.slug);
        setCustomTypes(prev => prev.filter(t => t.id !== targetId && t.slug !== targetId));
        toast.success(`Sub-category '${deletingSubCategory.name}' removed.`);
        setDeleteSubCategoryModalOpen(false);
        const wasActive = activeSubTypeSlug === deletingSubCategory.slug;
        setDeletingSubCategory(null);
        if (wasActive) {
          navigate(`/inventory/category/${categorySlug}`);
        } else {
          fetchData();
        }
      } else {
        toast.error(res.message || 'Failed to remove sub-category.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to remove sub-category.');
    } finally {
      setDeleteSubCategoryLoading(false);
    }
  };

  // --- Subcategory Custom Item Types (e.g. "Bench" under Chairs) ---
  const validateInlineTypeName = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return 'Type name is required.';
    }
    if (trimmed.length < 2) {
      return 'Type name must be at least 2 characters.';
    }
    if (trimmed.length > 60) {
      return 'Type name cannot exceed 60 characters.';
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-\/&().]+$/;
    if (!validCharsRegex.test(trimmed)) {
      return 'Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.';
    }
    const existingOptions = getSubTypeOptions(activeSubTypeSlug);
    const isDuplicate = existingOptions.some(
      opt => opt.toLowerCase().trim() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return 'This type already exists.';
    }
    return null;
  };

  const handleSaveInlineType = async () => {
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    const trimmed = inlineTypeName.trim();
    const errorMsg = validateInlineTypeName(trimmed);
    if (errorMsg) {
      if (errorMsg === 'This type already exists.') {
        const existingOptions = getSubTypeOptions(activeSubTypeSlug);
        const match = existingOptions.find(opt => opt.toLowerCase().trim() === trimmed.toLowerCase());
        if (match) {
          setFormData(prev => ({
            ...prev,
            chair_type: match,
            item_name: match
          }));
        }
      }
      setInlineTypeError(errorMsg);
      return;
    }

    setInlineTypeLoading(true);
    setInlineTypeError('');
    try {
      const res = await api.post('/inventory/item-types', {
        subcategory_slug: activeSubTypeSlug,
        name: trimmed,
        category_slug: categorySlug
      });

      if (res.success && res.data) {
        toast.success('Type added.');
        registerCustomItemTypeCode(activeSubTypeSlug, res.data.name, res.data.code);
        registerCustomItemTypes(activeSubTypeSlug, [res.data]);
        setCustomItemTypes(prev => [...prev.filter(t => t.id !== res.data.id), res.data]);

        setFormData(prev => ({
          ...prev,
          chair_type: res.data.name,
          item_name: res.data.name
        }));

        setShowInlineAddType(false);
        setInlineTypeName('');
        setInlineTypeError('');
      } else {
        setInlineTypeError(res.message || 'Failed to add type.');
      }
    } catch (err) {
      setInlineTypeError(err.message || 'Failed to add type.');
    } finally {
      setInlineTypeLoading(false);
    }
  };

  const handleSaveRenameItemType = async () => {
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    if (!editingItemType) return;
    const trimmed = editItemTypeName.trim();
    if (!trimmed) {
      setEditItemTypeError('Type name is required.');
      return;
    }
    if (trimmed.length < 2) {
      setEditItemTypeError('Type name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 60) {
      setEditItemTypeError('Type name cannot exceed 60 characters.');
      return;
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-\/&().]+$/;
    if (!validCharsRegex.test(trimmed)) {
      setEditItemTypeError('Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.');
      return;
    }

    setEditItemTypeLoading(true);
    setEditItemTypeError('');
    try {
      const res = await api.put(`/inventory/item-types/${editingItemType.id}`, {
        name: trimmed
      });
      if (res.success && res.data) {
        toast.success(`Type renamed to "${res.data.name}".`);
        const updated = res.data;
        const updatedList = customItemTypes.map(t => t.id === updated.id ? updated : t);
        setCustomItemTypes(updatedList);
        syncCustomItemTypes(activeSubTypeSlug, updatedList);
        if (updated.code) {
          registerCustomItemTypeCode(activeSubTypeSlug, updated.name, updated.code);
        }
        setEditingItemType(null);
        setEditItemTypeName('');
      } else {
        setEditItemTypeError(res.message || 'Failed to rename type.');
      }
    } catch (err) {
      setEditItemTypeError(err.message || 'Failed to rename type.');
    } finally {
      setEditItemTypeLoading(false);
    }
  };

  const handleDeleteItemType = async (typeObj) => {
    if (!canManageTypes) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    if (!typeObj?.id) return;
    if (!window.confirm(`Are you sure you want to delete the "${typeObj.name}" type?`)) {
      return;
    }
    setDeletingItemTypeId(typeObj.id);
    setManageItemTypesError('');
    try {
      const res = await api.delete(`/inventory/item-types/${typeObj.id}`);
      if (res.success) {
        toast.success(`Type "${typeObj.name}" deleted.`);
        const remaining = customItemTypes.filter(t => t.id !== typeObj.id);
        setCustomItemTypes(remaining);
        unregisterCustomItemType(activeSubTypeSlug, typeObj.id);
      } else {
        setManageItemTypesError(res.message || 'Failed to delete type.');
      }
    } catch (err) {
      setManageItemTypesError(err.message || 'Cannot delete item type.');
    } finally {
      setDeletingItemTypeId(null);
    }
  };

  const typeLabel = subMeta?.subTypeFieldLabel || (subMeta?.singularTitle ? `${subMeta.singularTitle} Type` : (activeSubType ? `${activeSubType.name.replace(/s$/i, '')} Type` : 'Type'));

  const handleOpenAdd = () => {
    setEditingItem(null);
    setShowInlineAddType(false);
    setInlineTypeName('');
    setInlineTypeError('');
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
    setShowInlineAddType(false);
    setInlineTypeName('');
    setInlineTypeError('');
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
          width: 56,
          minWidth: 56,
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
      width: 400,
      minWidth: 400,
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
                className={`w-[26px] h-[26px] rounded-[7px] hover:bg-surface text-slate group-hover/batch:text-signal transition-transform duration-150 inline-flex items-center justify-center shrink-0 ${
                  meta?.isExpanded ? 'rotate-90 text-signal font-bold' : ''
                }`}
                title={meta?.isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
                aria-label={meta?.isExpanded ? 'Collapse batch serials' : 'Expand batch serials'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
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
          <span className="font-mono font-medium text-ink text-xs whitespace-nowrap">{row.item_code}</span>
        );
      }
    },
    {
      header: 'Manufacturer S/N',
      accessor: 'serial_number',
      tabular: true,
      width: 150,
      minWidth: 150,
      render: (row) => {
        const isBatch = isBatchItem(row);
        if (isBatch) {
          return <span className="text-slate text-xs font-mono select-none">—</span>;
        }
        return (
          <span className="font-mono text-ink text-xs whitespace-nowrap">
            {row.serial_number?.trim() ? row.serial_number : '—'}
          </span>
        );
      }
    },
    ...(activeSubTypeSlug
      ? [{
          header: typeLabel,
          accessor: 'sub_classification',
          width: 170,
          minWidth: 170,
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
          width: 170,
          minWidth: 170,
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
          width: 130,
          minWidth: 130,
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
          width: 220,
          minWidth: 220,
          render: (row) => (
            <span className="text-slate text-xs line-clamp-3 font-normal" title={row.description || ''}>
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
      width: 90,
      minWidth: 90,
      render: (row) => (
        <span className="font-semibold text-ink">{formatNumber(row.quantity)}</span>
      )
    },
    {
      header: 'Unit / Location',
      accessor: 'unit_name',
      width: 120,
      minWidth: 120,
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

  // Breadcrumbs: Include sub-type if selected
  const breadcrumbs = [
    { label: 'Inventory', path: '/inventory/categories' },
    { label: 'Item Categories', path: '/inventory/categories' }
  ];
  if (isTypeNotFound) {
    breadcrumbs.push({
      label: categoryDisplayName,
      path: `/inventory/category/${categorySlug || categoryId}`
    });
    breadcrumbs.push({ label: 'Type Not Found' });
  } else if (activeSubType) {
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
            <span className="w-7 h-7 rounded-md bg-[rgba(123,28,62,0.08)] border border-[rgba(123,28,62,0.15)] text-[#7B1C3E] flex items-center justify-center shadow-2xs">
              <Tag className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-xl font-bold text-[#1B1B24] tracking-tight capitalize">
              {isTypeNotFound ? 'Type Not Found' : (activeSubType ? activeSubType.name : categoryDisplayName)}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageTypes && (
            <Button
              to="/inventory/categories"
              variant="secondary"
              size="regular"
              icon={Settings}
              label="Manage Categories"
              title="Manage all categories, requirements, and settings"
            />
          )}

          {activeSubTypeSlug && canManageTypes && (
            <Button
              id="btn-manage-item-types"
              variant="secondary"
              size="regular"
              icon={Tag}
              label="Manage Types"
              onClick={() => {
                setManageItemTypesError('');
                setEditingItemType(null);
                setIsManageItemTypesModalOpen(true);
              }}
              title={`Manage custom item types under ${activeSubType?.name || 'this sub-category'}`}
            />
          )}

          {!isTypeNotFound && ((activeSubTypeSlug && can('add_inventory')) || (!activeSubTypeSlug && canManageTypes)) && (
            <AddButton
              id={activeSubTypeSlug ? "btn-add-item" : "btn-add-type"}
              label={activeSubTypeSlug ? "Add Item" : "Add Type"}
              onClick={activeSubTypeSlug ? handleOpenAdd : handleOpenAddType}
            />
          )}
        </div>
      </div>

      {fetchError && (
        <div role="alert" className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <div className="text-xs font-semibold">Unable to load category inventory data</div>
              <div className="text-[11px] text-red-700">{fetchError}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {isTypeNotFound ? (
        <div className="py-16 text-center flex flex-col items-center justify-center bg-card rounded-xl border border-line p-8 max-w-lg mx-auto my-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-surface border border-line flex items-center justify-center text-slate mb-3">
            <AlertCircle className="w-6 h-6 text-slate" />
          </div>
          <h2 className="text-base font-bold text-ink mb-1.5">Type Not Found</h2>
          <p className="text-xs text-slate mb-6 max-w-sm leading-relaxed">
            The item type &quot;{activeSubTypeSlug}&quot; could not be found under {categoryDisplayName}. It may have been removed or the link is incorrect.
          </p>
          <Button
            to={`/inventory/category/${categorySlug || categoryId}`}
            variant="primary"
            size="regular"
            icon={ArrowLeft}
            label={`Back to ${categoryDisplayName}`}
          />
        </div>
      ) : availableSubTypes.length > 0 && !activeSubTypeSlug ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableSubTypes.map((st) => {
            const subItems = items.filter(i => itemMatchesSubType(i, st.slug));
            const itemCount = subItems.length;
            const totalQty = subItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            const targetPath = `/inventory/category/${categorySlug}/${st.slug}`;
            const isHighlighted = highlightedTypeSlug === st.slug;

            return (
              <div
                key={st.slug}
                id={`card-subtype-${st.slug}`}
                onClick={() => navigate(targetPath)}
                className={`content-card content-card-interactive p-5 flex flex-col justify-between group transition-all duration-500 card-type-enter ${
                  isHighlighted ? 'ring-2 ring-[#E0A75E] shadow-lg scale-[1.02]' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[rgba(123,28,62,0.08)] border border-[rgba(123,28,62,0.15)] flex items-center justify-center text-[#7B1C3E] group-hover:bg-[rgba(123,28,62,0.14)] transition-colors shadow-2xs shrink-0">
                      <Tag className="w-4 h-4 text-[#7B1C3E]" />
                    </div>
                    <h2
                      className="text-sm font-semibold text-[#1B1B24] group-hover:text-[#7B1C3E] transition-colors truncate"
                      title={st.name}
                    >
                      {st.name}
                    </h2>
                    {canManageTypes && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          id={`btn-edit-type-${st.slug}`}
                          onClick={(e) => handleOpenEditType(e, st)}
                          className="w-[26px] h-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate hover:text-signal hover:bg-surface rounded transition-all cursor-pointer"
                          title="Edit sub-category"
                          aria-label="Edit sub-category"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-type-${st.slug}`}
                          onClick={(e) => handleOpenDeleteSubCategory(e, st)}
                          className="w-[26px] h-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate hover:text-[#B4483A] hover:bg-[rgba(180,72,58,0.08)] rounded transition-all cursor-pointer"
                          title="Delete sub-category"
                          aria-label="Delete sub-category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[rgba(27,27,36,0.10)] flex items-center justify-between text-xs font-semibold text-[#7B1C3E]">
                  <Link
                    to={targetPath}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[#7B1C3E] hover:underline flex items-center gap-1.5 group/btn py-0.5"
                  >
                    <span>View Items</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#7B1C3E] group-hover/btn:translate-x-1 motion-reduce:group-hover/btn:translate-x-0 transition-transform" />
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
            onAdd={can('add_inventory') ? handleOpenAdd : null}
            onEdit={can('update_inventory') ? handleOpenEdit : null}
            onDelete={can('delete_inventory') ? handleDelete : null}
            addLabel="Add Item"
            renderExpandedRow={(row) => <BatchSerialSubTable item={row} />}
            isRowExpandable={(row) => isBatchItem(row)}
            searchFieldOptions={searchFieldOptions}
            searchPlaceholder={activeSubType ? `Search within ${activeSubType.name}...` : `Search within ${categoryDisplayName}...`}
            filterKey={activeSubTypeSlug ? "type" : null}
            filterOptions={activeSubTypeSlug ? [
              { value: '', label: `All ${typeLabel}s` },
              ...getSubTypeOptions(activeSubTypeSlug).map(opt => ({ value: opt, label: opt }))
            ] : []}
            emptyMessage={
              activeSubType ? (
                <div className="py-8 text-center flex flex-col items-center justify-center">
                  <p className="text-sm font-medium text-ink mb-1">
                    No items yet under {activeSubType.name}.
                  </p>
                  <p className="text-xs text-slate mb-4">
                    Add your first item under this type to get started.
                  </p>
                  {can('add_inventory') && (
                    <AddButton
                      label="Add Item"
                      onClick={handleOpenAdd}
                    />
                  )}
                </div>
              ) : (
                `No inventory items found in category "${categoryDisplayName}".`
              )
            }
            enableSerialSelection={true}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-ink">
                      {typeLabel} <span className="text-signal">*</span>
                    </label>
                    {canManageTypes && !showInlineAddType && (
                      <button
                        type="button"
                        id="btn-inline-new-type"
                        onClick={() => {
                          setShowInlineAddType(true);
                          setInlineTypeName('');
                          setInlineTypeError('');
                        }}
                        className="text-[11px] text-[#7B1C3E] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer focus:outline-none"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New type</span>
                      </button>
                    )}
                  </div>
                  {subMeta.subTypeOptions ? (
                    <div>
                      <select
                        id="item-type-select"
                        value={formData.chair_type || subMeta.subTypeOptions[0]}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__add_new_type__') {
                            setShowInlineAddType(true);
                            setInlineTypeName('');
                            setInlineTypeError('');
                            return;
                          }
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
                        {(() => {
                          const builtIn = SUBTYPE_METADATA[activeSubTypeSlug]?.subTypeOptions || [];
                          const customNames = customItemTypes.map(c => c.name);
                          if (customNames.length > 0 && builtIn.length > 0) {
                            return (
                              <>
                                <optgroup label="Standard Types">
                                  {builtIn.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Custom Types">
                                  {customNames.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </optgroup>
                              </>
                            );
                          }
                          return subMeta.subTypeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ));
                        })()}
                        {canManageTypes && (
                          <option value="__add_new_type__" className="text-[#7B1C3E] font-semibold">
                            + Add new type...
                          </option>
                        )}
                      </select>

                      {/* Inline New Type Row directly under dropdown */}
                      {showInlineAddType && (
                        <div id="inline-add-type-row" className="mt-2 p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-md animate-in fade-in duration-150">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-ink">New type name</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowInlineAddType(false);
                                setInlineTypeName('');
                                setInlineTypeError('');
                              }}
                              className="text-[11px] text-slate hover:text-ink font-medium cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              id="input-inline-type-name"
                              placeholder="e.g. Bench"
                              value={inlineTypeName}
                              onChange={(e) => {
                                setInlineTypeName(e.target.value);
                                if (inlineTypeError) setInlineTypeError('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveInlineType();
                                }
                              }}
                              className={`flex-1 px-2.5 py-1.5 bg-surface border rounded text-xs text-ink font-medium focus:outline-none ${
                                inlineTypeError ? 'border-red-400 focus:border-red-500' : 'border-line focus:border-signal'
                              }`}
                              autoFocus
                            />
                            <button
                              type="button"
                              id="btn-save-inline-type"
                              disabled={inlineTypeLoading || !inlineTypeName.trim()}
                              onClick={handleSaveInlineType}
                              className="px-3 py-1.5 bg-[#7B1C3E] hover:bg-[#631732] text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                            >
                              {inlineTypeLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>Save type</span>
                            </button>
                          </div>
                          {inlineTypeError && (
                            <div className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1.5" role="alert">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{inlineTypeError}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

      {/* Add New Type Modal */}
      <RecordModal
        isOpen={addTypeModalOpen}
        onClose={handleCloseAddTypeModal}
        title={`Add New ${categoryDisplayName} Type`}
        onSubmit={handleSaveNewType}
        submitLabel="Add Type"
        loading={addTypeSubmitting}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveNewType} className="space-y-4 text-xs">
          {addTypeError && (
            <div
              id="add-type-server-error"
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{addTypeError}</span>
            </div>
          )}

          <div>
            <label htmlFor="input-new-type-name" className="block font-medium text-ink mb-1">
              Type Name <span className="text-[#B4483A]">*</span>
            </label>
            <input
              id="input-new-type-name"
              ref={newTypeNameInputRef}
              type="text"
              autoFocus
              placeholder="e.g. Office Chairs"
              value={newTypeName}
              onChange={(e) => {
                setNewTypeName(e.target.value);
                if (newTypeFieldError) {
                  validateNewTypeName(e.target.value);
                }
                if (addTypeError) {
                  setAddTypeError('');
                }
              }}
              onBlur={() => validateNewTypeName(newTypeName)}
              aria-describedby={
                newTypeFieldError
                  ? 'new-type-name-error'
                  : addTypeError
                  ? 'add-type-server-error'
                  : undefined
              }
              aria-invalid={Boolean(newTypeFieldError || addTypeError)}
              className={`w-full px-3 py-2 bg-surface border rounded focus:outline-none text-ink text-xs font-medium transition-colors ${
                newTypeFieldError ? 'border-[#B4483A] focus:border-[#B4483A]' : 'border-line focus:border-signal'
              }`}
            />
            {newTypeFieldError && (
              <p id="new-type-name-error" className="mt-1 text-[11px] text-[#B4483A] font-medium">
                {newTypeFieldError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-new-type-subcat-code" className="block font-medium text-ink mb-1">
                Sub-Category Code <span className="text-slate font-normal">(Auto)</span>
              </label>
              <input
                id="input-new-type-subcat-code"
                type="text"
                disabled
                readOnly
                value={generatedCodes.sub_category_code || '—'}
                className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-ink font-mono font-semibold cursor-not-allowed select-none text-xs"
              />
            </div>
            <div>
              <label htmlFor="input-new-type-itemtype-code" className="block font-medium text-ink mb-1">
                Item Type Code <span className="text-slate font-normal">(Auto)</span>
              </label>
              <input
                id="input-new-type-itemtype-code"
                type="text"
                disabled
                readOnly
                value={generatedCodes.item_type_code || '—'}
                className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-ink font-mono font-semibold cursor-not-allowed select-none text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="input-new-type-category" className="block font-medium text-ink mb-1">
              Category
            </label>
            <input
              id="input-new-type-category"
              type="text"
              disabled
              readOnly
              value={categoryDisplayName}
              className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate font-medium cursor-not-allowed select-none text-xs"
            />
          </div>
        </form>
      </RecordModal>

      {/* Edit Type Modal */}
      <RecordModal
        isOpen={editTypeModalOpen}
        onClose={() => {
          setEditTypeModalOpen(false);
          setEditingType(null);
        }}
        title={`Edit ${editingType?.name || ''} Type`}
        onSubmit={handleSaveEditType}
        submitLabel="Save Changes"
        loading={editTypeSubmitting}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveEditType} className="space-y-4 text-xs">
          {editTypeError && (
            <div
              id="edit-type-server-error"
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{editTypeError}</span>
            </div>
          )}

          <div>
            <label htmlFor="input-edit-type-name" className="block font-medium text-ink mb-1">
              Sub-Category Name <span className="text-[#B4483A]">*</span>
            </label>
            <input
              id="input-edit-type-name"
              type="text"
              autoFocus
              value={editTypeName}
              onChange={(e) => {
                setEditTypeName(e.target.value);
                if (editTypeFieldError) setEditTypeFieldError('');
                if (editTypeError) setEditTypeError('');
              }}
              className={`w-full px-3 py-2 bg-surface border rounded focus:outline-none text-ink text-xs font-medium transition-colors ${
                editTypeFieldError ? 'border-[#B4483A] focus:border-[#B4483A]' : 'border-line focus:border-signal'
              }`}
            />
            {editTypeFieldError && (
              <p id="edit-type-name-error" className="mt-1 text-[11px] text-[#B4483A] font-medium">
                {editTypeFieldError}
              </p>
            )}
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">
              Sub-Category Code (Auto)
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={editingType?.sub_category_code || editingType?.code || resolveSubCategoryCode(editingType?.name || '', editingType?.slug || '')}
              className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate font-medium cursor-not-allowed select-none text-xs"
            />
            <p className="mt-1 text-[11px] text-slate">
              Sub-category code is locked to preserve existing serial numbers and QR codes.
            </p>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Description (Optional)</label>
            <textarea
              rows="3"
              placeholder="Optional notes or specifications for this sub-category..."
              value={editTypeDescription}
              onChange={(e) => setEditTypeDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>
        </form>
      </RecordModal>

      {/* Delete Sub-Category ConfirmModal */}
      <ConfirmModal
        isOpen={deleteSubCategoryModalOpen}
        onClose={() => {
          setDeleteSubCategoryModalOpen(false);
          setDeletingSubCategory(null);
        }}
        onConfirm={handleConfirmDeleteSubCategory}
        title={`Delete Sub-Category "${deletingSubCategory?.name || ''}"`}
        message={
          isDeleteSubCategoryBlocked ? (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{deleteSubCategoryBlockReason}</span>
              </div>
            </div>
          ) : (
            `Are you sure you want to delete the sub-category "${deletingSubCategory?.name || ''}"? This action cannot be undone.`
          )
        }
        confirmLabel="Yes, Delete Sub-Category"
        cancelLabel="Cancel"
        isDestructive={true}
        confirmDisabled={isDeleteSubCategoryBlocked}
        loading={deleteSubCategoryLoading}
      />

      {/* Manage Custom Item Types Modal */}
      {isManageItemTypesModalOpen && (
        <div id="modal-manage-item-types" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-card">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-signal" />
                <h3 className="font-bold text-sm text-ink">
                  Manage {activeSubType?.name || 'Sub-Category'} Types
                </h3>
              </div>
              <button
                type="button"
                id="btn-close-manage-types"
                onClick={() => {
                  setIsManageItemTypesModalOpen(false);
                  setEditingItemType(null);
                  setManageItemTypesError('');
                }}
                className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {manageItemTypesError && (
                <div id="manage-item-types-error" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>{manageItemTypesError}</div>
                </div>
              )}

              {/* Editing inline banner if active */}
              {editingItemType && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-ink">Rename Custom Type</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      id="input-rename-item-type"
                      value={editItemTypeName}
                      onChange={(e) => {
                        setEditItemTypeName(e.target.value);
                        if (editItemTypeError) setEditItemTypeError('');
                      }}
                      className="flex-1 px-3 py-1.5 bg-surface border border-line rounded text-xs text-ink font-medium focus:outline-none focus:border-signal"
                    />
                    <button
                      type="button"
                      id="btn-confirm-rename-type"
                      disabled={editItemTypeLoading || !editItemTypeName.trim()}
                      onClick={handleSaveRenameItemType}
                      className="px-3 py-1.5 bg-signal text-white rounded text-xs font-semibold flex items-center gap-1 hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {editItemTypeLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemType(null);
                        setEditItemTypeName('');
                        setEditItemTypeError('');
                      }}
                      className="px-2 py-1.5 text-xs text-slate hover:text-ink font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  {editItemTypeError && (
                    <div className="text-[11px] text-red-600 font-medium">{editItemTypeError}</div>
                  )}
                  <div className="text-[10px] text-slate">
                    Serial number code ({editingItemType.code}) will be preserved to keep existing serial numbers valid.
                  </div>
                </div>
              )}

              {/* Types list */}
              <div>
                <h4 className="text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Configured Types ({activeSubType?.name})
                </h4>
                <div className="divide-y divide-line border border-line rounded-lg overflow-hidden bg-card">
                  {/* Built-in Types */}
                  {(SUBTYPE_METADATA[activeSubTypeSlug]?.subTypeOptions || []).map(bName => (
                    <div key={`builtin-${bName}`} className="px-3 py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{bName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate/10 text-slate font-medium">Standard</span>
                      </div>
                      <span className="text-[11px] text-slate italic">Built-in</span>
                    </div>
                  ))}

                  {/* Custom Types */}
                  {customItemTypes.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate text-center">
                      No custom types added yet for this sub-category.
                    </div>
                  ) : (
                    customItemTypes.map(cType => (
                      <div key={`custom-${cType.id || cType.name}`} className="px-3 py-2.5 flex items-center justify-between text-xs hover:bg-surface/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{cType.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">Custom</span>
                          <span className="font-mono text-[10px] text-slate bg-surface px-1.5 py-0.5 rounded border border-line">
                            {cType.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            id={`btn-rename-type-${cType.id}`}
                            onClick={() => {
                              setEditingItemType(cType);
                              setEditItemTypeName(cType.name);
                              setEditItemTypeError('');
                            }}
                            className="p-1 text-slate hover:text-signal hover:bg-surface rounded transition-colors cursor-pointer"
                            title={`Rename ${cType.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-item-type-${cType.id}`}
                            disabled={deletingItemTypeId === cType.id}
                            onClick={() => handleDeleteItemType(cType)}
                            className="p-1 text-slate hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-50"
                            title={`Delete ${cType.name}`}
                          >
                            {deletingItemTypeId === cType.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-line bg-card flex justify-end">
              <Button
                variant="secondary"
                size="regular"
                label="Close"
                onClick={() => {
                  setIsManageItemTypesModalOpen(false);
                  setEditingItemType(null);
                  setManageItemTypesError('');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
