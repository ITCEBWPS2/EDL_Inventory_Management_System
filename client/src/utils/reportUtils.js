/**
 * Report Utility Functions
 */

/**
 * Traverses systemUnits tree upwards from unitId to generate a hierarchy string
 * e.g. "Western Province South II > ITO"
 * Filters out corporate company root names to avoid redundancy in the chain.
 */
export function getUnitParentChain(unitId, systemUnits = []) {
  if (!unitId || !systemUnits || !systemUnits.length) return '';
  const chain = [];
  let curr = systemUnits.find(u => u.id === unitId);
  while (curr) {
    chain.unshift(curr.unit_name || curr.unit_code);
    curr = curr.parent_unit_id ? systemUnits.find(u => u.id === curr.parent_unit_id) : null;
  }
  // Filter out corporate company root names to keep chain clean and informative
  const filtered = chain.filter(name => {
    const lower = name.toLowerCase();
    return !lower.includes('electricity distribution lanka') && !lower.includes('electrical distribution lanka');
  });
  return filtered.join(' > ');
}

