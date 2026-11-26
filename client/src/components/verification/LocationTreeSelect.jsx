import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import {
  isTopHeading,
  isNodeSelectable,
  filterLocationTree
} from '../../utils/verificationTreeHelper';

/**
 * Recursive Tree Node in the Location Dropdown
 */
const DropdownTreeNode = ({
  node,
  level = 0,
  selectedUnitId,
  highlightedIndex,
  currentFlatIndex,
  onSelectNode,
  expandedBranches,
  toggleBranch,
  searchQuery,
  teamsByUnitId
}) => {
  const id = String(node.id || node._id);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isBranch = hasChildren;
  const isHeading = isTopHeading(node);
  const isSelectable = isNodeSelectable(node);
  const isSelected = selectedUnitId === id;
  const isExpanded = searchQuery ? true : (expandedBranches[id] !== false);

  const team = teamsByUnitId ? teamsByUnitId[id] : null;
  const isAssigned = Boolean(team && Array.isArray(team.members) && team.members.length === 3);

  // Icon determination matching User Management hierarchy
  const renderIcon = () => {
    if (isHeading) {
      return <Building2 className="w-3.5 h-3.5 text-signal shrink-0" />;
    }
    if (hasChildren) {
      return <Building2 className="w-3.5 h-3.5 text-[#3A6D8C] shrink-0" />;
    }
    if (node.unit_type === 'csc') {
      return <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    }
    return <Building2 className="w-3.5 h-3.5 text-slate shrink-0" />;
  };

  return (
    <div className="select-none text-xs">
      <div
        onClick={() => {
          if (isSelectable) {
            onSelectNode(node);
          } else if (hasChildren) {
            toggleBranch(id);
          }
        }}
        className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg transition-colors ${
          isHeading
            ? 'text-slate/80 font-bold bg-surface/40 cursor-default uppercase tracking-wider text-[11px] my-0.5'
            : isSelected
            ? 'bg-maroon-tint/80 text-maroon font-semibold border border-maroon/30 shadow-2xs'
            : isSelectable
            ? 'hover:bg-surface cursor-pointer text-ink'
            : 'text-slate cursor-pointer'
        }`}
        style={{ paddingLeft: `${Math.max(6, level * 14 + 6)}px` }}
        title={node.location || `${node.unit_name || node.name} (${node.unit_code || node.code || ''})`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-black/10 text-slate shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleBranch(id);
              }}
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

          {renderIcon()}

          <span className={`truncate ${hasChildren || isHeading ? 'font-bold' : 'font-medium'}`}>
            {node.unit_name || node.name}
          </span>

          {node.unit_code && !isHeading && (
            <span className="text-[10px] text-slate font-mono bg-surface px-1 rounded shrink-0 hidden sm:inline">
              {node.unit_code}
            </span>
          )}
        </div>

        {/* Status Badge for Selectable Locations */}
        {isSelectable && (
          <div className="shrink-0 flex items-center">
            {isAssigned ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Done 3/3</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-2.5 h-2.5" />
                <span>Pending</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-line/50 ml-3.5 space-y-0.5 mt-0.5">
          {node.children.map(child => (
            <DropdownTreeNode
              key={String(child.id || child._id)}
              node={child}
              level={level + 1}
              selectedUnitId={selectedUnitId}
              highlightedIndex={highlightedIndex}
              currentFlatIndex={currentFlatIndex}
              onSelectNode={onSelectNode}
              expandedBranches={expandedBranches}
              toggleBranch={toggleBranch}
              searchQuery={searchQuery}
              teamsByUnitId={teamsByUnitId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * LocationTreeSelect Component
 */
export const LocationTreeSelect = ({
  tree = [],
  selectableNodes = [],
  pathsMap = new Map(),
  selectedUnitId = '',
  onSelect = () => {},
  teamsByUnitId = {},
  disabled = false,
  placeholder = 'Select operational location from hierarchy...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBranches, setExpandedBranches] = useState({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Selected node
  const selectedNode = useMemo(() => {
    if (!selectedUnitId) return null;
    return selectableNodes.find(n => String(n.id || n._id) === String(selectedUnitId)) || null;
  }, [selectedUnitId, selectableNodes]);

  const selectedPath = useMemo(() => {
    if (!selectedUnitId) return '';
    return pathsMap.get(String(selectedUnitId)) || selectedNode?.unit_name || '';
  }, [selectedUnitId, pathsMap, selectedNode]);

  // Filtered tree
  const filteredTree = useMemo(() => {
    return filterLocationTree(tree, searchQuery);
  }, [tree, searchQuery]);

  // Flat list of selectable matching nodes for arrow navigation
  const matchingSelectableNodes = useMemo(() => {
    if (!searchQuery.trim()) return selectableNodes;
    const q = searchQuery.toLowerCase().trim();
    return selectableNodes.filter(n => {
      const name = String(n.unit_name || n.name || '').toLowerCase();
      const code = String(n.unit_code || n.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [selectableNodes, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const toggleBranch = useCallback((id) => {
    setExpandedBranches(prev => ({
      ...prev,
      [id]: prev[id] === false ? true : false
    }));
  }, []);

  const handleSelectNode = useCallback((node) => {
    const id = String(node.id || node._id);
    const path = pathsMap.get(id) || node.unit_name || '';
    onSelect(node, path);
    setIsOpen(false);
  }, [onSelect, pathsMap]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, matchingSelectableNodes.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + matchingSelectableNodes.length) % Math.max(1, matchingSelectableNodes.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingSelectableNodes[highlightedIndex]) {
        handleSelectNode(matchingSelectableNodes[highlightedIndex]);
      }
    }
  };

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs bg-card border rounded-xl shadow-2xs transition-colors cursor-pointer text-left ${
          isOpen
            ? 'border-maroon ring-1 ring-maroon/20'
            : 'border-line hover:border-slate/50'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-surface/50' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedNode ? (
            <>
              {selectedNode.unit_type === 'csc' ? (
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : selectedNode.children && selectedNode.children.length > 0 ? (
                <Building2 className="w-4 h-4 text-[#3A6D8C] shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 text-slate shrink-0" />
              )}
              <span className="font-semibold text-ink truncate">
                {selectedNode.unit_name || selectedNode.name}
              </span>
              {selectedNode.unit_code && (
                <span className="text-[10px] font-mono text-slate bg-surface px-1.5 py-0.5 rounded border border-line shrink-0">
                  {selectedNode.unit_code}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate italic">{placeholder}</span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-slate transition-transform shrink-0 ${isOpen ? 'rotate-180 text-maroon' : ''}`} />
      </button>

      {/* Full Path Breadcrumb Under Select Box */}
      {selectedPath && (
        <div className="mt-1.5 px-1 flex items-center gap-1.5 text-[11px] text-slate font-mono overflow-x-auto">
          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-slate/70">Path:</span>
          <span className="truncate text-ink font-medium" title={selectedPath}>
            {selectedPath}
          </span>
        </div>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-line rounded-2xl shadow-modal overflow-hidden animate-scale-up">
          {/* Search Header */}
          <div className="p-2.5 bg-surface/60 border-b border-line flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by location name, area, CSC..."
              className="w-full text-xs bg-transparent border-0 focus:outline-none text-ink placeholder-slate"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate hover:text-ink cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Tree Listing Container */}
          <div className="p-2 max-h-72 overflow-y-auto space-y-0.5">
            {filteredTree.length > 0 ? (
              filteredTree.map(root => (
                <DropdownTreeNode
                  key={String(root.id || root._id)}
                  node={root}
                  level={0}
                  selectedUnitId={selectedUnitId}
                  highlightedIndex={highlightedIndex}
                  currentFlatIndex={0}
                  onSelectNode={handleSelectNode}
                  expandedBranches={expandedBranches}
                  toggleBranch={toggleBranch}
                  searchQuery={searchQuery}
                  teamsByUnitId={teamsByUnitId}
                />
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate italic">
                No matching locations found in hierarchy.
              </div>
            )}
          </div>

          {/* Footer Guide */}
          <div className="px-3 py-1.5 bg-surface/40 border-t border-line text-[10.5px] text-slate flex items-center justify-between">
            <span>* All operational units &amp; areas can be appointed</span>
            <span className="font-mono text-[10px]">
              {matchingSelectableNodes.length} selectable
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationTreeSelect;
