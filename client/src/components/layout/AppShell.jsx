import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CATEGORY_SUBTYPES } from '../../constants/categorySubtypes';
import { LocationSwitcherModal } from './LocationSwitcherModal';
import {
  Zap,
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart3,
  Users,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Shield,
  Menu,
  X,
  Warehouse,
  FileText
} from 'lucide-react';

export const AppShell = ({ children, breadcrumbs = [] }) => {
  const { user, selectedUnit, logout, isSuperAdmin, isLocalAdmin, canWrite } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  // Fallback initial categories list (Media Equipment removed)
  const DEFAULT_CATEGORIES = [
    { id: '22222222-2222-2222-2222-222222222201', name: 'Furniture', slug: 'furniture' },
    { id: '22222222-2222-2222-2222-222222222202', name: 'IT & Computing Equipment', slug: 'it-computing-equipment' },
    { id: '22222222-2222-2222-2222-222222222203', name: 'Network & Communication Equipment', slug: 'network-communication-equipment' },
    { id: '22222222-2222-2222-2222-222222222204', name: 'Audio Visual & Presentation Equipment', slug: 'audio-visual-presentation-equipment' },
    { id: '22222222-2222-2222-2222-222222222206', name: 'Tools & Equipment', slug: 'tools-equipment' }
  ];

  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    let isMounted = true;
    api.get('/inventory/categories').then(res => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
        setCategoriesList(
          res.data
            .filter(c => c.name?.toLowerCase() !== 'media equipment' && c.id !== '22222222-2222-2222-2222-222222222205')
            .map(c => ({
              ...c,
              slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            }))
        );
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    inventory: true,
    categories: true, // "Item Categories" expands to show individual category items
    transactions: true,
    verification: true,
    reports: false,
    users: false,
    settings: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleItemCategoriesClick = () => {
    if (location.pathname !== '/inventory/categories') {
      navigate('/inventory/categories');
      setExpandedSections(prev => ({ ...prev, inventory: true, categories: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, categories: !prev.categories }));
    }
  };

  const handleItemCategoriesToggleOnly = (e) => {
    e.stopPropagation();
    setExpandedSections(prev => ({ ...prev, categories: !prev.categories }));
  };

  const handleTransactionsClick = () => {
    if (location.pathname !== '/transactions') {
      navigate('/transactions');
      setExpandedSections(prev => ({ ...prev, transactions: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, transactions: !prev.transactions }));
    }
  };

  const handleTransactionsToggleOnly = (e) => {
    e.stopPropagation();
    setExpandedSections(prev => ({ ...prev, transactions: !prev.transactions }));
  };

  const handleVerificationClick = () => {
    if (location.pathname !== '/verification' && location.pathname !== '/annual-verification') {
      navigate('/verification');
      setExpandedSections(prev => ({ ...prev, verification: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, verification: !prev.verification }));
    }
  };

  const handleVerificationToggleOnly = (e) => {
    e.stopPropagation();
    setExpandedSections(prev => ({ ...prev, verification: !prev.verification }));
  };

  const isCurrent = (path) => location.pathname === path;
  const isSectionActive = (paths) => paths.some(p => location.pathname.startsWith(p));

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-ink/60 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* FIXED LEFT SIDEBAR                                            */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-ink text-white flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-signal text-ink flex items-center justify-center font-bold shadow-subtle">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white leading-tight">
                EDL IMS
              </div>
              <div className="text-[10px] text-slate-300 font-light tracking-wider">
                Electricity Distribution Lanka
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-300 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Numbered 1-6 per specification) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-xs">
          {/* Dashboard */}
          <Link
            to="/"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors ${
              isCurrent('/')
                ? 'bg-white/10 text-signal font-semibold border-l-2 border-signal'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </Link>

          {/* 1. Inventory */}
          <div>
            <button
              onClick={() => toggleSection('inventory')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                isSectionActive(['/inventory'])
                  ? 'text-signal font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-signal/80 font-bold">1</span>
                <Boxes className="w-4 h-4 shrink-0" />
                <span>Inventory</span>
              </div>
              {expandedSections.inventory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {expandedSections.inventory && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                <Link
                  to="/inventory"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/inventory') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Items Catalog
                </Link>

                {/* Submenu for Item Categories */}
                <div className="pt-0.5">
                  <div
                    id="sidebar-item-categories-toggle"
                    onClick={handleItemCategoriesClick}
                    className={`w-full flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors group ${
                      isCurrent('/inventory/categories')
                        ? 'bg-white/10 text-signal font-semibold border-l-2 border-signal pl-1.5'
                        : location.pathname.startsWith('/inventory/categor')
                        ? 'text-signal font-medium bg-white/5'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">Item Categories</span>
                    <button
                      type="button"
                      id="sidebar-item-categories-chevron"
                      onClick={handleItemCategoriesToggleOnly}
                      className="p-0.5 rounded hover:bg-white/10 text-slate-400 group-hover:text-white transition-colors"
                      title={expandedSections.categories ? 'Collapse categories' : 'Expand categories'}
                      aria-label="Toggle Category Submenu"
                    >
                      {expandedSections.categories ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  </div>

                  {expandedSections.categories && (
                    <div className="pl-2 pr-1 py-1 space-y-0.5 border-l border-white/10 ml-2 mt-0.5 animate-fade-in">
                      {/* Individual Category Item Links */}
                      {categoriesList.map((cat) => {
                        const catSlug = cat.slug || cat.id;
                        const targetPath = `/inventory/category/${catSlug}`;

                        const isCatActive = location.pathname.startsWith(`/inventory/category/${catSlug}`) ||
                          location.pathname.startsWith(`/inventory/category/${cat.id}`) ||
                          location.pathname.startsWith(`/inventory/categories/${catSlug}`) ||
                          location.pathname.startsWith(`/inventory/categories/${cat.id}`);

                        return (
                          <Link
                            key={cat.id || catSlug}
                            id={`nav-category-${catSlug}`}
                            to={targetPath}
                            className={`block py-1.5 px-2 rounded text-[11px] truncate transition-colors ${
                              isCatActive
                                ? 'bg-signal/20 text-signal font-semibold border-l-2 border-signal pl-1.5'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title={cat.name}
                          >
                            {cat.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Transactions */}
          <div>
            <div
              id="sidebar-transactions-toggle"
              onClick={handleTransactionsClick}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                isCurrent('/transactions')
                  ? 'bg-white/10 text-signal font-semibold border-l-2 border-signal pl-2.5'
                  : isSectionActive(['/transactions'])
                  ? 'text-signal font-semibold bg-white/5'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-signal/80 font-bold">2</span>
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span>Transactions</span>
              </div>
              <button
                type="button"
                id="sidebar-transactions-chevron"
                onClick={handleTransactionsToggleOnly}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 group-hover:text-white transition-colors"
                title={expandedSections.transactions ? 'Collapse transactions' : 'Expand transactions'}
                aria-label="Toggle Transactions Submenu"
              >
                {expandedSections.transactions ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {expandedSections.transactions && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                <Link
                  to="/transactions/received"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/transactions/received') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Received Items
                </Link>
                <Link
                  to="/transactions/expended"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/transactions/expended') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expended Items
                </Link>
                <Link
                  to="/transactions/remaining"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/transactions/remaining') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Remaining
                </Link>
              </div>
            )}
          </div>

          {/* 3. Annual Verification */}
          <div>
            <div
              id="sidebar-verification-toggle"
              onClick={handleVerificationClick}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                isCurrent('/verification') || isCurrent('/annual-verification')
                  ? 'bg-white/10 text-signal font-semibold border-l-2 border-signal pl-2.5'
                  : isSectionActive(['/verification', '/annual-verification'])
                  ? 'text-signal font-semibold bg-white/5'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-signal/80 font-bold">3</span>
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span>Annual Verification</span>
              </div>
              <button
                type="button"
                id="sidebar-verification-chevron"
                onClick={handleVerificationToggleOnly}
                className="p-0.5 rounded hover:bg-white/10 text-slate-400 group-hover:text-white transition-colors"
                title={expandedSections.verification ? 'Collapse verification' : 'Expand verification'}
                aria-label="Toggle Verification Submenu"
              >
                {expandedSections.verification ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {expandedSections.verification && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                {canWrite && (
                  <Link
                    to="/verification/new"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/verification/new') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    New Verification
                  </Link>
                )}
                <Link
                  to="/verification/issued-destroyed"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/verification/issued-destroyed') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Issued / Destroyed
                </Link>
                <Link
                  to="/verification/history"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/verification/history') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Verification History
                </Link>
              </div>
            )}
          </div>

          {/* 4. Reports */}
          <div>
            <button
              onClick={() => toggleSection('reports')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                isSectionActive(['/reports'])
                  ? 'text-signal font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-signal/80 font-bold">4</span>
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Reports</span>
              </div>
              {expandedSections.reports ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {expandedSections.reports && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                <Link
                  to="/reports/inventory"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/reports/inventory') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Current Inventory
                </Link>
                <Link
                  to="/reports/transactions"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/reports/transactions') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Transaction History
                </Link>
                <Link
                  to="/reports/verification"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/reports/verification') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Verification Audit
                </Link>
              </div>
            )}
          </div>

          {/* 5. User Management (Admin Only) */}
          {(isSuperAdmin || isLocalAdmin) && (
            <div>
              <button
                onClick={() => toggleSection('users')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isSectionActive(['/users'])
                    ? 'text-signal font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-signal/80 font-bold">5</span>
                  <Users className="w-4 h-4 shrink-0" />
                  <span>User Management</span>
                </div>
                {expandedSections.users ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {expandedSections.users && (
                <div className="pl-7 pr-2 py-1 space-y-1">
                  <Link
                    to="/users"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/users') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Staff &amp; Roles
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 6. Settings */}
          <div>
            <button
              onClick={() => toggleSection('settings')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                isSectionActive(['/settings'])
                  ? 'text-signal font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-signal/80 font-bold">6</span>
                <Settings className="w-4 h-4 shrink-0" />
                <span>Settings</span>
              </div>
              {expandedSections.settings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {expandedSections.settings && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                <Link
                  to="/settings"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/settings') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Account Profile
                </Link>
                {(isSuperAdmin || isLocalAdmin) && (
                  <Link
                    to="/settings/units"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/settings/units') ? 'bg-white/10 text-signal font-medium' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Units &amp; Locations
                  </Link>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Assigned Unit Context in Sidebar Footer */}
        <div 
          onClick={() => (isSuperAdmin || isLocalAdmin) && setLocationModalOpen(true)}
          className={`p-3 border-t border-white/10 bg-black/20 text-xs select-none ${
            isSuperAdmin || isLocalAdmin ? 'cursor-pointer hover:bg-black/40 transition-colors' : ''
          }`}
          title={isSuperAdmin || isLocalAdmin ? 'Click to switch location context' : ''}
        >
          <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center justify-between gap-1.5 mb-1">
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-3 h-3 text-signal" />
              <span>Unit Context</span>
            </div>
            {(isSuperAdmin || isLocalAdmin) && (
              <span className="text-[9px] text-signal font-semibold hover:underline">Change</span>
            )}
          </div>
          <div className="font-medium text-white truncate">
            {selectedUnit ? selectedUnit.unit_name : (isSuperAdmin || isLocalAdmin ? 'All Units' : 'No Unit Assigned')}
          </div>
          {selectedUnit && (
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              {selectedUnit.unit_code} &bull; {selectedUnit.location}
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN VIEW AREA                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-line px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-subtle no-print">
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded text-slate hover:text-ink hover:bg-surface"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Location Context Trigger for Super/Local Admin */}
            {(isSuperAdmin || isLocalAdmin) && (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-line text-[11px] font-medium text-ink"
                title="Switch location context"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0"></span>
                <span className="truncate max-w-[110px]">{selectedUnit ? selectedUnit.unit_name : 'All Units'}</span>
                <ChevronDown className="w-3 h-3 text-slate shrink-0" />
              </button>
            )}

            {/* Global Search Bar */}
            <form onSubmit={handleGlobalSearch} className="relative flex-1 max-w-md hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                type="text"
                placeholder="Global search by item code, serial no, voucher..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
              />
            </form>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-4">
            {/* Unit Context Tag / Switcher */}
            {isSuperAdmin || isLocalAdmin ? (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line hover:border-signal/70 hover:bg-surface/90 text-xs font-medium text-ink transition-all cursor-pointer shadow-2xs group"
                title="Click to switch location context"
              >
                <span className="w-2 h-2 rounded-full bg-signal shrink-0 ring-2 ring-signal/20 group-hover:scale-110 transition-transform"></span>
                <span className="truncate max-w-[180px] font-semibold text-ink">
                  {selectedUnit ? selectedUnit.unit_name : 'All Units'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate group-hover:text-ink transition-colors shrink-0" />
              </button>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface border border-line text-xs font-medium text-ink">
                <span className="w-2 h-2 rounded-full bg-signal"></span>
                <span className="truncate max-w-[180px]">
                  {selectedUnit ? selectedUnit.unit_name : 'No Unit'}
                </span>
              </div>
            )}

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-surface transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-ink text-signal font-semibold text-xs flex items-center justify-center border border-line">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-ink leading-tight truncate max-w-[130px]">
                    {user?.full_name || 'Staff User'}
                  </div>
                  <div className="text-[10px] text-slate capitalize">
                    {user?.role?.replace('_', ' ') || 'User'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate" />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div
                  onClick={() => setProfileDropdownOpen(false)}
                  className="absolute right-0 mt-2 w-56 bg-card border border-line rounded-lg shadow-modal py-1.5 z-50 text-xs text-ink animate-fade-in"
                >
                  <div className="px-3.5 py-2 border-b border-line">
                    <div className="font-semibold">{user?.full_name}</div>
                    <div className="text-[11px] text-slate truncate">{user?.email || user?.username}</div>
                    <div className="text-[10px] font-mono text-signal mt-1 uppercase">
                      Role: {user?.role?.replace('_', ' ')}
                      {user?.permission_level && ` (${user.permission_level.replace('_', ' ')})`}
                    </div>
                  </div>

                  <Link
                    to="/settings"
                    className="flex items-center gap-2 px-3.5 py-2 hover:bg-surface text-slate hover:text-ink transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Account Profile</span>
                  </Link>

                  <button
                    onClick={logout}
                    className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[#B4483A]/10 text-slate hover:text-[#B4483A] transition-colors border-t border-line mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumb Bar */}
        {breadcrumbs.length > 0 && (
          <div className="px-6 py-2.5 bg-surface border-b border-line/60 text-[11px] text-slate flex items-center gap-1.5 no-print">
            <Link to="/" className="hover:text-ink">Dashboard</Link>
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={idx}>
                <span>&gt;</span>
                {b.path ? (
                  <Link to={b.path} className="hover:text-ink">{b.label}</Link>
                ) : (
                  <span className="font-semibold text-ink">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Universal Footer per Wireframe Specifications */}
        <footer className="mt-auto border-t border-line py-4 px-6 text-center text-xs text-slate bg-card no-print">
          <div className="flex flex-wrap items-center justify-center gap-4 text-ink font-medium mb-1">
            <span className="text-signal font-semibold">EDL IMS</span>
            <span>|</span>
            <a href="#about" onClick={(e) => { e.preventDefault(); alert("Electricity Distribution Lanka (Pvt) Ltd - Inventory Management System v1.0.0"); }} className="hover:text-signal">About Us</a>
            <span>|</span>
            <a href="#help" onClick={(e) => { e.preventDefault(); alert("For technical assistance contact EDL IT Helpdesk: support@edl.lk / ext: 4022"); }} className="hover:text-signal">Help</a>
            <span>|</span>
            <a href="#contact" onClick={(e) => { e.preventDefault(); alert("Electricity Distribution Lanka (Pvt) Ltd, Regional Operations & Logistics Branch."); }} className="hover:text-signal">Contact</a>
          </div>
          <div className="text-[11px] text-slate">
            &copy; {new Date().getFullYear()} Electricity Distribution Lanka (Pvt) Ltd. All rights reserved.
          </div>
        </footer>
      </div>

      {/* Hierarchical Location Switcher Modal for Super Admin and Local Admin */}
      {(isSuperAdmin || isLocalAdmin) && (
        <LocationSwitcherModal
          isOpen={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
        />
      )}
    </div>
  );
};
