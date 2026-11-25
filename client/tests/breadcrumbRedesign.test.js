import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBreadcrumbs, formatCrumbLabel } from '../src/utils/breadcrumbResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Breadcrumb Consistency & Automatic Route Mapping Test Suite', async (t) => {
  await t.test('1. Breadcrumb component exists with semantic accessibility and Received Items styling', () => {
    const breadcrumbPath = path.resolve(__dirname, '../src/components/layout/Breadcrumb.jsx');
    assert.ok(fs.existsSync(breadcrumbPath), 'Breadcrumb.jsx must exist');

    const content = fs.readFileSync(breadcrumbPath, 'utf8');

    // Accessibility structure
    assert.ok(content.includes('<nav aria-label="Breadcrumb"'), 'Must have nav element with aria-label="Breadcrumb"');
    assert.ok(content.includes('<ol'), 'Must have ordered list ol for breadcrumb hierarchy');
    assert.ok(content.includes('aria-current="page"'), 'Current page item must have aria-current="page"');

    // Separators and text styling
    assert.ok(content.includes('&gt;'), 'Must use > separator');
    assert.ok(content.includes('#4A4D5A'), 'Previous crumbs must be muted text (#4A4D5A)');
    assert.ok(content.includes('font-semibold text-[#280818]'), 'Last crumb must be bold and dark (#280818)');

    // Responsive truncation
    assert.ok(content.includes('truncate'), 'Must truncate long crumb text on narrow viewports');
  });

  await t.test('2. resolveBreadcrumbs handles all routes including category subtypes and edge cases', () => {
    // Dashboard has no breadcrumb
    assert.deepEqual(resolveBreadcrumbs('/'), []);
    assert.deepEqual(resolveBreadcrumbs('/dashboard'), []);

    // Transactions
    assert.deepEqual(resolveBreadcrumbs('/transactions'), [{ label: 'Transactions' }]);
    assert.deepEqual(resolveBreadcrumbs('/transactions/received'), [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Received Items' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/transactions/expended'), [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Expended Items' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/transactions/remaining'), [
      { label: 'Transactions', path: '/transactions' },
      { label: 'Remaining' }
    ]);

    // Inventory & Categories
    assert.deepEqual(resolveBreadcrumbs('/inventory/categories'), [
      { label: 'Inventory' },
      { label: 'Item Categories' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/inventory/category/furniture'), [
      { label: 'Inventory' },
      { label: 'Item Categories', path: '/inventory/categories' },
      { label: 'Furniture' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/inventory/category/it-computing-equipment'), [
      { label: 'Inventory' },
      { label: 'Item Categories', path: '/inventory/categories' },
      { label: 'IT & Computing Equipment' }
    ]);

    // Sub-types (like Computers & Peripherals)
    assert.deepEqual(resolveBreadcrumbs('/inventory/category/it-computing-equipment/computers-peripherals'), [
      { label: 'Inventory' },
      { label: 'Item Categories', path: '/inventory/categories' },
      { label: 'IT & Computing Equipment', path: '/inventory/category/it-computing-equipment' },
      { label: 'Computers & Peripherals' }
    ]);

    // Direct subtype slug lookup (when accessed without parent category slug)
    assert.deepEqual(resolveBreadcrumbs('/inventory/category/computers-peripherals'), [
      { label: 'Inventory' },
      { label: 'Item Categories', path: '/inventory/categories' },
      { label: 'IT & Computing Equipment', path: '/inventory/category/it-computing-equipment' },
      { label: 'Computers & Peripherals' }
    ]);

    // Annual Verification
    assert.deepEqual(resolveBreadcrumbs('/verification'), [{ label: 'Annual Verification' }]);
    assert.deepEqual(resolveBreadcrumbs('/verification/new'), [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'New Verification' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/verification/issued-destroyed'), [
      { label: 'Annual Verification', path: '/verification' },
      { label: 'Issued / Destroyed Items' }
    ]);

    // Reports
    assert.deepEqual(resolveBreadcrumbs('/reports'), [{ label: 'Reports' }]);
    assert.deepEqual(resolveBreadcrumbs('/reports/inventory'), [
      { label: 'Reports', path: '/reports' },
      { label: 'Current Inventory' }
    ]);

    // Settings
    assert.deepEqual(resolveBreadcrumbs('/settings'), [
      { label: 'Settings' },
      { label: 'Account Profile' }
    ]);
    assert.deepEqual(resolveBreadcrumbs('/settings/audit-log'), [
      { label: 'Settings', path: '/settings' },
      { label: 'Activity Audit Log' }
    ]);
  });

  await t.test('3. AppShell renders Breadcrumb strip under header using resolveBreadcrumbs', () => {
    const appShellPath = path.resolve(__dirname, '../src/components/layout/AppShell.jsx');
    assert.ok(fs.existsSync(appShellPath), 'AppShell.jsx must exist');

    const content = fs.readFileSync(appShellPath, 'utf8');

    // Breadcrumb and resolver import
    assert.ok(content.includes("import { Breadcrumb } from './Breadcrumb';"), 'Must import Breadcrumb in AppShell');
    assert.ok(content.includes("resolveBreadcrumbs"), 'Must import resolveBreadcrumbs in AppShell');

    // Under header strip positioning
    assert.ok(content.includes('<Breadcrumb breadcrumbs={resolvedCrumbs} />'), 'Must render Breadcrumb with resolvedCrumbs in AppShell');
    assert.ok(content.includes('bg-surface/90 backdrop-blur-xs border-b border-line/60'), 'Breadcrumb strip must have light surface styling');
  });

  await t.test('4. BackButton matches wine link styling with hover underline', () => {
    const backBtnPath = path.resolve(__dirname, '../src/components/common/BackButton.jsx');
    assert.ok(fs.existsSync(backBtnPath), 'BackButton.jsx must exist');

    const content = fs.readFileSync(backBtnPath, 'utf8');

    assert.ok(content.includes('#7a1a3c'), 'BackButton must use wine color #7a1a3c');
    assert.ok(content.includes('hover:underline'), 'BackButton must have hover:underline');
  });
});
