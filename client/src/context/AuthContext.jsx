import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { canManageCategoryTypes, can as checkCan } from '../utils/permissions';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('edl_token'));
  const [loading, setLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState(localStorage.getItem('edl_active_unit') || '');
  const [systemUnits, setSystemUnits] = useState([]);

  const fetchUnits = async () => {
    try {
      const res = await api.get('/units');
      if (res.success && Array.isArray(res.data)) {
        setSystemUnits(res.data);
      }
    } catch (err) {
      console.warn('Failed to load system units:', err.message);
    }
  };

  const fetchProfile = async () => {
    try {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const res = await api.get('/auth/me');
      if (res.success && res.data?.user) {
        const u = res.data.user;
        setUser(u);
        const userUnits = u.units || [];

        // Fetch system-wide units catalog
        fetchUnits();

        if (u.role !== 'super_admin' && u.role !== 'local_admin') {
          // If restricted role (unit_head, employee), ensure selectedUnitId is one of their assigned units
          if (!selectedUnitId || !userUnits.some(unit => unit.id === selectedUnitId)) {
            const defaultId = userUnits[0]?.id || '';
            setSelectedUnitId(defaultId);
            if (defaultId) localStorage.setItem('edl_active_unit', defaultId);
            else localStorage.removeItem('edl_active_unit');
          }
        } else if (!selectedUnitId) {
          // Super Admin and Local Admin default to Global / All Units if no unit persisted
          setSelectedUnitId('');
          localStorage.removeItem('edl_active_unit');
        }
      }
    } catch (err) {
      console.warn('Session expired or invalid token:', err.message);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.success && res.data) {
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('edl_token', newToken);
      setToken(newToken);
      setUser(newUser);

      // Fetch units list
      fetchUnits();

      if (newUser.role !== 'super_admin' && newUser.role !== 'local_admin' && newUser.units && newUser.units.length > 0) {
        const initialUnit = newUser.units[0].id;
        setSelectedUnitId(initialUnit);
        localStorage.setItem('edl_active_unit', initialUnit);
      } else {
        setSelectedUnitId('');
        localStorage.removeItem('edl_active_unit');
      }
      return newUser;
    }
    throw new Error(res.message || 'Login failed');
  };

  const logout = () => {
    try {
      api.post('/auth/logout').catch(() => {});
    } catch {}
    localStorage.removeItem('edl_token');
    localStorage.removeItem('edl_active_unit');
    setToken(null);
    setUser(null);
    setSelectedUnitId('');
  };

  const changeActiveUnit = (unitId) => {
    if (user && user.role !== 'super_admin' && user.role !== 'local_admin') {
      const allowed = (user.units || []).some(u => u.id === unitId);
      if (!allowed) {
        console.warn('Unauthorized unit switch attempt blocked.');
        return;
      }
    }
    setSelectedUnitId(unitId);
    if (unitId) {
      localStorage.setItem('edl_active_unit', unitId);
    } else {
      localStorage.removeItem('edl_active_unit');
    }
  };

  // Permission helpers
  const isSuperAdmin = user?.role === 'super_admin';
  const isLocalAdmin = user?.role === 'local_admin';
  const isUnitHead = user?.role === 'unit_head';
  const isEmployee = user?.role === 'employee';

  const can = useCallback((permissionKey) => {
    return checkCan(permissionKey, user);
  }, [user]);

  const canViewInventory = can('view_inventory');
  const canAddInventory = can('add_inventory');
  const canUpdateInventory = can('update_inventory');
  const canDeleteInventory = can('delete_inventory');
  const canViewReports = can('view_reports');
  const canManagePermissions = can('manage_permissions');
  const canManageVerificationTeams = can('manage_verification_teams');

  const canWrite = canAddInventory || canUpdateInventory;
  const canRead = canViewInventory;
  const canManageTypes = canManageCategoryTypes(user);
  const canAddItemTypes = canManageCategoryTypes(user);
  const canManageCategories = canManageCategoryTypes(user);

  // Resolve selectedUnit from systemUnits first (system-wide), then user's assigned units
  const selectedUnit = systemUnits.find(u => u.id === selectedUnitId) || user?.units?.find(u => u.id === selectedUnitId) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        selectedUnitId,
        selectedUnit,
        systemUnits,
        changeActiveUnit,
        login,
        logout,
        refreshUser: fetchProfile,
        refreshUnits: fetchUnits,
        isSuperAdmin,
        isLocalAdmin,
        isUnitHead,
        isEmployee,
        can,
        canViewInventory,
        canAddInventory,
        canUpdateInventory,
        canDeleteInventory,
        canViewReports,
        canManagePermissions,
        canManageVerificationTeams,
        canWrite,
        canRead,
        canManageTypes,
        canAddItemTypes,
        canManageCategories,
        canManageCategoryTypes: () => canManageCategoryTypes(user)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const usePermissions = () => {
  const {
    can,
    canViewInventory,
    canAddInventory,
    canUpdateInventory,
    canDeleteInventory,
    canViewReports,
    canManagePermissions,
    user
  } = useAuth();

  return {
    can,
    canViewInventory,
    canAddInventory,
    canUpdateInventory,
    canDeleteInventory,
    canViewReports,
    canManagePermissions,
    user
  };
};
