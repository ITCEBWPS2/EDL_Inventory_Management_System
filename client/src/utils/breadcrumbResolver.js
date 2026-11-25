import { CATEGORY_SUBTYPES } from '../constants/categorySubtypes.js';

export const CATEGORY_NAMES = {
  'furniture': 'Furniture',
  'it-computing-equipment': 'IT & Computing Equipment',
  'network-communication-equipment': 'Network & Communication Equipment',
  'audio-visual-presentation-equipment': 'Audio Visual & Presentation Equipment',
  'tools-equipment': 'Tools & Equipment',
  // Database UUID mappings
  '22222222-2222-2222-2222-222222222201': 'Furniture',
  '22222222-2222-2222-2222-222222222202': 'IT & Computing Equipment',
  '22222222-2222-2222-2222-222222222203': 'Network & Communication Equipment',
  '22222222-2222-2222-2222-222222222204': 'Audio Visual & Presentation Equipment',
  '22222222-2222-2222-2222-222222222205': 'Tools & Equipment',
  '22222222-2222-2222-2222-222222222206': 'Tools & Equipment'
};

// Reverse lookup for sub-categories: subtypeSlug -> { categorySlug, categoryName, subTypeName }
export const SUBTYPE_LOOKUP = {};
for (const [catSlug, subList] of Object.entries(CATEGORY_SUBTYPES)) {
  const catName = CATEGORY_NAMES[catSlug] || catSlug;
  for (const sub of subList) {
    SUBTYPE_LOOKUP[sub.slug] = {
      categorySlug: catSlug,
      categoryName: catName,
      subTypeName: sub.name
    };
  }
}

/**
 * Normalizes any category or sub-category slug into a human-readable title.
 */
export function formatCrumbLabel(slug) {
  if (!slug) return 'Category';
  if (CATEGORY_NAMES[slug]) return CATEGORY_NAMES[slug];
  if (SUBTYPE_LOOKUP[slug]) return SUBTYPE_LOOKUP[slug].subTypeName;

  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || 'Category';
}

/**
 * Resolves the full breadcrumb trail based on the current pathname.
 * Returns an array of objects: { label: string, path?: string }
 * Note: Root "Dashboard" is prepended by the Breadcrumb component itself.
 */
export function resolveBreadcrumbs(pathname, customBreadcrumbs = null) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return [];
  }

  // If the page provided valid custom breadcrumbs with specific items, allow them
  if (Array.isArray(customBreadcrumbs) && customBreadcrumbs.length > 0) {
    // Filter out redundant Dashboard if passed by page
    const cleaned = customBreadcrumbs.filter(
      (c) => c && c.label && c.label.toLowerCase() !== 'dashboard'
    );
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  // 1. Transactions
  if (pathname === '/transactions') {
    return [{ label: 'Transactions' }];
  }
  if (pathname === '/transactions/received') {
    return [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Received Items' }
    ];
  }
  if (pathname === '/transactions/expended') {
    return [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Expended Items' }
    ];
  }
  if (pathname === '/transactions/remaining') {
    return [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Remaining' }
    ];
  }

  // 2. Inventory & Categories
  if (pathname === '/inventory' || pathname === '/inventory/categories') {
    return [
      { label: 'Inventory' },
      { label: 'Item Categories' }
    ];
  }

  // Category and Sub-Type handling
  if (pathname.startsWith('/inventory/category/') || pathname.startsWith('/inventory/categories/')) {
    const rawPath = pathname.replace(/^\/inventory\/categor(y|ies)\//, '');
    const segments = rawPath.split('/').filter(Boolean);

    if (segments.length === 1) {
      const seg = segments[0];

      // Check if this single segment is actually a sub-type (e.g. computers-peripherals)
      if (SUBTYPE_LOOKUP[seg]) {
        const sub = SUBTYPE_LOOKUP[seg];
        return [
          { label: 'Inventory' },
          { label: 'Item Categories', path: '/inventory/categories' },
          { label: sub.categoryName, path: `/inventory/category/${sub.categorySlug}` },
          { label: sub.subTypeName }
        ];
      }

      const catName = formatCrumbLabel(seg);
      return [
        { label: 'Inventory' },
        { label: 'Item Categories', path: '/inventory/categories' },
        { label: catName }
      ];
    }

    if (segments.length >= 2) {
      const [catSeg, subSeg, action] = segments;
      const catName = formatCrumbLabel(catSeg);
      const subName = SUBTYPE_LOOKUP[subSeg] ? SUBTYPE_LOOKUP[subSeg].subTypeName : formatCrumbLabel(subSeg);

      const trail = [
        { label: 'Inventory' },
        { label: 'Item Categories', path: '/inventory/categories' },
        { label: catName, path: `/inventory/category/${catSeg}` }
      ];

      if (action === 'add') {
        trail.push({ label: subName, path: `/inventory/category/${catSeg}/${subSeg}` });
        trail.push({ label: 'Add Item' });
      } else if (action === 'edit') {
        trail.push({ label: subName, path: `/inventory/category/${catSeg}/${subSeg}` });
        trail.push({ label: 'Edit Item' });
      } else {
        trail.push({ label: subName });
      }

      return trail;
    }
  }

  // 3. Annual Verification
  if (pathname === '/verification' || pathname === '/annual-verification') {
    return [{ label: 'Annual Verification' }];
  }
  if (pathname === '/verification/new') {
    return [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'New Verification' }
    ];
  }
  if (pathname === '/verification/history') {
    return [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'Verification History' }
    ];
  }
  if (pathname === '/verification/issued-destroyed') {
    return [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'Issued / Destroyed Items' }
    ];
  }
  if (pathname === '/verification/issued-destroyed/add') {
    return [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'Issued / Destroyed Items', path: '/verification/issued-destroyed' },
      { label: 'Add Record' }
    ];
  }
  if (pathname.startsWith('/verification/issued-destroyed/') && pathname.endsWith('/edit')) {
    return [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'Issued / Destroyed Items', path: '/verification/issued-destroyed' },
      { label: 'Edit Record' }
    ];
  }

  // 4. Reports
  if (pathname === '/reports') {
    return [{ label: 'Reports' }];
  }
  if (pathname === '/reports/inventory') {
    return [
      { label: 'Reports', path: '/reports' },
      { label: 'Current Inventory' }
    ];
  }
  if (pathname === '/reports/transactions') {
    return [
      { label: 'Reports', path: '/reports' },
      { label: 'Transaction History' }
    ];
  }
  if (pathname === '/reports/verification') {
    return [
      { label: 'Reports', path: '/reports' },
      { label: 'Verification Audit' }
    ];
  }

  // 5. User Management
  if (pathname === '/users') {
    return [
      { label: 'User Management' },
      { label: 'Staff & Roles' }
    ];
  }

  // 6. Settings
  if (pathname === '/settings') {
    return [
      { label: 'Settings' },
      { label: 'Account Profile' }
    ];
  }
  if (pathname === '/settings/units') {
    return [
      { label: 'Settings', path: '/settings' },
      { label: 'Units & Locations' }
    ];
  }
  if (pathname === '/settings/audit-log') {
    return [
      { label: 'Settings', path: '/settings' },
      { label: 'Activity Audit Log' }
    ];
  }

  // Generic fallback: split pathname and humanize
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [];

  return parts.map((part, idx) => {
    const isLast = idx === parts.length - 1;
    const label = formatCrumbLabel(part);
    return isLast ? { label } : { label, path: '/' + parts.slice(0, idx + 1).join('/') };
  });
}
