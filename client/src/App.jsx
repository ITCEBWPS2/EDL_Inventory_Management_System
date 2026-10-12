import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { InventoryList } from './pages/InventoryList';
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
import { ReportsPage } from './pages/ReportsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { UnitManagementPage } from './pages/UnitManagementPage';
import { SettingsPage } from './pages/SettingsPage';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRoles = [], requireWrite = false }) => {
  const { user, loading, canRead, canWrite, isSuperAdmin, logout } = useAuth();

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

  // Check if blocked by 'no_permission'
  if (!canRead && !isSuperAdmin) {
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Core Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* 1. Inventory */}
            <Route path="/inventory" element={<ProtectedRoute><InventoryList /></ProtectedRoute>} />
            <Route path="/inventory/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
            <Route path="/inventory/category/:categoryId" element={<ProtectedRoute><CategoryInventoryPage /></ProtectedRoute>} />
            <Route path="/inventory/category/:categoryId/:subType" element={<ProtectedRoute><CategoryInventoryPage /></ProtectedRoute>} />
            <Route path="/inventory/categories/:categoryId" element={<ProtectedRoute><CategoryInventoryPage /></ProtectedRoute>} />
            <Route path="/inventory/categories/:categoryId/:subType" element={<ProtectedRoute><CategoryInventoryPage /></ProtectedRoute>} />

            {/* 2. Transactions */}
            <Route path="/transactions" element={<ProtectedRoute><TransactionsOverviewPage /></ProtectedRoute>} />
            <Route path="/transactions/received" element={<ProtectedRoute><ReceivedTransactions /></ProtectedRoute>} />
            <Route path="/transactions/expended" element={<ProtectedRoute><ExpendedTransactions /></ProtectedRoute>} />
            <Route path="/transactions/remaining" element={<ProtectedRoute><RemainingInventory /></ProtectedRoute>} />

            {/* 3. Annual Verification */}
            <Route path="/verification" element={<ProtectedRoute><AnnualVerificationOverviewPage /></ProtectedRoute>} />
            <Route path="/annual-verification" element={<ProtectedRoute><AnnualVerificationOverviewPage /></ProtectedRoute>} />
            <Route path="/verification/new" element={<ProtectedRoute requireWrite={true}><NewVerification /></ProtectedRoute>} />
            <Route path="/verification/history" element={<ProtectedRoute><VerificationHistory /></ProtectedRoute>} />
            <Route path="/verification/issued-destroyed" element={<ProtectedRoute><IssuedDestroyedPage /></ProtectedRoute>} />
            <Route path="/verification/issued-destroyed/add" element={<ProtectedRoute requireWrite={true}><AddIssuedDestroyedPage /></ProtectedRoute>} />
            <Route path="/verification/issued-destroyed/:id/edit" element={<ProtectedRoute requireWrite={true}><EditIssuedDestroyedPage /></ProtectedRoute>} />

            {/* 4. Reports */}
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/reports/:tab" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />

            {/* 5. User Management (Admin Only) */}
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['super_admin', 'local_admin']}>
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

            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
