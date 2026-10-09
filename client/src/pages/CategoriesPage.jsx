import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { RecordModal } from '../components/common/RecordModal';
import { BackButton } from '../components/common/BackButton';
import { Plus, Tag, ArrowRight } from 'lucide-react';

export const CategoriesPage = () => {
  const { isSuperAdmin, isLocalAdmin } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresSerial, setRequiresSerial] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/categories');
      if (res.success) setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load item categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Category name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/categories', {
        name: name.trim(),
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

  return (
    <AppShell breadcrumbs={[{ label: 'Inventory', path: '/inventory' }, { label: 'Item Categories' }]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Manage Item Categories</h1>
        </div>

        {(isSuperAdmin || isLocalAdmin) && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-ink hover:bg-[#193254] text-white text-xs font-medium rounded transition-colors shadow-subtle flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-signal" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories
          .filter(c => c.name?.toLowerCase() !== 'media equipment' && c.id !== '22222222-2222-2222-2222-222222222205')
          .map((cat) => {
          const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || cat.id;
          return (
            <Link
              key={cat.id}
              id={`btn-view-category-${slug}`}
              to={`/inventory/category/${slug}`}
              className="bg-card hover:bg-[#FAF8F5] rounded-xl border border-line p-5 shadow-card hover:border-signal/50 hover:shadow-subtle transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-slate group-hover:text-signal group-hover:border-signal/30 transition-colors">
                  <Tag className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-ink group-hover:text-signal transition-colors">
                  {cat.name}
                </h2>
              </div>
              <ArrowRight className="w-4 h-4 text-slate/50 group-hover:text-signal group-hover:translate-x-0.5 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Bottom Back Button */}
      <BackButton to="/inventory" id="btn-back-inventory" />

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
            <label className="block font-medium text-ink mb-1">Category Name</label>
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
    </AppShell>
  );
};
