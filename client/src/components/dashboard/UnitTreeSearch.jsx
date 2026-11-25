import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronRight, MapPin, Building2, Warehouse, Globe, Lock, ChevronsDown, ChevronsUp } from 'lucide-react';
import { sortUnitChildren } from '../../utils/unitTree';

function findPathToUnit(nodes, targetId, currentPath = []) {
  if (!targetId || !nodes) return [];
  for (const node of nodes) {
    if (node.id === targetId) {
      return [...currentPath, node.id];
    }
    if (node.children && node.children.length > 0) {
      const res = findPathToUnit(node.children, targetId, [...currentPath, node.id]);
      if (res && res.length > 0) return res;
    }
  }
  return [];
}

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
  // If search is active, expand matching branches automatically
  const isExpanded = searchQuery
    ? true
    : Boolean(expanded[node.id]);

  const isSelected = selectedUnitId === node.id;
  const isAuthorized = isSuperAdmin || userUnits.some(u => u.id === node.id);
  const nodeRef = useRef(null);

  useEffect(() => {
    if (isSelected && nodeRef.current) {
      // Smoothly scroll active unit row into view inside the tree container
      nodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

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
      return <Lock className="w-3.5 h-3.5 text-[#8a7a80] shrink-0" />;
    }
    if (node.unit_type === 'area' || level < 3) {
      return (
        <Building2
          className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#f6c026]' : level === 0 ? 'text-[#f6c026]' : 'text-[#7a1a3c]'
            }`}
        />
      );
    }
    if (node.unit_type === 'csc') {
      return <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#f6c026]' : 'text-[#2e7d58]'}`} />;
    }
    return <Warehouse className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#f6c026]' : 'text-[#8a7a80]'}`} />;
  };

  return (
    <div className="select-none text-xs">
      <div
        ref={nodeRef}
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded transition-colors ${isSelected
            ? 'text-white font-semibold cursor-pointer'
            : isAuthorized
              ? 'hover:bg-[#fbf6f1] text-[#280818] cursor-pointer'
              : 'opacity-60 text-[#8a7a80] hover:bg-[#fbf6f1] cursor-pointer'
          }`}
        style={{
          paddingLeft: `${Math.max(4, level * 14 + 6)}px`,
          backgroundColor: isSelected ? '#5a1230' : undefined,
          borderLeft: isSelected ? '3px solid #f6c026' : '3px solid transparent'
        }}
        onClick={() => {
          if (isAuthorized) {
            onSelectUnit(node);
          }
        }}
        title={node.unit_name}
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
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
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

        {/* Unit Name only (no codes/descriptions) */}
        <span className={`truncate flex-1 ${level <= 2 ? 'font-semibold' : 'font-normal'}`}>
          {node.unit_name}
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
  onSelectUnit = () => { },
  isSuperAdmin = false,
  userUnits = [],
  loading = false,
  className = ''
}) => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const sortedUnitTree = useMemo(() => sortUnitChildren(unitTree), [unitTree]);

  // On load and when selectedUnitId changes: keep tree collapsed except the active unit path
  useEffect(() => {
    if (!sortedUnitTree || sortedUnitTree.length === 0) return;
    if (selectedUnitId) {
      const pathIds = findPathToUnit(sortedUnitTree, selectedUnitId);
      if (pathIds.length > 0) {
        setExpanded(() => {
          const pathMap = {};
          pathIds.forEach(id => {
            pathMap[id] = true;
          });
          return pathMap;
        });
      }
    } else {
      // If Global is selected, expand only top root nodes
      const rootMap = {};
      sortedUnitTree.forEach(root => {
        rootMap[root.id] = true;
      });
      setExpanded(rootMap);
    }
  }, [selectedUnitId, sortedUnitTree]);

  const toggleExpand = (id) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleExpandAll = () => {
    const all = {};
    const traverse = (nodes) => {
      nodes.forEach(n => {
        all[n.id] = true;
        if (n.children) traverse(n.children);
      });
    };
    traverse(sortedUnitTree);
    setExpanded(all);
  };

  const handleCollapseAll = () => {
    setExpanded({});
  };

  return (
    <div className={`glass-card p-4 sm:p-[18px] flex flex-col h-[300px] max-h-[300px] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h3 className="text-[15px] font-semibold text-[#280818]">Organization Units</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExpandAll}
            className="text-[11px] font-medium text-[#7a1a3c] hover:underline transition-colors"
            title="Expand all branches"
          >
            Expand all
          </button>
          <span className="text-[#4A4D5A]/40 text-[10px]">|</span>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="text-[11px] font-medium text-[#7a1a3c] hover:underline transition-colors"
            title="Collapse all branches"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Super Admin Global View Option */}
      {isSuperAdmin && (
        <div
          onClick={() => onSelectUnit({ id: '', unit_name: 'All Monitored Units', unit_code: 'GLOBAL' })}
          className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors mb-1.5 border shrink-0 ${!selectedUnitId
              ? 'text-white font-semibold'
              : 'bg-[#fcfbf9] hover:bg-[#fbf6f1] text-[#280818] border-[#eee6e1]'
            }`}
          style={!selectedUnitId ? { backgroundColor: '#5a1230', borderLeft: '3px solid #f6c026' } : undefined}
        >
          <Globe className={`w-3 h-3 ${!selectedUnitId ? 'text-[#f6c026]' : 'text-[#4A4D5A]'}`} />
          <span className="truncate flex-1 font-semibold text-xs">All Monitored Units</span>
          <span className={`text-[9px] font-mono ${!selectedUnitId ? 'text-white/80' : 'text-[#4A4D5A]'}`}>
            GLOBAL
          </span>
        </div>
      )}

      {/* Sticky Search Input */}
      <div className="relative mb-1.5 shrink-0 sticky top-0 z-10">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A4D5A]" />
        <input
          type="text"
          placeholder="Filter units..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/80 border border-[#e6dcd7] rounded-lg focus:outline-none focus:bg-white focus:border-[#7a1a3c] focus:ring-2 focus:ring-[#7a1a3c]/35 text-[#2a1520] placeholder-[#4A4D5A]"
        />
      </div>

      {/* Tree Content with its OWN internal vertical scroll */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-0.5 min-h-0 border-t border-[rgba(27,27,36,0.09)] pt-1.5">
        {loading ? (
          <div className="space-y-2 py-2 animate-pulse">
            <div className="h-5 bg-surface rounded w-3/4"></div>
            <div className="h-5 bg-surface rounded w-2/3 ml-4"></div>
            <div className="h-5 bg-surface rounded w-1/2 ml-8"></div>
            <div className="h-5 bg-surface rounded w-3/5 ml-8"></div>
          </div>
        ) : sortedUnitTree.length > 0 ? (
          sortedUnitTree.map(rootNode => (
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
          ))
        ) : (
          <div className="text-center py-6 text-slate text-xs">No unit hierarchy available.</div>
        )}
      </div>
    </div>
  );
};

export default UnitTreeSearch;
