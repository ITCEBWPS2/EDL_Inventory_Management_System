/**
 * Organizational Unit Tree Helpers
 * Provides shared, consistent tree building and child sorting logic across all UI components.
 */

/**
 * Sort siblings by sort_order ascending.
 * PLANNING (PLANNING-WPS-II) is guaranteed to sort last (sort_order: 999).
 * If sort_orders are equal, preserves existing relative order.
 * Recursively sorts child nodes if children array is present.
 *
 * @param {Array} nodes - Array of tree nodes
 * @returns {Array} - New sorted array with recursively sorted children
 */
export function sortUnitChildren(nodes) {
  if (!Array.isArray(nodes)) return [];

  const getSortOrder = (item) => {
    if (item.sort_order !== undefined && item.sort_order !== null) {
      return Number(item.sort_order);
    }
    // Fallback if sort_order not populated
    if (item.unit_code === 'PLANNING-WPS-II' || item.unit_name === 'PLANNING') {
      return 999;
    }
    return 0;
  };

  return [...nodes]
    .sort((a, b) => getSortOrder(a) - getSortOrder(b))
    .map(node => ({
      ...node,
      children: node.children && node.children.length > 0
        ? sortUnitChildren(node.children)
        : (node.children || [])
    }));
}

/**
 * Builds a hierarchical tree from a flat list of units.
 * Roots are units with parent_unit_id === null or whose parent does not exist in the list.
 * All sibling levels are automatically sorted via sortUnitChildren.
 *
 * @param {Array} units - Flat list of units
 * @returns {Array} - Hierarchical tree array with sorted children
 */
export function buildUnitTree(units) {
  if (!Array.isArray(units) || units.length === 0) return [];

  const childrenMap = new Map();
  units.forEach(u => {
    const pid = u.parent_unit_id || null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(u);
  });

  const buildNode = (unit) => {
    const rawChildren = childrenMap.get(unit.id) || [];
    const children = sortUnitChildren(rawChildren.map(buildNode));
    return {
      ...unit,
      children
    };
  };

  const unitIds = new Set(units.map(u => u.id));
  const roots = units.filter(u => !u.parent_unit_id || !unitIds.has(u.parent_unit_id));

  return sortUnitChildren(roots.map(buildNode));
}
