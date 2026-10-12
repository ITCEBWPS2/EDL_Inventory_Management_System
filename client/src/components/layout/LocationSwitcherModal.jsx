import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { sortUnitChildren, buildUnitTree } from '../../utils/unitTree';
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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-card border border-line rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-zoom-in text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-surface/50">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-signal" />
              <span>Switch Location Context</span>
            </h3>
            <p className="text-[11px] text-slate mt-0.5">
              Select an operational unit or choose All Units to view system-wide inventory
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate hover:text-ink hover:bg-line/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
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
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-line bg-card hover:bg-surface text-ink transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
