import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { CATEGORY_SUBTYPES, registerCustomItemTypes } from '../../constants/categorySubtypes';
import { registerCustomItemTypeCode } from '../../utils/serialNumberGenerator';
import { isDisposalRecipientRole } from '../../utils/disposalPermissions';
import { LocationSwitcherModal } from './LocationSwitcherModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Breadcrumb } from './Breadcrumb';
import { resolveBreadcrumbs } from '../../utils/breadcrumbResolver';
import sidebarBg from '../../assets/edl_ims_bg.png';
import { EDL_LOGO } from '../../constants/assets';
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
  FileText,
  Bell
} from 'lucide-react';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export const AppShell = ({ children, breadcrumbs = [] }) => {
  const { user, selectedUnit, logout, isSuperAdmin, isLocalAdmin, canWrite, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  // Notification state & polling for recipient roles
  const toast = useToast();
  const showNotifications = isDisposalRecipientRole(user);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsDropdownOpen, setNotificationsDropdownOpen] = useState(false);
  const notifDropdownRef = useRef(null);
  const seenNotificationIdsRef = useRef(new Set());
  const isInitialPollRef = useRef(true);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotificationsDropdownOpen(false);
      }
    }
    if (notificationsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [notificationsDropdownOpen]);

  // Polling notifications every 20 seconds and on window focus
  useEffect(() => {
    if (!showNotifications) return;

    let isMounted = true;

    const poll = async () => {
      try {
        const res = await api.get('/notifications?limit=20');
        if (!isMounted || !res.success || !Array.isArray(res.data)) return;

        setNotifications(res.data);
        setUnreadCount(typeof res.unread_count === 'number' ? res.unread_count : res.data.filter(n => !n.read_at).length);

        if (isInitialPollRef.current) {
          res.data.forEach(n => seenNotificationIdsRef.current.add(n.id));
          isInitialPollRef.current = false;
          return;
        }

        const newArrivals = res.data.filter(n => !seenNotificationIdsRef.current.has(n.id) && !n.read_at);
        if (newArrivals.length > 0) {
          newArrivals.forEach(n => seenNotificationIdsRef.current.add(n.id));

          if (newArrivals.length <= 3) {
            newArrivals.forEach(n => {
              toast.notifyArrival(n.message, {
                label: 'Open',
                onClick: () => navigate(n.link || `/disposal-requests/${n.request_id}`)
              });
            });
          } else {
            toast.notifyArrival(`${newArrivals.length} new disposal requests received`, {
              label: 'Open',
              onClick: () => navigate('/disposal-requests?status=submitted')
            });
          }
        }
      } catch (err) {
        // non-blocking
      }
    };

    poll();
    const intervalId = setInterval(poll, 20000);
    const handleFocus = () => poll();
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [showNotifications, navigate, toast]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      // non-blocking
    }
  };

  const handleNotificationClick = async (notif) => {
    setNotificationsDropdownOpen(false);
    if (!notif.read_at) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        // non-blocking
      }
    }
    navigate(notif.link || `/disposal-requests/${notif.request_id}`);
  };

  // Automatically resolve breadcrumb trail from route and any page-provided breadcrumbs
  const resolvedCrumbs = useMemo(() => {
    return resolveBreadcrumbs(location.pathname, breadcrumbs);
  }, [location.pathname, breadcrumbs]);

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

    api.get('/inventory/item-types').then(res => {
      if (isMounted && res.success && Array.isArray(res.itemTypes)) {
        const bySubcat = {};
        res.itemTypes.forEach(t => {
          const subSlug = t.subcategory_slug;
          if (!subSlug) return;
          if (!bySubcat[subSlug]) bySubcat[subSlug] = [];
          bySubcat[subSlug].push(t);
          if (t.code) {
            try {
              registerCustomItemTypeCode(subSlug, t.name, t.code);
            } catch {
              // ignore duplicate registration
            }
          }
        });
        Object.keys(bySubcat).forEach(subSlug => {
          registerCustomItemTypes(subSlug, bySubcat[subSlug]);
        });
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
    reports: location.pathname.startsWith('/reports'),
    users: false,
    settings: location.pathname.startsWith('/settings')
  });

  useEffect(() => {
    if (location.pathname.startsWith('/reports')) {
      setExpandedSections(prev => prev.reports ? prev : { ...prev, reports: true });
    }
    if (location.pathname.startsWith('/settings')) {
      setExpandedSections(prev => prev.settings ? prev : { ...prev, settings: true });
    }
  }, [location.pathname]);

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

  const handleReportsClick = () => {
    if (location.pathname !== '/reports') {
      navigate('/reports');
      setExpandedSections(prev => ({ ...prev, reports: true }));
    } else {
      setExpandedSections(prev => ({ ...prev, reports: !prev.reports }));
    }
  };

  const handleReportsToggleOnly = (e) => {
    e.stopPropagation();
    setExpandedSections(prev => ({ ...prev, reports: !prev.reports }));
  };

  const isCurrent = (path) => location.pathname === path;
  const isSectionActive = (paths) => paths.some(p => location.pathname.startsWith(p));

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/reports/inventory?search=${encodeURIComponent(globalSearch.trim())}`);
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 overflow-hidden bg-[#280818] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Full-height faint office photo background */}
        <img
          src={sidebarBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none z-0"
        />
        {/* Maroon scrim */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(180deg, rgba(40,8,24,0.86) 0%, rgba(52,10,30,0.80) 55%, rgba(40,8,24,0.90) 100%)'
          }}
        />

        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-3.5 border-b border-white/10 shrink-0 relative z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="shrink-0 flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: '#fbf6f1',
                borderRadius: '14px',
                padding: '6px 10px'
              }}
            >
              <img
                src={EDL_LOGO}
                alt="EDL"
                style={{ height: '32px', width: 'auto', display: 'block' }}
              />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white leading-tight">
                EDL IMS
              </div>
              <div className="text-[10px] font-medium tracking-wider" style={{ color: '#f6c026' }}>
                Electricity Distribution Lanka
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (Numbered 1-6 per specification) */}
        <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-6 space-y-1.5 text-xs relative z-10">
          {user?.permission_level === 'disposal_only' ? (
            <div className="pt-2">
              <Link
                to="/disposal-requests"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors relative font-medium ${
                  location.pathname.startsWith('/disposal')
                    ? 'bg-white/14 text-[#f6c026] font-semibold border-l-[3px] border-[#f6c026]'
                    : 'text-white/85 hover:bg-white/8 hover:text-white'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 shrink-0 text-[#f6c026]" />
                <span>Disposal Requests</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Dashboard */}
              <Link
                to="/"
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors relative ${
                  isCurrent('/')
                    ? 'bg-white/14 text-white font-semibold shadow-[inset_0_0_0_1px_rgba(246,192,38,0.55)] border-l-[3px] border-[#f6c026]'
                    : 'text-white/85 hover:bg-white/8 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0 text-[#f6c026]" />
                <span>Dashboard</span>
              </Link>

          {/* 1. Inventory */}
          {can('view_inventory') && (
            <div>
              <button
                onClick={() => toggleSection('inventory')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isSectionActive(['/inventory'])
                    ? 'text-[#f6c026] font-semibold'
                    : 'text-white/85 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[#f6c026] font-bold">1</span>
                  <Boxes className="w-4 h-4 shrink-0" />
                  <span>Inventory</span>
                </div>
                {expandedSections.inventory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

            {expandedSections.inventory && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                {/* Submenu for Item Categories */}
                <div className="pt-0.5">
                  <div
                    id="sidebar-item-categories-toggle"
                    onClick={handleItemCategoriesClick}
                    className={`w-full flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors group ${
                      isCurrent('/inventory/categories')
                        ? 'bg-white/12 text-[#f6c026] font-semibold border-l-2 border-[#f6c026] pl-1.5'
                        : location.pathname.startsWith('/inventory/categor')
                        ? 'text-[#f6c026] font-medium bg-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <span className="truncate">Item Categories</span>
                    <button
                      type="button"
                      id="sidebar-item-categories-chevron"
                      onClick={handleItemCategoriesToggleOnly}
                      className="p-0.5 rounded hover:bg-white/10 text-white/70 group-hover:text-white transition-colors"
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
                    <div className="pl-2 pr-1 py-1 space-y-0.5 border-l border-white/18 ml-2 mt-0.5 animate-fade-in">
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
                                ? 'bg-white/14 text-[#f6c026] font-semibold border-l-2 border-[#f6c026] pl-1.5'
                                : 'text-white/70 hover:text-white hover:bg-white/8'
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
        )}

          {/* 2. Transactions */}
          {can('view_inventory') && (
            <div>
              <div
                id="sidebar-transactions-toggle"
                onClick={handleTransactionsClick}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                isCurrent('/transactions')
                  ? 'bg-white/12 text-[#f6c026] font-semibold border-l-2 border-[#f6c026] pl-2.5'
                  : isSectionActive(['/transactions'])
                  ? 'text-[#f6c026] font-semibold bg-white/5'
                  : 'text-white/85 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[#f6c026] font-bold">2</span>
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span>Transactions</span>
              </div>
              <button
                type="button"
                id="sidebar-transactions-chevron"
                onClick={handleTransactionsToggleOnly}
                className="p-0.5 rounded hover:bg-white/10 text-white/70 group-hover:text-white transition-colors"
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
                    isCurrent('/transactions/received') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Received Items
                </Link>
                <Link
                  to="/transactions/expended"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/transactions/expended') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Expended Items
                </Link>
                <Link
                  to="/transactions/remaining"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/transactions/remaining') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Remaining
                </Link>
              </div>
            )}
          </div>
        )}

          {/* 3. Annual Verification */}
          <div>
            <div
              id="sidebar-verification-toggle"
              onClick={handleVerificationClick}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                isCurrent('/verification') || isCurrent('/annual-verification') || isCurrent('/disposal-requests') || isCurrent('/verification/teams')
                  ? 'bg-white/12 text-[#f6c026] font-semibold border-l-2 border-[#f6c026] pl-2.5'
                  : isSectionActive(['/verification', '/annual-verification', '/disposal-requests', '/verification/teams'])
                  ? 'text-[#f6c026] font-semibold bg-white/5'
                  : 'text-white/85 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[#f6c026] font-bold">3</span>
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span>Annual Verification</span>
              </div>
              <button
                type="button"
                id="sidebar-verification-chevron"
                onClick={handleVerificationToggleOnly}
                className="p-0.5 rounded hover:bg-white/10 text-white/70 group-hover:text-white transition-colors"
                title={expandedSections.verification ? 'Collapse verification' : 'Expand verification'}
                aria-label="Toggle Verification Submenu"
              >
                {expandedSections.verification ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {expandedSections.verification && (
              <div className="pl-7 pr-2 py-1 space-y-1">
                {can('manage_verification_teams') && (
                  <Link
                    to="/verification/teams"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      location.pathname.startsWith('/verification/teams') || location.pathname.startsWith('/annual-verification/teams')
                        ? 'bg-white/12 text-[#f6c026] font-medium'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Verification Teams
                  </Link>
                )}
                {can('add_inventory') && (
                  <Link
                    to="/verification/new"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/verification/new') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    New Verification
                  </Link>
                )}
                <Link
                  to="/verification/issued-destroyed"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    location.pathname.startsWith('/verification/issued-destroyed') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Issued / Destroyed
                </Link>
                <Link
                  to="/verification/history"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    isCurrent('/verification/history') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Verification History
                </Link>
                <Link
                  to="/disposal-requests"
                  className={`block py-1.5 px-2 rounded transition-colors ${
                    location.pathname.startsWith('/disposal-requests') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Disposal Requests
                </Link>
              </div>
            )}
          </div>

          {/* 4. Reports */}
          {can('view_reports') && (
            <div>
              <div
                onClick={handleReportsClick}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                  isCurrent('/reports')
                    ? 'bg-white/12 text-[#f6c026] font-semibold border-l-2 border-[#f6c026] pl-2.5'
                    : isSectionActive(['/reports'])
                    ? 'text-[#f6c026] font-semibold bg-white/5'
                    : 'text-white/85 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[#f6c026] font-bold">4</span>
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Reports</span>
                </div>
                <button
                  type="button"
                  id="sidebar-reports-chevron"
                  onClick={handleReportsToggleOnly}
                  className="p-0.5 rounded hover:bg-white/10 text-white/70 group-hover:text-white transition-colors"
                  title={expandedSections.reports ? 'Collapse reports' : 'Expand reports'}
                  aria-label="Toggle Reports Submenu"
                >
                  {expandedSections.reports ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {expandedSections.reports && (
                <div className="pl-7 pr-2 py-1 space-y-1">
                  <Link
                    to="/reports/inventory"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/reports/inventory') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Current Inventory
                  </Link>
                  <Link
                    to="/reports/transactions"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/reports/transactions') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Transaction History
                  </Link>
                  <Link
                    to="/reports/verification"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/reports/verification') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Verification Audit
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 5. User Management (Admin Only) */}
          {can('manage_permissions') && (
            <div>
              <button
                onClick={() => toggleSection('users')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isSectionActive(['/users'])
                    ? 'text-[#f6c026] font-semibold'
                    : 'text-white/85 hover:bg-white/8 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[#f6c026] font-bold">5</span>
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
                      isCurrent('/users') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
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
                  ? 'text-[#f6c026] font-semibold'
                  : 'text-white/85 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[#f6c026] font-bold">6</span>
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
                    isCurrent('/settings') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                  }`}
                >
                  Account Profile
                </Link>
                {(isSuperAdmin || isLocalAdmin) && (
                  <Link
                    to="/settings/units"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/settings/units') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Units &amp; Locations
                  </Link>
                )}
                {(isSuperAdmin || isLocalAdmin || user?.role === 'unit_head') && (
                  <Link
                    to="/settings/audit-log"
                    className={`block py-1.5 px-2 rounded transition-colors ${
                      isCurrent('/settings/audit-log') ? 'bg-white/12 text-[#f6c026] font-medium' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Audit Log
                  </Link>
                )}
              </div>
            )}
          </div>
          </>
        )}
        </nav>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN VIEW AREA                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#eee6e1] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-subtle no-print">
          <div className="flex items-center gap-3 flex-1">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded text-[#8a7a80] hover:text-[#280818] hover:bg-[#fcfbf9]"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Location Context Trigger for Super/Local Admin */}
            {(isSuperAdmin || isLocalAdmin) && (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#eee6e1] text-[11px] font-medium"
                style={{ backgroundColor: '#fbf6f1', color: '#7a1a3c' }}
                title="Switch location context"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#f6c026] shrink-0"></span>
                <span className="truncate max-w-[110px] font-semibold">{selectedUnit ? selectedUnit.unit_name : 'All Units'}</span>
                <ChevronDown className="w-3 h-3 text-[#7a1a3c]/70 shrink-0" />
              </button>
            )}

            {/* Global Search Bar */}
            <form onSubmit={handleGlobalSearch} className="relative flex-1 max-w-md hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7a80]" />
              <input
                type="text"
                placeholder="Global search by serial no, voucher..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#e6dcd7] rounded-lg focus:outline-none focus:border-[#7a1a3c] focus:ring-2 focus:ring-[#7a1a3c]/35 text-[#2a1520] placeholder-[#8a7a80]"
              />
            </form>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-4">
            {/* Notifications Bell (Super Admin, Local Admin, disposal_only) */}
            {showNotifications && (
              <div className="relative" ref={notifDropdownRef}>
                <button
                  type="button"
                  id="btn-notifications-bell"
                  onClick={() => setNotificationsDropdownOpen(prev => !prev)}
                  className="relative p-2 rounded-lg text-[#8a7a80] hover:text-[#7a1a3c] hover:bg-[#fcfbf9] transition-colors cursor-pointer"
                  title="Disposal Request Notifications"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-[#B4483A] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs animate-scale-up">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Panel */}
                {notificationsDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-line rounded-xl shadow-modal z-50 overflow-hidden animate-scale-up">
                    <div className="px-4 py-3 bg-surface/70 border-b border-line flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-signal" />
                        <span className="text-xs font-bold text-ink">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-signal/15 text-signal text-[10px] font-semibold rounded-full">
                            {unreadCount} unread
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[11px] text-signal font-semibold hover:underline cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-line/60">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const isUnread = !notif.read_at;
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3 transition-colors cursor-pointer flex items-start gap-3 hover:bg-surface/60 ${
                                isUnread ? 'bg-signal/5' : ''
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  isUnread ? 'bg-signal ring-2 ring-signal/20' : 'bg-transparent'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-ink truncate">
                                    {notif.title}
                                  </span>
                                  <span className="text-[10px] text-slate shrink-0">
                                    {formatRelativeTime(notif.created_at)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate mt-0.5 leading-snug">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Unit Context Tag / Switcher */}
            {isSuperAdmin || isLocalAdmin ? (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#eee6e1] hover:border-[#7a1a3c]/50 text-xs font-medium transition-all cursor-pointer shadow-2xs group"
                style={{ backgroundColor: '#fbf6f1', color: '#7a1a3c' }}
                title="Click to switch location context"
              >
                <span className="w-2 h-2 rounded-full bg-[#f6c026] shrink-0 ring-2 ring-[#f6c026]/30 group-hover:scale-110 transition-transform"></span>
                <span className="truncate max-w-[180px] font-semibold text-[#7a1a3c]">
                  {selectedUnit ? selectedUnit.unit_name : 'All Units'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#7a1a3c]/70 group-hover:text-[#7a1a3c] transition-colors shrink-0" />
              </button>
            ) : (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#eee6e1] text-xs font-semibold"
                style={{ backgroundColor: '#fbf6f1', color: '#7a1a3c' }}
              >
                <span className="w-2 h-2 rounded-full bg-[#f6c026]"></span>
                <span className="truncate max-w-[180px]">
                  {selectedUnit ? selectedUnit.unit_name : 'No Unit'}
                </span>
              </div>
            )}

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(prev => !prev)}
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-[#fcfbf9] transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full text-white font-semibold text-xs flex items-center justify-center shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #5a1230, #7a1a3c)' }}
                >
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-[#2a1520] leading-tight truncate max-w-[130px]">
                    {user?.full_name || 'Staff User'}
                  </div>
                  <div className="text-[10px] text-[#8a7a80] capitalize">
                    {user?.role?.replace('_', ' ') || 'User'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8a7a80]" />
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
                    <div className="text-[10px] font-mono text-[#f6c026] mt-1 uppercase">
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
                    className="w-full text-left flex items-center gap-2 px-3.5 py-2 hover:bg-[#b33947]/10 text-slate hover:text-[#b33947] transition-colors border-t border-line mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumb Bar: A light strip under the top header */}
        {resolvedCrumbs.length > 0 && location.pathname !== '/' && (
          <div className="w-full px-4 sm:px-6 py-2.5 bg-surface/90 backdrop-blur-xs border-b border-line/60 text-[11px] sm:text-xs text-[#4A4D5A] flex items-center no-print relative z-20 min-h-[38px]">
            <div className="max-w-7xl w-full mx-auto flex items-center">
              <Breadcrumb breadcrumbs={resolvedCrumbs} />
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 pb-6 pt-4 max-w-7xl w-full mx-auto relative">
          {location.pathname === '/' ? (
            <div
              aria-hidden="true"
              className="dashboard-bg-layer fixed inset-0 lg:left-64 pointer-events-none select-none z-0 overflow-hidden bg-[#2A2230]"
            >
              {/* Office interior background with blur(2px) saturate(1.05) on desktop, reduced blur on mobile */}
              <div
                className="absolute inset-0 bg-cover bg-no-repeat bg-scroll md:bg-fixed filter sm:blur-[2px] blur-[1px] saturate-[1.05] scale-[1.03] transition-all"
                style={{
                  backgroundImage: "var(--dash-bg-image, url('/images/edl_ims_bg.png'))",
                  backgroundPosition: '50% 40%',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover'
                }}
              />
              {/* Brand Maroon & Dark Tint Overlay */}
              <div
                className="dashboard-overlay-layer absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(123, 28, 62, 0.28) 0%, rgba(20, 20, 32, 0.45) 100%)'
                }}
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="page-bg-container fixed inset-0 lg:left-64 pointer-events-none select-none z-0 overflow-hidden bg-surface"
            >
              {/* Soft blurred office background photo (fixed on desktop, scroll on mobile) */}
              <div
                className="page-bg-photo absolute inset-0 bg-cover bg-center bg-no-repeat bg-scroll md:bg-fixed filter sm:blur-[2px] blur-[1.5px] scale-[1.02] transition-all"
                style={{
                  backgroundImage: "var(--page-bg-image, url('/images/edl_ims_bg.png'))",
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover'
                }}
              />
              {/* Very light top-to-bottom white gradient veil (controlled by --page-bg-veil) */}
              <div
                className="page-bg-veil-layer absolute inset-0"
                style={{
                  background: 'var(--page-bg-veil, linear-gradient(180deg, rgba(252, 251, 249, 0.82) 0%, rgba(252, 251, 249, 0.79) 160px, rgba(252, 251, 249, 0.76) 100%))'
                }}
              />
            </div>
          )}
          <div className="relative z-10">
            <ErrorBoundary level="page">
              {children}
            </ErrorBoundary>
          </div>
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
