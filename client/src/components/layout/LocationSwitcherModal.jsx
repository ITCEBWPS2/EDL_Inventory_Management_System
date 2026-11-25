import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { sortUnitChildren, buildUnitTree } from '../../utils/unitTree';
import { Button } from '../common/Button';
import { 
  X, Search, Globe, Building2, MapPin, Warehouse, 
  ChevronDown, ChevronRight, CheckCircle2 
} from 'lucide-react';

// Recursive Tree Node for Location Switcher
const LocationTreeNode = ({
  node,
  level = 0,
  selectedUnitId,
  onSelectUnit,
  expandedBranches,
  toggleBranch,
  searchQuery
}) => {
  const hasChildren = node.children && node.children.length > 0;
  // A node is a structural branch if unit_type === 'area' or it has children
  const isBranch = node.unit_type === 'area' || hasChildren;
  const isExpanded = searchQuery ? true : (expandedBranches[node.id] !== false); // Auto-expand when searching
  const isSelected = selectedUnitId === node.id;

  // Search filter matching logic (match self or any descendant)
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = item.unit_name?.toLowerCase().includes(q) || item.unit_code?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q);
    const childrenMatch = item.children && item.children.some(c => matchesSearch(c));
    return nameMatch || childrenMatch;
  };

  if (!matchesSearch(node)) return null;

  // Branch / Structural Nodes: Expandable/Collapsible navigation
  if (isBranch) {
    return (
      <div className="select-none text-xs">
        <div
          onClick={() => toggleBranch(node.id)}
          className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-surface cursor-pointer text-ink font-semibold transition-colors group"
          style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
          title={`Branch: ${node.unit_name} (${node.unit_code}) - Click to expand/collapse`}
        >
          <button
            type="button"
            className="p-0.5 rounded hover:bg-black/10 text-slate shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleBranch(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate group-hover:text-ink" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate group-hover:text-ink" />
            )}
          </button>
          <Building2 className={`w-3.5 h-3.5 shrink-0 ${level === 0 ? 'text-signal' : 'text-[#3A6D8C]'}`} />
          <span className="truncate">{node.unit_name}</span>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-line/50 ml-3.5 space-y-0.5 mt-0.5">
            {node.children.map(child => (
              <LocationTreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedUnitId={selectedUnitId}
                onSelectUnit={onSelectUnit}
                expandedBranches={expandedBranches}
                toggleBranch={toggleBranch}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Selectable Leaf Units (CSCs, operational units, labs, etc.)
  return (
    <div
      onClick={() => onSelectUnit(node.id)}
      className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs cursor-pointer transition-all border select-none ${
        isSelected
          ? 'bg-signal/15 border-signal text-ink font-semibold shadow-xs ring-1 ring-signal/30'
          : 'bg-card hover:bg-surface border-transparent text-ink hover:border-line/60'
      }`}
      style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
      title={`${node.unit_name} (${node.unit_code}) - ${node.location || ''}`}
    >
      <input
        type="radio"
        name="location_switcher_radio"
        checked={isSelected}
        onChange={() => onSelectUnit(node.id)}
        className="accent-signal w-4 h-4 cursor-pointer shrink-0"
      />
      {node.unit_type === 'csc' ? (
        <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal font-bold' : 'text-emerald-600'}`} />
      ) : (
        <Warehouse className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal font-bold' : 'text-slate'}`} />
      )}
      <span className="truncate flex-1">{node.unit_name}</span>
    </div>
  );
};

export const LocationSwitcherModal = ({ isOpen, onClose }) => {
  const { selectedUnitId, selectedUnit, changeActiveUnit, systemUnits } = useAuth();
  const [unitTree, setUnitTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBranches, setExpandedBranches] = useState({});

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    api.get('/units/tree')
      .then(res => {
        if (isMounted && res.success && Array.isArray(res.data)) {
          setUnitTree(sortUnitChildren(res.data));
        } else if (isMounted && systemUnits && systemUnits.length > 0) {
          setUnitTree(buildUnitTree(systemUnits));
        }
      })
      .catch(err => {
        console.warn('Failed to load unit tree from API, fallback to flat list:', err);
        if (isMounted && systemUnits && systemUnits.length > 0) {
          setUnitTree(buildUnitTree(systemUnits));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, systemUnits]);

  const modalRef = useRef(null);
  const openerRef = useRef(null);
  const isBackdropMouseDownRef = useRef(false);

  // Lock body scroll and save opener
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusableArr = Array.from(focusables).filter(
          (el) => !el.disabled && el.offsetParent !== null
        );

        if (focusableArr.length === 0) return;

        const first = focusableArr[0];
        const last = focusableArr[focusableArr.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  const toggleBranch = (branchId) => {
    setExpandedBranches(prev => ({
      ...prev,
      [branchId]: prev[branchId] === false ? true : false
    }));
  };

  const handleSelectLocation = (unitId) => {
    changeActiveUnit(unitId);
    onClose();
  };

  const isGlobalActive = !selectedUnitId;

  const handleBackdropMouseDown = (e) => {
    isBackdropMouseDownRef.current = (e.target === e.currentTarget);
  };

  const handleBackdropMouseUp = (e) => {
    if (e.target !== e.currentTarget) {
      isBackdropMouseDownRef.current = false;
    }
  };

  const handleBackdropClick = (e) => {
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    isBackdropMouseDownRef.current = false;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto no-print animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-switcher-modal-title"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-card border border-line rounded-xl shadow-modal max-w-lg w-full max-h-[calc(100vh-32px)] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden m-auto shrink-0 animate-scale-up text-ink"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-surface/50 shrink-0">
          <div>
            <h3 id="location-switcher-modal-title" className="text-sm font-bold text-ink flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-signal" />
              <span>Switch Location Context</span>
            </h3>
            <p className="text-[11px] text-slate mt-0.5">
              Select an operational unit or choose All Units to view system-wide inventory
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            icon={X}
          />
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Search Filter Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location by name, code, or area..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-surface border border-line rounded-lg focus:outline-none focus:border-signal text-ink placeholder-slate"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate hover:text-ink text-sm px-1"
              >
                &times;
              </button>
            )}
          </div>

          {/* 1. Global / All Units Option */}
          <div
            onClick={() => handleSelectLocation('')}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              isGlobalActive
                ? 'bg-signal/15 border-signal text-ink font-semibold shadow-xs ring-1 ring-signal/30'
                : 'bg-card hover:bg-surface border-line text-ink hover:border-slate/40'
            }`}
          >
            <input
              type="radio"
              name="location_switcher_radio"
              checked={isGlobalActive}
              onChange={() => handleSelectLocation('')}
              className="accent-signal w-4 h-4 cursor-pointer shrink-0"
            />
            <div className="w-7 h-7 rounded-md bg-signal/10 flex items-center justify-center text-signal shrink-0 border border-signal/20">
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">All Units</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-signal/20 text-signal font-semibold">
                  All Units
                </span>
              </div>
              <p className="text-[10px] text-slate truncate">
                Unrestricted aggregate oversight across all divisions, areas & CSCs
              </p>
            </div>
            {isGlobalActive && (
              <CheckCircle2 className="w-4 h-4 text-signal shrink-0 ml-auto" />
            )}
          </div>

          {/* 2. Hierarchical Org Units Tree */}
          <div className="border-t border-line/60 pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate px-1 mb-1.5">
              Organizational Hierarchy
            </div>

            <div className="p-2 bg-surface rounded-lg border border-line max-h-72 overflow-y-auto space-y-1">
              {loading ? (
                <div className="py-8 text-center text-slate text-xs animate-pulse">
                  Loading organizational hierarchy...
                </div>
              ) : unitTree.length > 0 ? (
                unitTree.map(root => (
                  <LocationTreeNode
                    key={root.id}
                    node={root}
                    level={0}
                    selectedUnitId={selectedUnitId}
                    onSelectUnit={handleSelectLocation}
                    expandedBranches={expandedBranches}
                    toggleBranch={toggleBranch}
                    searchQuery={searchQuery}
                  />
                ))
              ) : (
                <div className="py-8 text-center text-slate text-xs italic">
                  No organizational units found.
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate mt-1.5 px-1 italic">
              * Click branch nodes (e.g. D3, WPS-II, AREA HORANA) to expand/collapse. Select any leaf operational unit or CSC to scope data.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line flex items-center justify-between bg-surface/30">
          <div className="text-xs text-slate truncate max-w-[280px]">
            Active: <span className="font-semibold text-ink">{selectedUnit ? `${selectedUnit.unit_name} (${selectedUnit.unit_code})` : 'All Units'}</span>
          </div>
          <Button
            variant="secondary"
            size="regular"
            onClick={onClose}
            label="Close"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
