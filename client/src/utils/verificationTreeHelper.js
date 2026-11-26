/**
 * verificationTreeHelper.js
 * Helpers for hierarchy navigation, path resolution, dynamic grouping, and tree search.
 */

/**
 * Checks if a tree node is a top-level structural heading (Company, Division, Region)
 * which are non-selectable headers.
 */
export function isTopHeading(node) {
  if (!node) return false;
  const code = String(node.unit_code || node.code || '').trim().toUpperCase();
  const name = String(node.unit_name || node.name || '').trim().toUpperCase();
  return (
    code === 'EDL-HQ' ||
    code === 'DIV-D3' ||
    code === 'REG-WPS-II' ||
    name === 'ELECTRICAL DISTRIBUTION LANKA (PVT) LTD' ||
    name === 'D3' ||
    name === 'WPS-II'
  );
}

/**
 * Determines if a node is selectable for verification team appointment.
 * All units and operational group nodes (e.g. AREA AVISSAWELLA, PLANNING) are selectable,
 * while top structural headings (EDL, D3, WPS-II) are non-selectable headings.
 */
export function isNodeSelectable(node) {
  if (!node) return false;
  return !isTopHeading(node);
}

/**
 * Normalizes a display breadcrumb for path strings.
 * Shortens long company/region names for clean readability:
 * "Electrical Distribution Lanka (Pvt) Ltd" -> "EDL"
 */
function cleanShortName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.toLowerCase().includes('electrical distribution lanka')) {
    return 'EDL';
  }
  return trimmed;
}

/**
 * Traverses the hierarchy tree to produce:
 * 1. selectableNodes: flat array of all selectable nodes in depth-first tree order
 * 2. pathsMap: Map of unitId -> "EDL > D3 > WPS-II > ..."
 * 3. nodeMap: Map of unitId -> node
 * 4. parentGroupMap: Map of unitId -> dynamic group name (e.g. "AREA AVISSAWELLA", "PLANNING", "WPS-II (direct)")
 */
export function analyzeLocationTree(tree = []) {
  const selectableNodes = [];
  const pathsMap = new Map();
  const nodeMap = new Map();
  const parentGroupMap = new Map();

  function traverse(node, ancestors = []) {
    if (!node) return;
    const id = String(node.id || node._id);
    nodeMap.set(id, node);

    const currentAncestors = [...ancestors, node];
    const pathString = currentAncestors.map(n => cleanShortName(n.unit_name || n.name)).join(' > ');
    pathsMap.set(id, pathString);

    if (isNodeSelectable(node)) {
      selectableNodes.push({
        ...node,
        id,
        pathString
      });

      // Resolve dynamic grouping based on hierarchy ancestors
      // Ancestor order: [EDL, D3, WPS-II, (Area Node)?, (Leaf Node)?]
      let groupName = 'WPS-II (direct)';
      const directUnderWps = ancestors.find(a => {
        const c = String(a.unit_code || a.code || '').toUpperCase();
        const n = String(a.unit_name || a.name || '').toUpperCase();
        return c === 'REG-WPS-II' || n === 'WPS-II';
      });

      if (directUnderWps) {
        const wpsIndex = ancestors.indexOf(directUnderWps);
        const subAreaAncestor = ancestors[wpsIndex + 1];
        if (subAreaAncestor && !isTopHeading(subAreaAncestor)) {
          groupName = subAreaAncestor.unit_name || subAreaAncestor.name;
        } else if (node.children && node.children.length > 0) {
          // If this node is itself an area group directly under WPS-II
          groupName = node.unit_name || node.name;
        } else {
          groupName = 'WPS-II (direct)';
        }
      } else if (ancestors.length > 0) {
        const nonHeading = ancestors.filter(a => !isTopHeading(a));
        if (nonHeading.length > 0) {
          groupName = nonHeading[0].unit_name || nonHeading[0].name;
        }
      }

      parentGroupMap.set(id, groupName);
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      node.children.forEach(child => traverse(child, currentAncestors));
    }
  }

  if (Array.isArray(tree)) {
    tree.forEach(root => traverse(root, []));
  }

  return {
    selectableNodes,
    pathsMap,
    nodeMap,
    parentGroupMap
  };
}

/**
 * Filter tree by search query while preserving full ancestor chains to matches.
 */
export function filterLocationTree(nodes = [], query = '') {
  if (!query || !query.trim()) return nodes;
  const q = query.trim().toLowerCase();

  function filterNode(node) {
    const name = String(node.unit_name || node.name || '').toLowerCase();
    const code = String(node.unit_code || node.code || '').toLowerCase();
    const matchesSelf = name.includes(q) || code.includes(q);

    let filteredChildren = [];
    if (Array.isArray(node.children) && node.children.length > 0) {
      filteredChildren = node.children.map(filterNode).filter(Boolean);
    }

    if (matchesSelf || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    }
    return null;
  }

  return nodes.map(filterNode).filter(Boolean);
}
