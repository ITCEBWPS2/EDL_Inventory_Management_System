import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppShell } from '../components/layout/AppShell';
import { RecordModal } from '../components/common/RecordModal';
import { BackButton } from '../components/common/BackButton';
import { DateInput } from '../components/common/DateInput';
import { formatDate } from '../utils/formatters';
import {
  Search,
  Filter,
  Plus,
  Info,
  Image as ImageIcon,
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  ExternalLink,
  RotateCcw,
  Loader2
} from 'lucide-react';
import {
  CATEGORY_SUBTYPES,
  SUBTYPE_METADATA,
  getCategorySubtypes,
  buildCategoryItemUnion,
  itemMatchesSubType
} from '../constants/categorySubtypes';

const INITIAL_SENDERS = [
  'Finco Furnitures',
  'Central Logistics Depot - Kolonnawa',
  'Lanka Electricity Metering Co (Pvt) Ltd',
  'Kelani Cables PLC',
  'ACL Cables PLC',
  'State Trading Corporation',
  'Singer Sri Lanka PLC',
  'Abans IT Solutions'
];

const DEFAULT_CATEGORIES = [
  { id: '22222222-2222-2222-2222-222222222201', name: 'Furniture', slug: 'furniture' },
  { id: '22222222-2222-2222-2222-222222222202', name: 'IT & Computing Equipment', slug: 'it-computing-equipment' },
  { id: '22222222-2222-2222-2222-222222222203', name: 'Network & Communication Equipment', slug: 'network-communication-equipment' },
  { id: '22222222-2222-2222-2222-222222222204', name: 'Audio Visual & Presentation Equipment', slug: 'audio-visual-presentation-equipment' },
  { id: '22222222-2222-2222-2222-222222222206', name: 'Tools & Equipment', slug: 'tools-equipment' }
];

export const ReceivedTransactions = () => {
  const { user, selectedUnitId, selectedUnit, canWrite } = useAuth();
  const toast = useToast();

  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedVoucherFilter, setSelectedVoucherFilter] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedItemFilter, setSelectedItemFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRowNo, setEditRowNo] = useState(1);
  const [formData, setFormData] = useState({
    row_no: 1,
    date: '',
    voucher_no: '',
    category_id: '',
    item_name: '',
    quantity: 1,
    from_whom: '',
    notes: '',
    voucher_url: null
  });

  const [senderSearchText, setSenderSearchText] = useState('');
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
  const [isCustomSender, setIsCustomSender] = useState(false);
  const senderDropdownRef = useRef(null);

  // Dependent Item dropdown state
  const [categoryItems, setCategoryItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearchText, setItemSearchText] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Info Modal & Image Preview Modal State
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Configuration switch: whether From Whom Received is required
  const [isSenderRequired, setIsSenderRequired] = useState(
    () => import.meta.env.VITE_REQUIRE_RECEIVED_SENDER === 'true'
  );


  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, itemsRes, catRes, configRes] = await Promise.all([
        api.get('/transactions/received', { unit_id: selectedUnitId }),
        api.get('/inventory', { all: 'true' }),
        api.get('/inventory/categories'),
        api.get('/transactions/config').catch(() => null)
      ]);
      if (configRes && configRes.success && configRes.data) {
        setIsSenderRequired(Boolean(configRes.data.require_received_sender));
      }
      if (txRes.success) setTransactions(txRes.data || []);
      if (itemsRes.success) setItems(itemsRes.data || []);
      if (catRes.success && catRes.data && catRes.data.length > 0) {
        const filteredCats = catRes.data
          .filter(c => c.name?.toLowerCase() !== 'media equipment' && c.id !== '22222222-2222-2222-2222-222222222205')
          .map(c => ({
            ...c,
            slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
          }));
        if (filteredCats.length > 0) {
          setCategories(filteredCats);
        }
      }
    } catch (err) {
      toast.error('Failed to load received transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedUnitId]);

  // Distinct Vouchers list for filter dropdown
  const distinctVouchers = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.voucher_no && t.voucher_no.trim()) {
        set.add(t.voucher_no.trim());
      }
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Distinct Dates list for filter dropdown
  const distinctDates = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => {
      if (t.date && String(t.date).trim()) {
        const d = String(t.date).split('T')[0].trim();
        if (d) set.add(d);
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const hasNoDateRecords = useMemo(() => {
    return transactions.some(t => !t.date || !String(t.date).trim());
  }, [transactions]);

  // Distinct items list for filter dropdown
  const distinctItemNames = useMemo(() => {
    const list = new Set();
    items.forEach(i => {
      if (i.item_name) list.add(i.item_name.trim());
    });
    transactions.forEach(t => {
      if (t.item_name) list.add(t.item_name.trim());
    });
    return Array.from(list).sort();
  }, [items, transactions]);

  // Combined senders list
  const senderOptions = useMemo(() => {
    const set = new Set(INITIAL_SENDERS);
    transactions.forEach(t => {
      if (t.from_whom && t.from_whom.trim()) {
        set.add(t.from_whom.trim());
      }
    });
    return Array.from(set);
  }, [transactions]);

  // Filtered senders in modal combobox
  const filteredModalSenders = useMemo(() => {
    if (!senderSearchText.trim()) return senderOptions;
    const q = senderSearchText.toLowerCase().trim();
    return senderOptions.filter(s => s.toLowerCase().includes(q));
  }, [senderOptions, senderSearchText]);

  // Fetch items for selected category from backend + configured taxonomy
  const fetchCategoryItems = async (catId, currentItemName = '') => {
    if (!catId) {
      setCategoryItems([]);
      setItemsLoading(false);
      return;
    }
    setItemsLoading(true);
    try {
      const catObj = categories.find(c => c.id === catId || c.slug === catId);
      const catSlug = catObj?.slug || catObj?.name || catId;

      const res = await api.get('/inventory', { all: 'true', category_id: catId });
      const inventoryList = (res.success && Array.isArray(res.data)) ? res.data : [];

      const unionItems = buildCategoryItemUnion(catSlug, inventoryList, currentItemName);
      setCategoryItems(unionItems);
    } catch (err) {
      console.error('Failed to fetch items for category:', err);
      setCategoryItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  // Filtered items in modal combobox
  const filteredCategoryItems = useMemo(() => {
    if (!itemSearchText.trim()) return categoryItems;
    const q = itemSearchText.toLowerCase().trim();
    return categoryItems.filter(item => {
      const name = (item.item_name || '').toLowerCase();
      const code = (item.item_code || '').toLowerCase();
      const subCat = (item.sub_category_name || '').toLowerCase();
      return name.includes(q) || code.includes(q) || subCat.includes(q);
    });
  }, [categoryItems, itemSearchText]);

  // Group filtered items by sub-category for structured display
  const groupedCategoryItems = useMemo(() => {
    const groups = [];
    const groupMap = new Map();

    filteredCategoryItems.forEach(item => {
      const groupName = item.sub_category_name || 'General';
      if (!groupMap.has(groupName)) {
        const groupObj = { groupName, items: [] };
        groupMap.set(groupName, groupObj);
        groups.push(groupObj);
      }
      groupMap.get(groupName).items.push(item);
    });

    return groups;
  }, [filteredCategoryItems]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (senderDropdownRef.current && !senderDropdownRef.current.contains(e.target)) {
        setIsSenderDropdownOpen(false);
        if (senderSearchText.trim() && !isCustomSender) {
          setFormData(p => ({ ...p, from_whom: senderSearchText.trim() }));
        }
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target)) {
        setIsItemDropdownOpen(false);
        if (formData.item_name) {
          setItemSearchText(formData.item_name);
        } else {
          setItemSearchText('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [senderSearchText, isCustomSender, formData.item_name]);

  // Auto-generate next voucher number (e.g. RV-001, RV-002, RV-005)
  const generateNextVoucherNo = () => {
    let highest = 0;
    transactions.forEach(t => {
      const match = (t.voucher_no || '').match(/RV[-_]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > highest) highest = num;
      }
    });
    const next = highest > 0 ? highest + 1 : (transactions.length + 1);
    return `RV-${String(next).padStart(3, '0')}`;
  };

  // Filtered & Searched data based on Voucher No, Date, Item, and Search text
  const filteredTransactions = useMemo(() => {
    return transactions.filter(row => {
      // 1. Voucher No filter
      if (selectedVoucherFilter && row.voucher_no !== selectedVoucherFilter) {
        return false;
      }

      // 2. Date filter
      if (selectedDateFilter) {
        const rowDate = row.date ? String(row.date).split('T')[0].trim() : '';
        if (selectedDateFilter === '__NO_DATE__') {
          if (rowDate) return false;
        } else {
          if (rowDate !== selectedDateFilter) return false;
        }
      }

      // 3. Item filter
      if (selectedItemFilter && row.item_name !== selectedItemFilter) {
        return false;
      }

      // 4. Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vNo = (row.voucher_no || '').toLowerCase();
        const iName = (row.item_name || '').toLowerCase();
        const iCode = (row.item_code || '').toLowerCase();
        const fWhom = (row.from_whom || '').toLowerCase();
        const nNotes = (row.notes || '').toLowerCase();
        const sNo = (row.serial_number || '').toLowerCase();
        const rDate = row.date ? String(row.date).split('T')[0].trim() : '';
        const rDateFormatted = formatDate(row.date);

        const matches =
          vNo.includes(q) ||
          iName.includes(q) ||
          iCode.includes(q) ||
          fWhom.includes(q) ||
          nNotes.includes(q) ||
          sNo.includes(q) ||
          (rDate && rDate.includes(q)) ||
          (rDateFormatted !== '—' && rDateFormatted.toLowerCase().includes(q));

        if (!matches) return false;
      }

      return true;
    });
  }, [transactions, selectedVoucherFilter, selectedDateFilter, selectedItemFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Handle Category selection change
  const handleCategoryChange = (catId) => {
    setFormData(p => ({
      ...p,
      category_id: catId,
      item_id: null,
      item_name: '',
      item_code: ''
    }));
    setItemSearchText('');
    setIsItemDropdownOpen(false);
    fetchCategoryItems(catId);
  };

  // Open Add Modal
  const handleOpenAdd = async () => {
    setIsEditing(false);
    setEditingId(null);
    const nextNo = transactions.length + 1;
    const defaultSender = isSenderRequired ? 'Finco Furnitures' : '';

    setFormData({
      row_no: nextNo,
      date: '',
      voucher_no: '',
      category_id: '',
      item_name: '',
      quantity: 1,
      from_whom: defaultSender,
      notes: '',
      voucher_url: null
    });

    setSenderSearchText(defaultSender);
    setIsSenderDropdownOpen(false);
    setIsCustomSender(false);

    setCategoryItems([]);
    setItemSearchText('');
    setIsItemDropdownOpen(false);
    setItemsLoading(false);

    setSelectedFile(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (row, indexInPage) => {
    setIsEditing(true);
    setEditingId(row.id);
    const rowNo = indexInPage !== undefined ? (currentPage - 1) * pageSize + indexInPage + 1 : 1;
    setEditRowNo(rowNo);

    const isKnownSender = senderOptions.includes(row.from_whom);
    setIsCustomSender(!isKnownSender && Boolean(row.from_whom));

    let resolvedCatId = '';
    if (row.category_id) {
      resolvedCatId = row.category_id;
    } else if (row.category) {
      const cLower = row.category.toLowerCase().trim();
      const matched = categories.find(c => c.name.toLowerCase().trim() === cLower || c.id === row.category);
      if (matched) resolvedCatId = matched.id;
    }

    setFormData({
      row_no: rowNo,
      date: row.date ? String(row.date).split('T')[0].trim() : '',
      voucher_no: row.voucher_no || '',
      category_id: resolvedCatId,
      item_name: row.item_name || '',
      quantity: row.quantity || 1,
      from_whom: row.from_whom || '',
      notes: row.notes || '',
      voucher_url: row.voucher_url || null
    });

    setSenderSearchText(row.from_whom || '');
    setIsSenderDropdownOpen(false);

    if (resolvedCatId) {
      fetchCategoryItems(resolvedCatId, row.item_name || '');
    } else {
      setCategoryItems([]);
    }
    setItemSearchText(row.item_name || '');
    setIsItemDropdownOpen(false);

    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setSelectedFile(null);
    setIsSenderDropdownOpen(false);
    setIsItemDropdownOpen(false);
    setCategoryItems([]);
    setItemSearchText('');
    setItemsLoading(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Save Transaction (Add or Edit)
  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!formData.category_id) {
      toast.error('Please select an item category.');
      return;
    }

    const trimmedItemName = (formData.item_name || '').trim();
    if (!trimmedItemName) {
      toast.error('Please select an item.');
      return;
    }

    // Resolve sender
    const finalSender = (isCustomSender ? formData.from_whom : (formData.from_whom || senderSearchText || '')).trim();
    if (isSenderRequired && !finalSender) {
      toast.error('Please select or specify who the item was received from.');
      return;
    }

    if (Number(formData.quantity) < 1) {
      toast.error('Quantity must be at least 1.');
      return;
    }

    setModalLoading(true);
    try {
      const payload = new FormData();
      payload.append('item_name', trimmedItemName);
      if (formData.item_id) {
        payload.append('item_id', formData.item_id);
      }
      if (formData.category_id) {
        payload.append('category_id', formData.category_id);
        const selCat = categories.find(c => c.id === formData.category_id);
        if (selCat) payload.append('category', selCat.name);
      }
      payload.append('quantity', formData.quantity);
      payload.append('date', (formData.date || '').trim());
      payload.append('voucher_no', (formData.voucher_no || '').trim());
      payload.append('from_whom', finalSender);
      payload.append('notes', formData.notes || '');

      const unitId = selectedUnitId || user?.units?.[0]?.id || user?.unit_id;
      if (unitId) payload.append('unit_id', unitId);

      if (selectedFile) {
        payload.append('voucher_image', selectedFile);
      }

      if (isEditing && editingId) {
        await api.put(`/transactions/received/${editingId}`, payload, true);
        toast.success('Received record updated successfully.');
      } else {
        await api.post('/transactions/received', payload, true);
        toast.success('New received record added successfully.');
      }

      handleCloseModal();
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save received record.');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete Transaction
  const handleDelete = async (row) => {
    const recordLabel = row.voucher_no?.trim() ? `voucher ${row.voucher_no}` : (row.item_name || 'this record');
    if (!window.confirm(`Are you sure you want to delete received record for ${recordLabel}?`)) {
      return;
    }
    try {
      await api.delete(`/transactions/received/${row.id}`);
      toast.success('Received record deleted.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete received record.');
    }
  };

  const hasActiveFilters = Boolean(
    selectedVoucherFilter || selectedDateFilter || selectedItemFilter || searchQuery
  );

  return (
    <AppShell breadcrumbs={[{ label: 'Transactions', path: '/transactions' }, { label: 'Received Items' }]}>
      {/* Header — subtitle text removed per requirement 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Received Items</h1>
        </div>
      </div>

      {/* Table Container Card */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
        {/* Filter and Search Bar — filtering by Voucher No, Date, and Item */}
        <div className="p-4 border-b border-line flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface/40">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Filter by Voucher No */}
            <div className="relative min-w-[145px]">
              <select
                id="select-voucher-filter"
                value={selectedVoucherFilter}
                onChange={(e) => {
                  setSelectedVoucherFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by Voucher Number"
              >
                <option value="">All Vouchers</option>
                {distinctVouchers.map(vNo => (
                  <option key={vNo} value={vNo}>{vNo}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

              {/* Filter by Date */}
              <div className="relative min-w-[135px]">
                <select
                  id="select-date-filter"
                  value={selectedDateFilter}
                  onChange={(e) => {
                    setSelectedDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                  title="Filter by Receipt Date"
                >
                  <option value="">All Dates</option>
                  {hasNoDateRecords && <option value="__NO_DATE__">No Date (—)</option>}
                  {distinctDates.map(date => (
                    <option key={date} value={date}>{formatDate(date)}</option>
                  ))}
                </select>
                <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
              </div>

            {/* Filter by Item */}
            <div className="relative min-w-[145px]">
              <select
                id="select-item-filter"
                value={selectedItemFilter}
                onChange={(e) => {
                  setSelectedItemFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-card border border-line rounded py-2 px-3 pr-8 appearance-none focus:outline-none focus:border-signal text-ink font-medium shadow-subtle cursor-pointer hover:border-slate/50 transition-colors"
                title="Filter by item type"
              >
                <option value="">All Items</option>
                {distinctItemNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>

            {/* Search Input Box */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                id="input-received-search"
                placeholder="Search voucher, date, sender, item..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs bg-card border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate shadow-subtle"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucherFilter('');
                  setSelectedDateFilter('');
                  setSelectedItemFilter('');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs text-[#B4483A] hover:underline font-medium px-2 py-1 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate shrink-0">
            Showing <span className="font-semibold text-ink">{filteredTransactions.length}</span> records
          </div>
        </div>

        {/* Simplified Table matching specification */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface/70 font-semibold text-slate uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher No</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4">From Whom Received</th>
                <th className="py-3 px-4 text-center">Image</th>
                <th className="py-3 px-4 text-center">Info</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate">
                    <div className="inline-block w-6 h-6 border-2 border-line border-t-ink rounded-full animate-spin mb-2"></div>
                    <div>Loading received transactions...</div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate">
                    <div className="text-sm font-medium text-ink">No received stock transactions found.</div>
                    <p className="text-xs mt-1 text-slate">Try adjusting your filter criteria or search query.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                  const dateDisplay = formatDate(row.date);
                  const hasExtraInfo = Boolean(
                    (row.notes && row.notes.trim()) ||
                    (row.serial_number && row.serial_number.trim())
                  );

                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-surface/50 transition-colors group"
                    >
                      {/* 1. No */}
                      <td className="py-3.5 px-4 text-center text-slate font-mono font-medium">
                        {rowNumber}
                      </td>

                      {/* 2. Date */}
                      <td className="py-3.5 px-4 font-mono text-slate whitespace-nowrap">
                        {dateDisplay}
                      </td>

                      {/* 3. Voucher No */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-ink whitespace-nowrap">
                        {row.voucher_no || '—'}
                      </td>

                      {/* 4. Item */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ink leading-tight">
                          {row.item_name || '—'}
                        </div>
                      </td>

                      {/* 5. Qty (small dark badge/pill) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ink text-white min-w-[24px]">
                          {row.quantity}
                        </span>
                      </td>

                      {/* 6. From Whom Received (styled as link / highlighted text if non-empty, plain dash if empty) */}
                      <td className="py-3.5 px-4">
                        {row.from_whom?.trim() ? (
                          <span
                            onClick={() => {
                              setSearchQuery(row.from_whom);
                              setCurrentPage(1);
                            }}
                            className="text-signal hover:underline font-medium cursor-pointer transition-colors"
                            title="Click to search records from this sender"
                          >
                            {row.from_whom}
                          </span>
                        ) : (
                          <span className="text-slate/60 font-mono">—</span>
                        )}
                      </td>

                      {/* 7. Image ("—" or thumbnail/icon) */}
                      <td className="py-3.5 px-4 text-center">
                        {row.voucher_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(row.voucher_url)}
                            className="inline-flex items-center justify-center p-0.5 rounded border border-line hover:border-signal transition-colors group/img"
                            title="Click to preview voucher image"
                          >
                            <img
                              src={row.voucher_url}
                              alt="Voucher"
                              className="w-7 h-7 object-cover rounded"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display = 'inline-flex';
                                }
                              }}
                            />
                            <span className="hidden w-7 h-7 rounded bg-surface items-center justify-center text-signal">
                              <Eye className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate/50 font-mono text-sm">—</span>
                        )}
                      </td>

                      {/* 8. Info (ⓘ icon, hover/click details, disabled/greyed if no extra info) */}
                      <td className="py-3.5 px-4 text-center">
                        {hasExtraInfo ? (
                          <button
                            type="button"
                            onClick={() => setDetailModalItem(row)}
                            className="p-1 rounded-full text-signal hover:bg-signal/10 transition-colors inline-flex items-center justify-center"
                            title={`Details: ${row.notes || ''} ${row.serial_number ? `(SN: ${row.serial_number})` : ''}`}
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-1 text-slate/30 cursor-not-allowed inline-flex items-center justify-center"
                            title="No additional information"
                          >
                            <Info className="w-4 h-4" />
                          </span>
                        )}
                      </td>

                      {/* 9. Actions (Edit outline button, Delete red button) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(row, idx)}
                              className="px-2.5 py-1 text-xs border border-line rounded text-ink hover:bg-surface hover:border-slate/40 font-medium transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="px-2.5 py-1 text-xs bg-[#B4483A] hover:bg-[#9B3C2F] text-white rounded font-medium transition-colors shadow-2xs"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredTransactions.length > pageSize && (
          <div className="p-3 border-t border-line flex items-center justify-between text-xs text-slate bg-surface/40">
            <div>
              Page <span className="font-semibold text-ink tabular-nums">{currentPage}</span> of{' '}
              <span className="font-semibold text-ink tabular-nums">{totalPages}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded border border-line bg-card hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Back Button */}
      <BackButton to="/transactions" id="btn-back-transactions" />

      {/* Floating "Add" Button (Bottom-Right, with "+" icon per requirement 3) */}
      {canWrite && (
        <button
          id="btn-add-received-record"
          onClick={handleOpenAdd}
          className="fixed bottom-6 right-6 z-40 bg-ink hover:bg-[#193254] text-white px-5 py-2.5 rounded-full shadow-lg font-semibold text-xs transition-all hover:scale-105 active:scale-95 border border-white/10 flex items-center gap-1.5"
          title="Add Received Record"
        >
          <Plus className="w-4 h-4 text-signal" />
          <span>Add</span>
        </button>
      )}

      {/* "Add Received Record" / "Edit Received Record" Modal */}
      <RecordModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={isEditing ? "Edit Received Record" : "Add Received Record"}
        onSubmit={handleSave}
        submitLabel="Save"
        loading={modalLoading}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            {/* No. (auto-generated, read-only) */}
            <div>
              <label className="block font-medium text-ink mb-1">No.</label>
              <input
                type="text"
                readOnly
                value={formData.row_no}
                className="w-full px-3 py-2 bg-surface/70 border border-line rounded text-slate font-mono cursor-not-allowed"
              />
            </div>

            {/* Date (date picker, optional) */}
            <div>
              <label className="block font-medium text-ink mb-1">
                Date <span className="text-slate text-[11px] font-normal">(Optional)</span>
              </label>
              <DateInput
                value={formData.date || ''}
                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Voucher No. (optional input) */}
            <div>
              <label className="block font-medium text-ink mb-1">
                Voucher No. <span className="text-slate font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.voucher_no}
                onChange={(e) => setFormData(p => ({ ...p, voucher_no: e.target.value }))}
                placeholder="e.g. RV-005"
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-mono font-medium"
              />
            </div>

            {/* Qty (numeric input, default 1) */}
            <div>
              <label className="block font-medium text-ink mb-1">Qty</label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink font-mono"
              />
            </div>
          </div>

          {/* Item Category (Dropdown positioned right above Item) */}
          <div>
            <label className="block font-medium text-ink mb-1">
              Item Category <span className="text-signal">*</span>
            </label>
            <div className="relative">
              <select
                id="select-modal-item-category"
                required
                value={formData.category_id || ''}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink text-xs appearance-none pr-8 cursor-pointer hover:border-slate/50 transition-colors"
              >
                <option value="">Select Item Category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            </div>
          </div>

          {/* Item (Dependent dropdown filtered by selected Item Category) */}
          <div className="relative" ref={itemDropdownRef}>
            <label className="block font-medium text-ink mb-1">
              Item <span className="text-signal">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                disabled={!formData.category_id || itemsLoading}
                placeholder={
                  !formData.category_id
                    ? 'Select item category first'
                    : itemsLoading
                    ? 'Loading items...'
                    : 'Type to search or select item...'
                }
                value={itemSearchText}
                onChange={(e) => {
                  setItemSearchText(e.target.value);
                  setFormData(p => ({ ...p, item_name: e.target.value }));
                  setIsItemDropdownOpen(true);
                }}
                onFocus={() => {
                  if (formData.category_id && !itemsLoading) {
                    setIsItemDropdownOpen(true);
                  }
                }}
                onClick={() => {
                  if (formData.category_id && !itemsLoading) {
                    setIsItemDropdownOpen(true);
                  }
                }}
                className={`w-full px-3 py-2 pr-8 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate/60 text-xs transition-colors ${
                  !formData.category_id
                    ? 'opacity-60 cursor-not-allowed bg-surface/50'
                    : 'cursor-pointer hover:border-slate/50'
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                {itemsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-signal" />
                ) : (
                  <button
                    type="button"
                    disabled={!formData.category_id}
                    onClick={() => {
                      if (formData.category_id) {
                        setIsItemDropdownOpen(p => !p);
                      }
                    }}
                    className={`p-1 text-slate hover:text-ink ${!formData.category_id ? 'cursor-not-allowed opacity-50' : ''}`}
                    tabIndex={-1}
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Dropdown list */}
              {isItemDropdownOpen && formData.category_id && !itemsLoading && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-line rounded-lg shadow-modal max-h-56 overflow-y-auto divide-y divide-line/40 animate-fade-in">
                  {groupedCategoryItems.length > 0 ? (
                    groupedCategoryItems.map(({ groupName, items }) => (
                      <div key={groupName} className="py-1">
                        <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate uppercase bg-surface/80 sticky top-0 backdrop-blur-sm select-none border-y border-line/30 first:border-t-0 flex items-center justify-between">
                          <span>{groupName}</span>
                          <span className="text-[9px] font-normal text-slate/80">{items.length}</span>
                        </div>
                        {items.map((item) => {
                          const itemName = item.item_name;
                          const isSelected = formData.item_name?.toLowerCase() === itemName.toLowerCase();
                          return (
                            <div
                              key={item.id || `${groupName}-${itemName}`}
                              onClick={() => {
                                setFormData(p => ({
                                  ...p,
                                  item_id: item.id || null,
                                  item_name: itemName,
                                  item_code: item.item_code || p.item_code || ''
                                }));
                                setItemSearchText(itemName);
                                setIsItemDropdownOpen(false);
                              }}
                              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                                isSelected ? 'bg-signal/10 text-signal font-semibold' : 'text-ink hover:bg-surface'
                              }`}
                            >
                              <span className="font-medium text-ink">{itemName}</span>
                              {isSelected && <span className="text-signal text-[11px] font-bold">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate text-xs italic">
                      {categoryItems.length === 0
                        ? 'No items found for this category'
                        : `No items matching "${itemSearchText}"`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* From Whom Received (Typeable / Searchable Combobox per requirement 1) */}
          <div className="relative" ref={senderDropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-medium text-ink">
                From Whom Received {isSenderRequired ? (
                  <span className="text-signal">*</span>
                ) : (
                  <span className="text-slate text-[11px] font-normal">(Optional)</span>
                )}
              </label>
              {isCustomSender && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSender(false);
                    setSenderSearchText(formData.from_whom || '');
                  }}
                  className="text-[11px] text-signal hover:underline font-medium"
                >
                  ← Select from list
                </button>
              )}
            </div>

            {isCustomSender ? (
              <input
                type="text"
                required={isSenderRequired}
                placeholder="Enter custom sender / supplier name..."
                value={formData.from_whom}
                onChange={(e) => {
                  setFormData(p => ({ ...p, from_whom: e.target.value }));
                  setSenderSearchText(e.target.value);
                }}
                className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink text-xs"
              />
            ) : (
              <div className="relative">
                <input
                  type="text"
                  required={isSenderRequired}
                  placeholder="Type to search sender (e.g. Finco, Depot)..."
                  value={senderSearchText}
                  onChange={(e) => {
                    setSenderSearchText(e.target.value);
                    setFormData(p => ({ ...p, from_whom: e.target.value }));
                    setIsSenderDropdownOpen(true);
                  }}
                  onFocus={() => setIsSenderDropdownOpen(true)}
                  className="w-full px-3 py-2 pr-8 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate/60 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setIsSenderDropdownOpen(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-ink p-1"
                  tabIndex={-1}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSenderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown list */}
                {isSenderDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-line rounded-lg shadow-modal max-h-48 overflow-y-auto divide-y divide-line/40 animate-fade-in">
                    {filteredModalSenders.length > 0 ? (
                      filteredModalSenders.map((sender) => {
                        const isSelected = formData.from_whom === sender;
                        return (
                          <div
                            key={sender}
                            onClick={() => {
                              setFormData(p => ({ ...p, from_whom: sender }));
                              setSenderSearchText(sender);
                              setIsSenderDropdownOpen(false);
                            }}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected ? 'bg-signal/10 text-signal font-semibold' : 'text-ink hover:bg-surface'
                            }`}
                          >
                            <span>{sender}</span>
                            {isSelected && <span className="text-signal text-[11px] font-bold">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-2.5 text-center text-slate text-xs italic">
                        No predefined senders matching "{senderSearchText}"
                      </div>
                    )}

                    {/* Option to enter custom sender name */}
                    <div className="p-1 bg-surface/40">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSender(true);
                          setIsSenderDropdownOpen(false);
                          if (senderSearchText.trim()) {
                            setFormData(p => ({ ...p, from_whom: senderSearchText.trim() }));
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-signal hover:bg-card rounded transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Enter Custom Sender Name...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* More Information (optional multi-line textarea) */}
          <div>
            <label className="block font-medium text-ink mb-1">
              More Information <span className="text-slate text-[11px] font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. S/N: 001, 002, 003. Model: Dell XPS. Condition: New."
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-card border border-line rounded focus:outline-none focus:border-signal text-ink text-xs leading-relaxed"
            />
          </div>

          {/* Attachment / Photo (dashed-border drop zone) */}
          <div>
            <label className="block font-medium text-ink mb-1">
              Attachment / Photo <span className="text-slate text-[11px] font-normal">(Optional)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-line hover:border-signal rounded-xl p-5 text-center cursor-pointer bg-surface/30 hover:bg-surface/60 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleFileSelect}
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <ImageIcon className="w-5 h-5 text-signal" />
                  <span className="font-medium text-ink truncate max-w-xs">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="p-1 rounded hover:bg-[#B4483A]/10 text-slate hover:text-[#B4483A]"
                    title="Remove attached file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : formData.voucher_url ? (
                <div className="flex items-center justify-center gap-3">
                  <img
                    src={formData.voucher_url}
                    alt="Attached Voucher"
                    className="w-10 h-10 object-cover rounded border border-line"
                  />
                  <div className="text-left">
                    <div className="text-ink font-medium">Image attached</div>
                    <div className="text-[11px] text-slate">Click to choose a replacement image</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate">
                  <UploadCloud className="w-7 h-7 text-slate/60 mb-0.5" />
                  <span className="font-medium text-ink text-xs">Click to upload photo or voucher image</span>
                  <span className="text-[11px] text-slate/70">JPG, PNG, WebP up to 15MB</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </RecordModal>

      {/* Info Details Modal (for ⓘ icon) */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-card rounded-xl border border-line shadow-modal w-full max-w-md p-6 space-y-4 text-xs animate-scale-up">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-signal" />
                <h3 className="text-sm font-semibold text-ink">
                  Transaction Details {detailModalItem.voucher_no?.trim() ? `(${detailModalItem.voucher_no})` : ''}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Voucher No.:</span>
                <span className="font-mono text-ink text-right">{detailModalItem.voucher_no?.trim() || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Item:</span>
                <span className="font-semibold text-ink text-right">{detailModalItem.item_name}</span>
              </div>
              {detailModalItem.item_code && (
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-slate">Serial No.:</span>
                  <span className="font-mono text-ink text-right">{detailModalItem.item_code}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Quantity:</span>
                <span className="font-semibold text-ink text-right">{detailModalItem.quantity}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">Date:</span>
                <span className="font-mono text-ink text-right">
                  {formatDate(detailModalItem.date)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/50">
                <span className="text-slate">From Whom:</span>
                <span className="font-medium text-signal text-right">{detailModalItem.from_whom || '—'}</span>
              </div>
              {detailModalItem.serial_number && (
                <div className="flex justify-between py-1 border-b border-line/50">
                  <span className="text-slate">Serial Number:</span>
                  <span className="font-mono text-ink text-right">{detailModalItem.serial_number}</span>
                </div>
              )}
            </div>

            {detailModalItem.notes && (
              <div className="p-3 bg-surface rounded-lg border border-line">
                <span className="font-medium text-ink block mb-1">More Information:</span>
                <p className="text-slate leading-relaxed whitespace-pre-wrap">{detailModalItem.notes}</p>
              </div>
            )}

            {detailModalItem.voucher_url && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImage(detailModalItem.voucher_url);
                  }}
                  className="w-full py-2 bg-surface hover:bg-card border border-line text-ink rounded font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-signal" />
                  <span>Preview Attached Voucher Image</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Preview / Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl border border-line shadow-modal max-w-2xl w-full p-4 space-y-3 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-xs font-semibold text-ink">Voucher / Document Image</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded text-slate hover:text-ink hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded bg-surface">
              <img
                src={previewImage}
                alt="Voucher Attachment"
                className="max-h-[68vh] max-w-full object-contain rounded"
              />
            </div>
            <div className="flex justify-end pt-2">
              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-signal hover:underline font-medium"
              >
                <span>Open in new tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
