import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';

// Pages
import { Welcome } from './pages/Welcome';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { UpdatePassword } from './pages/UpdatePassword';
import { Dashboard } from './pages/Dashboard';
import { CategoriesPage } from './pages/CategoriesPage';
import { CategoryInventoryPage } from './pages/CategoryInventoryPage';
import { ReceivedTransactions } from './pages/ReceivedTransactions';
import { ExpendedTransactions } from './pages/ExpendedTransactions';
import { RemainingInventory } from './pages/RemainingInventory';
import { TransactionsOverviewPage } from './pages/TransactionsOverviewPage';
import { AnnualVerificationOverviewPage } from './pages/AnnualVerificationOverviewPage';
import { NewVerification } from './pages/NewVerification';
import { VerificationHistory } from './pages/VerificationHistory';
import { IssuedDestroyedPage } from './pages/IssuedDestroyedPage';
import { AddIssuedDestroyedPage } from './pages/AddIssuedDestroyedPage';
import { EditIssuedDestroyedPage } from './pages/EditIssuedDestroyedPage';
import { DisposalRequestsListPage } from './pages/DisposalRequestsListPage';
import { NewDisposalRequestPage } from './pages/NewDisposalRequestPage';
import { DisposalRequestDetailPage } from './pages/DisposalRequestDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReportsOverviewPage } from './pages/ReportsOverviewPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { UnitManagementPage } from './pages/UnitManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRoles = [], requireWrite = false, requiredPermission = null }) => {
  const { user, loading, canRead, canWrite, isSuperAdmin, logout, can } = useAuth();
  const location = useLocation();
  const toast = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-line border-t-ink rounded-full animate-spin"></div>
          <div className="text-xs text-slate font-medium">Verifying EDL staff credentials...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Central redirect for disposal_only users:
  if (user.permission_level === 'disposal_only') {
    const isDisposalPath = location.pathname.startsWith('/disposal');
    if (!isDisposalPath) {
      toast.error('Access denied: Your account is restricted to Disposal Requests.');
      return <Navigate to="/disposal-requests" replace />;
    }
  }

  // Check if blocked by 'no_permission' (allow access to disposal requests)
  const isDisposalRoute = location.pathname.startsWith('/disposal');
  if (!canRead && !isSuperAdmin && !isDisposalRoute) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-line p-8 max-w-md text-center shadow-card">
          <div className="w-12 h-12 rounded-full bg-[#B4483A]/10 text-[#B4483A] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-base font-semibold text-ink">Access Denied (No Permission)</h2>
          <p className="text-xs text-slate mt-2 leading-relaxed">
            Your employee account has no active inventory permissions assigned. Please contact your Local Administrator to grant access.
          </p>
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="mt-6 px-4 py-2 bg-ink hover:bg-[#193254] text-white rounded text-xs font-semibold transition-colors"
          >
            Log Out / Switch Account
          </button>
        </div>
      </div>
    );
  }

  // Check granular permission if specified
  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  // Check if write permission is required (e.g. creating new verification)
  if (requireWrite && !canWrite) {
    return <Navigate to="/" replace />;
  }

  // Check required roles if specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role) && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Redirect component for /disposal/:id
const DisposalIdRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/disposal-requests/${id}`} replace />;
};

// Public Welcome / Home Route Guard: Guest -> Welcome, Authenticated -> Dashboard
const HomeRoute = () => {
  const { user, loading } = useAuth();
  const hasPersistedToken = !!localStorage.getItem('edl_token');

  // If there's no persisted session token, guest immediately sees Welcome without any flash
  if (!hasPersistedToken && !user) {
    return <Welcome />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <div className="text-xs text-slate-300 font-medium">Verifying EDL staff credentials...</div>
        </div>
      </div>
    );
  }

  if (user) {
    if (user.permission_level === 'disposal_only') {
      return <Navigate to="/disposal-requests" replace />;
    }
    return (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    );
  }

  return <Welcome />;
};

const WelcomeRoute = () => {
  const { user, loading } = useAuth();
  const hasPersistedToken = !!localStorage.getItem('edl_token');

  if (!hasPersistedToken && !user) {
    return <Welcome />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <div className="text-xs text-slate-300 font-medium">Verifying EDL staff credentials...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }
  return <Welcome />;
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ErrorBoundary level="page">
            <Routes>
              {/* Public Auth & Welcome Routes */}
              <Route path="/welcome" element={<WelcomeRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />

              {/* Core Route: Welcome if guest, Dashboard if authenticated */}
              <Route path="/" element={<HomeRoute />} />

              {/* 1. Inventory */}
              <Route path="/inventory" element={<Navigate to="/inventory/categories" replace />} />
              <Route path="/inventory/categories" element={<ProtectedRoute requiredPermission="view_inventory"><CategoriesPage /></ProtectedRoute>} />
              <Route path="/inventory/category/:categoryId" element={<ProtectedRoute requiredPermission="view_inventory"><CategoryInventoryPage /></ProtectedRoute>} />
              <Route path="/inventory/category/:categoryId/:subType" element={<ProtectedRoute requiredPermission="view_inventory"><CategoryInventoryPage /></ProtectedRoute>} />
              <Route path="/inventory/categories/:categoryId" element={<ProtectedRoute requiredPermission="view_inventory"><CategoryInventoryPage /></ProtectedRoute>} />
              <Route path="/inventory/categories/:categoryId/:subType" element={<ProtectedRoute requiredPermission="view_inventory"><CategoryInventoryPage /></ProtectedRoute>} />

              {/* 2. Transactions */}
              <Route path="/transactions" element={<ProtectedRoute requiredPermission="view_inventory"><TransactionsOverviewPage /></ProtectedRoute>} />
              <Route path="/transactions/received" element={<ProtectedRoute requiredPermission="view_inventory"><ReceivedTransactions /></ProtectedRoute>} />
              <Route path="/transactions/expended" element={<ProtectedRoute requiredPermission="view_inventory"><ExpendedTransactions /></ProtectedRoute>} />
              <Route path="/transactions/remaining" element={<ProtectedRoute requiredPermission="view_inventory"><RemainingInventory /></ProtectedRoute>} />

              {/* 3. Annual Verification */}
              <Route path="/verification" element={<ProtectedRoute><AnnualVerificationOverviewPage /></ProtectedRoute>} />
              <Route path="/annual-verification" element={<ProtectedRoute><AnnualVerificationOverviewPage /></ProtectedRoute>} />
              <Route path="/verification/new" element={<ProtectedRoute requiredPermission="add_inventory"><NewVerification /></ProtectedRoute>} />
              <Route path="/verification/history" element={<ProtectedRoute><VerificationHistory /></ProtectedRoute>} />
              <Route path="/verification/issued-destroyed" element={<ProtectedRoute><IssuedDestroyedPage /></ProtectedRoute>} />
              <Route path="/verification/issued-destroyed/add" element={<ProtectedRoute requiredPermission="add_inventory"><AddIssuedDestroyedPage /></ProtectedRoute>} />
              <Route path="/verification/issued-destroyed/:id/edit" element={<ProtectedRoute requiredPermission="update_inventory"><EditIssuedDestroyedPage /></ProtectedRoute>} />

              {/* Disposal Requests with /disposal aliases */}
              <Route path="/disposal" element={<Navigate to="/disposal-requests" replace />} />
              <Route path="/disposal/new" element={<Navigate to="/disposal-requests/new" replace />} />
              <Route path="/disposal/:id" element={<DisposalIdRedirect />} />
              <Route path="/disposal-requests" element={<ProtectedRoute><DisposalRequestsListPage /></ProtectedRoute>} />
              <Route path="/disposal-requests/new" element={<ProtectedRoute><NewDisposalRequestPage /></ProtectedRoute>} />
              <Route path="/disposal-requests/:id" element={<ProtectedRoute><DisposalRequestDetailPage /></ProtectedRoute>} />

              {/* 4. Reports */}
              <Route path="/reports" element={<ProtectedRoute requiredPermission="view_reports"><ReportsOverviewPage /></ProtectedRoute>} />
              <Route path="/reports/:tab" element={<ProtectedRoute requiredPermission="view_reports"><ReportsPage /></ProtectedRoute>} />

              {/* 5. User Management (Admin Only) */}
              <Route path="/users" element={
                <ProtectedRoute allowedRoles={['super_admin', 'local_admin']} requiredPermission="manage_permissions">
                  <UserManagementPage />
                </ProtectedRoute>
              } />

              {/* 6. Settings */}
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/settings/units" element={
                <ProtectedRoute allowedRoles={['super_admin', 'local_admin']}>
                  <UnitManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/settings/audit-log" element={
                <ProtectedRoute allowedRoles={['super_admin', 'local_admin', 'unit_head']}>
                  <AuditLogPage />
                </ProtectedRoute>
              } />

              {/* Catch-all 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
