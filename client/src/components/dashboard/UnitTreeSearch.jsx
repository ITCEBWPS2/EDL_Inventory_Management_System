import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, MapPin, Building2, Warehouse, Globe, Lock } from 'lucide-react';

const UnitTreeNode = ({
  node,
  level = 0,
  expanded,
  toggleExpand,
  selectedUnitId,
  onSelectUnit,
  isSuperAdmin,
  userUnits,
  searchQuery
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded[node.id] !== false; // Default expanded
  const isSelected = selectedUnitId === node.id;
  const isAuthorized = isSuperAdmin || userUnits.some(u => u.id === node.id);

  // Check if this node or any child matches search
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = item.unit_name?.toLowerCase().includes(q) || item.unit_code?.toLowerCase().includes(q);
    const childrenMatch = item.children && item.children.some(c => matchesSearch(c));
    return nameMatch || childrenMatch;
  };

  if (!matchesSearch(node)) return null;

  // Icon based on unit type and hierarchy depth
  const getNodeIcon = () => {
    if (!isAuthorized && !isSuperAdmin) {
      return <Lock className="w-3.5 h-3.5 text-slate shrink-0" />;
    }
    if (node.unit_type === 'area' || level < 3) {
      return <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal' : level === 0 ? 'text-signal' : 'text-[#3A6D8C]'}`} />;
    }
    if (node.unit_type === 'csc') {
      return <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal' : 'text-emerald-600'}`} />;
    }
    return <Warehouse className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-signal' : 'text-slate'}`} />;
  };

  return (
    <div className="select-none text-xs">
      <div
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded transition-colors ${
          isSelected
            ? 'bg-ink text-white font-medium shadow-subtle cursor-pointer'
            : isAuthorized
            ? 'hover:bg-surface text-ink cursor-pointer'
            : 'opacity-60 text-slate hover:bg-surface cursor-pointer'
        }`}
        style={{ paddingLeft: `${Math.max(4, level * 14 + 6)}px` }}
        onClick={() => {
          if (isAuthorized) {
            onSelectUnit(node);
          }
        }}
        title={`${node.unit_name} (${node.unit_code}) - ${node.location || ''}`}
      >
        {/* Expand / Collapse Chevron */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            className="p-0.5 hover:bg-black/10 rounded transition-colors shrink-0 text-slate"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate" />
            ) : (
              <ChevronRight className="w-3 h-3 text-slate" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Unit Icon */}
        {getNodeIcon()}

        {/* Unit Name */}
        <span className={`truncate flex-1 ${level <= 2 ? 'font-semibold' : 'font-normal'}`}>
          {node.unit_name}
        </span>

        {/* Unit Code Badge */}
        <span
          className={`text-[10px] font-mono shrink-0 ml-1.5 px-1 py-0.5 rounded ${
            isSelected
              ? 'bg-white/20 text-white'
              : 'text-slate bg-surface border border-line/60'
          }`}
        >
          {node.unit_code}
        </span>
      </div>

      {/* Child Nodes */}
      {hasChildren && isExpanded && (
        <div className="border-l border-line/50 ml-3.5 space-y-0.5 mt-0.5">
          {node.children.map(child => (
            <UnitTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedUnitId={selectedUnitId}
              onSelectUnit={onSelectUnit}
              isSuperAdmin={isSuperAdmin}
              userUnits={userUnits}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const UnitTreeSearch = ({
  unitTree = [],
  selectedUnitId = '',
  onSelectUnit = () => {},
  isSuperAdmin = false,
  userUnits = []
}) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => ({
      ...prev,
      [id]: prev[id] !== undefined ? !prev[id] : false
    }));
  };

  return (
    <div className="bg-card rounded-xl border border-line p-5 shadow-subtle flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Organization Units</h3>
        <span className="text-[11px] text-slate font-mono">Hierarchy Navigator</span>
      </div>

      {/* Super Admin Global View Option */}
      {isSuperAdmin && (
        <div
          onClick={() => onSelectUnit({ id: '', unit_name: 'All Monitored Units', unit_code: 'GLOBAL' })}
          className={`flex items-center gap-2 py-1.5 px-2.5 rounded cursor-pointer transition-colors mb-3 border ${
            !selectedUnitId
              ? 'bg-ink text-white font-medium border-ink shadow-subtle'
              : 'bg-surface hover:bg-line/40 text-ink border-line'
          }`}
        >
          <Globe className={`w-3.5 h-3.5 ${!selectedUnitId ? 'text-signal' : 'text-slate'}`} />
          <span className="truncate flex-1 font-semibold text-xs">All Monitored Units</span>
          <span className={`text-[10px] font-mono ${!selectedUnitId ? 'text-white/70' : 'text-slate'}`}>
            GLOBAL
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" />
        <input
          type="text"
          placeholder="Filter units, CSCs, areas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-line rounded focus:outline-none focus:border-signal text-ink placeholder-slate"
        />
      </div>

      {/* Tree Content */}
      <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1">
        {unitTree.map(rootNode => (
          <UnitTreeNode
            key={rootNode.id}
            node={rootNode}
            level={0}
            expanded={expanded}
            toggleExpand={toggleExpand}
            selectedUnitId={selectedUnitId}
            onSelectUnit={onSelectUnit}
            isSuperAdmin={isSuperAdmin}
            userUnits={userUnits}
            searchQuery={search}
          />
        ))}

        {unitTree.length === 0 && (
          <div className="text-center py-6 text-slate text-xs">No unit hierarchy available.</div>
        )}
      </div>
    </div>
  );
};

