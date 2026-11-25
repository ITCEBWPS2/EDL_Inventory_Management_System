import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { HubPage } from '../components/common/HubPage';
import { RecordModal } from '../components/common/RecordModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { AddButton } from '../components/ui/AddButton';
import { getCategorySubtypes, registerCustomSubtypes } from '../constants/categorySubtypes';
import { canManageCategoryTypes } from '../utils/permissions';
import { resolveCategoryCode } from '../utils/serialNumberGenerator';
import { Tag, AlertCircle } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Furniture', slug: 'furniture' },
  { name: 'IT & Computing Equipment', slug: 'it-computing-equipment' },
  { name: 'Network & Communication Equipment', slug: 'network-communication-equipment' },
  { name: 'Audio Visual & Presentation Equipment', slug: 'audio-visual-presentation-equipment' },
  { name: 'Tools & Equipment', slug: 'tools-equipment' }
];

const BUILTIN_CATEGORY_SLUGS = new Set([
  'furniture',
  'it-computing-equipment',
  'network-communication-equipment',
  'audio-visual-presentation-equipment',
  'tools-equipment'
]);

export const CategoriesPage = () => {
  const { user, isSuperAdmin } = useAuth();
  const canManage = canManageCategoryTypes(user);
  const toast = useToast();

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresSerial, setRequiresSerial] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Category State
  const [editingCategory, setEditingCategory] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRequiresSerial, setEditRequiresSerial] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Category State
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDeleteBlocked, setIsDeleteBlocked] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState('');

  const fetchCategories = async () => {
    try {
      const [catsRes, typesRes] = await Promise.all([
        api.get('/inventory/categories'),
        api.get('/inventory/types')
      ]);
      if (catsRes.success && catsRes.data && catsRes.data.length > 0) {
        setCategories(catsRes.data);
      }
      if (typesRes.success && Array.isArray(typesRes.data)) {
        registerCustomSubtypes(typesRes.data);
      }
    } catch {
      // Keep DEFAULT_CATEGORIES gracefully if offline or mock
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!canManage) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Category name is required.');
      return;
    }
    if (trimmed.length < 2) {
      toast.error('Category name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 60) {
      toast.error('Category name cannot exceed 60 characters.');
      return;
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-/&().]+$/;
    if (!validCharsRegex.test(trimmed)) {
      toast.error('Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/inventory/categories', {
        name: trimmed,
        description: description.trim(),
        requires_serial: requiresSerial
      });
      toast.success('Category added successfully.');
      setModalOpen(false);
      setName('');
      setDescription('');
      setRequiresSerial(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.message || 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditCategory = (e, cat) => {
    e?.stopPropagation?.();
    if (!canManage) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    setEditingCategory(cat);
    setEditName(cat.name || '');
    setEditDescription(cat.description || '');
    setEditRequiresSerial(!!cat.requires_serial);
    setEditError('');
    setEditModalOpen(true);
  };

  const handleSaveEditCategory = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (editSubmitting || !editingCategory) return;
    if (!canManage) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      setEditModalOpen(false);
      return;
    }

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('Category name is required.');
      return;
    }
    if (trimmed.length < 2) {
      setEditError('Category name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 60) {
      setEditError('Category name cannot exceed 60 characters.');
      return;
    }
    const validCharsRegex = /^[a-zA-Z0-9\s\-/&().]+$/;
    if (!validCharsRegex.test(trimmed)) {
      setEditError('Only letters, numbers, spaces, and the characters - / & ( ) . are allowed.');
      return;
    }

    // Duplicate check
    const isDuplicate = categories.some(
      c => c.id !== editingCategory.id && c.name?.toLowerCase().trim() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setEditError('A category with this name already exists.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      const res = await api.put(`/inventory/categories/${editingCategory.id}`, {
        name: trimmed,
        description: editDescription.trim(),
        requires_serial: editRequiresSerial
      });

      if (res.success) {
        toast.success('Updated successfully.');
        setEditModalOpen(false);
        setEditingCategory(null);
        fetchCategories();
      } else {
        setEditError(res.message || 'Failed to update category.');
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update category.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDeleteCategory = async (e, cat) => {
    e?.stopPropagation?.();
    if (!canManage) {
      toast.error('Access denied. Only Super Admin and Local Admin can manage item categories and types.');
      return;
    }
    setDeletingCategory(cat);
    setDeleteModalOpen(true);
    setDeleteLoading(true);

    const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const isBuiltin = BUILTIN_CATEGORY_SLUGS.has(slug) || cat.id?.startsWith('22222222-2222-2222-2222-2222222222');
    const subCount = getCategorySubtypes(slug).length;

    try {
      // Check items count for this category
      const itemsRes = await api.get(`/inventory?category=${encodeURIComponent(cat.name)}&limit=1`);
      const itemsCount = itemsRes?.pagination?.totalItems ?? itemsRes?.data?.length ?? 0;

      if (subCount > 0 || itemsCount > 0) {
        setIsDeleteBlocked(true);
        const subMsg = `${subCount} sub-categor${subCount === 1 ? 'y' : 'ies'}`;
        const itemMsg = `${itemsCount} item${itemsCount === 1 ? '' : 's'}`;
        setDeleteBlockReason(`${cat.name} has ${subMsg} and ${itemMsg}. Remove or move them first.`);
      } else if (isBuiltin && !isSuperAdmin) {
        setIsDeleteBlocked(true);
        setDeleteBlockReason('Only Super Admin can delete built-in categories.');
      } else {
        setIsDeleteBlocked(false);
        setDeleteBlockReason('');
      }
    } catch {
      // Fallback based on known subcategories count
      if (subCount > 0) {
        setIsDeleteBlocked(true);
        setDeleteBlockReason(`${cat.name} has ${subCount} sub-categories. Remove or move them first.`);
      } else if (isBuiltin && !isSuperAdmin) {
        setIsDeleteBlocked(true);
        setDeleteBlockReason('Only Super Admin can delete built-in categories.');
      } else {
        setIsDeleteBlocked(false);
        setDeleteBlockReason('');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory || isDeleteBlocked || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete(`/inventory/categories/${deletingCategory.id}`);
      if (res.success) {
        toast.success(`Category '${deletingCategory.name}' deleted successfully.`);
        setDeleteModalOpen(false);
        setDeletingCategory(null);
        fetchCategories();
      } else {
        toast.error(res.message || 'Failed to delete category.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete category.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayCategories = (categories.length > 0 ? categories : DEFAULT_CATEGORIES)
    .filter(c => c.name?.toLowerCase() !== 'media equipment' && c.id !== '22222222-2222-2222-2222-222222222205');

  const cards = displayCategories.map((cat) => {
    const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || cat.id;
    const count = getCategorySubtypes(slug).length;
    return {
      id: `btn-view-category-${slug}`,
      title: cat.name,
      description: `${count} sub-categories`,
      icon: Tag,
      to: `/inventory/category/${slug}`,
      onEdit: canManage ? (e) => handleOpenEditCategory(e, cat) : undefined,
      onDelete: canManage ? (e) => handleOpenDeleteCategory(e, cat) : undefined,
      editTooltip: 'Edit category',
      deleteTooltip: 'Delete category'
    };
  });

  const headerActions = canManage ? (
    <AddButton
      id="btn-add-category"
      label="Add Category"
      onClick={() => setModalOpen(true)}
    />
  ) : null;

  return (
    <HubPage
      title="Item Categories"
      subtitle="Choose a category to view and manage its items."
      icon={Tag}
      breadcrumbs={[{ label: 'Inventory', path: '/inventory/categories' }, { label: 'Item Categories' }]}
      cards={cards}
      backTo="/"
      headerActions={headerActions}
    >
      {/* Add Category Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Asset Category"
        onSubmit={handleCreate}
        submitLabel="Create Category"
        loading={submitting}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-ink mb-1">Category Name <span className="text-[#B4483A]">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Distribution Switchgear"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Description</label>
            <textarea
              rows="3"
              placeholder="Describe assets categorized under this group..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>

          <div className="p-3 bg-surface rounded-lg border border-line flex items-start gap-3">
            <input
              type="checkbox"
              id="req_serial"
              checked={requiresSerial}
              onChange={(e) => setRequiresSerial(e.target.checked)}
              className="mt-0.5 accent-signal w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="req_serial" className="cursor-pointer">
              <div className="font-medium text-ink">Require Serial Number</div>
              <div className="text-[11px] text-slate mt-0.5">
                When checked, adding or receiving items in this category will enforce a valid serial number.
              </div>
            </label>
          </div>
        </div>
      </RecordModal>

      {/* Edit Category Modal */}
      <RecordModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingCategory(null);
        }}
        title={`Edit ${editingCategory?.name || ''} Category`}
        onSubmit={handleSaveEditCategory}
        submitLabel="Save Changes"
        loading={editSubmitting}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveEditCategory} className="space-y-4 text-xs">
          {editError && (
            <div
              id="edit-category-error"
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-ink mb-1">
              Category Name <span className="text-[#B4483A]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                if (editError) setEditError('');
              }}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink font-medium"
            />
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">
              Category Code (Auto)
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={resolveCategoryCode(editingCategory?.name || '')}
              className="w-full px-3 py-2 bg-slate/10 border border-line rounded text-slate font-medium cursor-not-allowed select-none text-xs"
            />
            <p className="mt-1 text-[11px] text-slate">
              Category code is locked to preserve existing serial numbers and QR codes.
            </p>
          </div>

          <div>
            <label className="block font-medium text-ink mb-1">Description (Optional)</label>
            <textarea
              rows="3"
              placeholder="Describe assets categorized under this group..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink"
            />
          </div>

          <div className="p-3 bg-surface rounded-lg border border-line flex items-start gap-3">
            <input
              type="checkbox"
              id="edit_req_serial"
              checked={editRequiresSerial}
              onChange={(e) => setEditRequiresSerial(e.target.checked)}
              className="mt-0.5 accent-signal w-4 h-4 rounded cursor-pointer"
            />
            <label htmlFor="edit_req_serial" className="cursor-pointer">
              <div className="font-medium text-ink">Require Serial Number</div>
              <div className="text-[11px] text-slate mt-0.5">
                When checked, adding or receiving items in this category will enforce a valid serial number.
              </div>
            </label>
          </div>
        </form>
      </RecordModal>

      {/* Delete Category ConfirmModal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingCategory(null);
        }}
        onConfirm={handleConfirmDeleteCategory}
        title={`Delete Category "${deletingCategory?.name || ''}"`}
        message={
          isDeleteBlocked ? (
            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{deleteBlockReason}</span>
              </div>
            </div>
          ) : (
            `Are you sure you want to delete the category "${deletingCategory?.name || ''}"? This action cannot be undone.`
          )
        }
        confirmLabel="Yes, Delete Category"
        cancelLabel="Cancel"
        isDestructive={true}
        confirmDisabled={isDeleteBlocked}
        loading={deleteLoading}
      />
    </HubPage>
  );
};

export default CategoriesPage;
