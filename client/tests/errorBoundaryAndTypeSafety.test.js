import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORY_SUBTYPES,
  SUBTYPE_METADATA,
  getCategorySubtypes,
  itemMatchesSubType,
  syncCategoryCustomSubtypes,
  registerCustomSubtypes
} from '../src/constants/categorySubtypes.js';
import {
  generateSerialNumber,
  resolveUnitCode,
  resolveCategoryCode,
  resolveSubCategoryCode,
  deriveItemTypeCode
} from '../src/utils/serialNumberGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

describe('Error Boundary, Type Safety & Unit Switch Null Safety Test Suite', () => {
  test('1. ErrorBoundary component file exists and defines getDerivedStateFromError and componentDidCatch', () => {
    const ebPath = path.join(CLIENT_ROOT, 'src/components/common/ErrorBoundary.jsx');
    assert.ok(fs.existsSync(ebPath), 'ErrorBoundary.jsx must exist');
    const content = fs.readFileSync(ebPath, 'utf8');

    assert.ok(content.includes('class ErrorBoundary extends React.Component'), 'Must be a React class component');
    assert.ok(content.includes('static getDerivedStateFromError'), 'Must define static getDerivedStateFromError');
    assert.ok(content.includes('componentDidCatch'), 'Must define componentDidCatch');
    assert.ok(content.includes('handleReset'), 'Must define handleReset method');
    assert.ok(content.includes('Something went wrong on this page'), 'Must show friendly page error heading');
    assert.ok(content.includes('Try again'), 'Must offer Try again button');
    assert.ok(content.includes('Back to Dashboard'), 'Must offer Back to Dashboard button');
    assert.ok(content.includes('level === \'root\''), 'Must support root-level recovery screen');
  });

  test('2. AppShell and App wrap page content and routes inside ErrorBoundary', () => {
    const appShellPath = path.join(CLIENT_ROOT, 'src/components/layout/AppShell.jsx');
    const appShellContent = fs.readFileSync(appShellPath, 'utf8');
    assert.ok(appShellContent.includes('<ErrorBoundary level="page">'), 'AppShell must wrap children in ErrorBoundary');

    const appPath = path.join(CLIENT_ROOT, 'src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(appContent.includes('<ErrorBoundary level="page">'), 'App.jsx must wrap routes in ErrorBoundary');

    const mainPath = path.join(CLIENT_ROOT, 'src/main.jsx');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    assert.ok(mainContent.includes('<ErrorBoundary level="root">'), 'main.jsx must wrap App with root ErrorBoundary');
    assert.ok(mainContent.includes('unhandledrejection'), 'main.jsx must catch unhandled promise rejections');
  });

  test('3. Custom types have generic default fallback and match item filters cleanly', () => {
    // Register custom type
    syncCategoryCustomSubtypes('furniture', [
      { id: 'custom-type-1', name: 'Custom Cabinet', slug: 'custom-cabinet', category: 'Furniture' }
    ]);

    const subTypes = getCategorySubtypes('furniture');
    assert.ok(subTypes.some(s => s.slug === 'custom-cabinet'), 'Custom type must be in category subtypes');

    // Test matching item
    const customItem = {
      id: 'item-1',
      item_name: 'Custom Cabinet 2-Door',
      sub_type: 'custom-cabinet',
      sub_classification: 'Custom Cabinet',
      item_code: 'EDL/ITO/FUR/CAB/CUSTOM-001'
    };

    assert.equal(itemMatchesSubType(customItem, 'custom-cabinet'), true);
    assert.equal(itemMatchesSubType(customItem, 'chairs'), false);

    // Clean up
    syncCategoryCustomSubtypes('furniture', []);
    const cleanSubTypes = getCategorySubtypes('furniture');
    assert.equal(cleanSubTypes.some(s => s.slug === 'custom-cabinet'), false);
  });

  test('4. Serial number generator handles null, empty, or missing unit safely without crashing', () => {
    // Null unit
    const code1 = resolveUnitCode(null);
    assert.equal(code1, 'EDL-HQ');

    // Undefined unit
    const code2 = resolveUnitCode(undefined);
    assert.equal(code2, 'EDL-HQ');

    // All Units (empty object or string)
    const code3 = resolveUnitCode({});
    assert.equal(code3, 'EDL-HQ');

    const code4 = resolveUnitCode('All Units');
    assert.equal(code4, 'ALL_UNITS');

    // Full serial generation with null unit and custom type
    const serial = generateSerialNumber({
      unit: null,
      category: 'Furniture',
      subCategory: 'custom-type',
      itemType: 'Custom Desk',
      existingItems: []
    });

    assert.ok(typeof serial === 'string');
    assert.ok(serial.includes('EDL-HQ/FUR/'));
    assert.ok(serial.endsWith('-001'));
  });

  test('5. LocationSwitcherModal calls all hooks unconditionally before early return', () => {
    const fileContent = fs.readFileSync(
      path.join(CLIENT_ROOT, 'src/components/layout/LocationSwitcherModal.jsx'),
      'utf8'
    );

    const earlyReturnIndex = fileContent.indexOf('if (!isOpen) return null;');
    assert.ok(earlyReturnIndex !== -1, 'Must have early return for isOpen');

    // Ensure all hook calls (useRef, useEffect) come BEFORE if (!isOpen) return null
    const modalRefIndex = fileContent.indexOf('const modalRef = useRef(null);');
    const openerRefIndex = fileContent.indexOf('const openerRef = useRef(null);');

    assert.ok(modalRefIndex < earlyReturnIndex, 'modalRef must be declared before if (!isOpen) return null');
    assert.ok(openerRefIndex < earlyReturnIndex, 'openerRef must be declared before if (!isOpen) return null');
  });

  test('6. CategoryInventoryPage includes friendly Type Not Found state and error retry banner', () => {
    const fileContent = fs.readFileSync(
      path.join(CLIENT_ROOT, 'src/pages/CategoryInventoryPage.jsx'),
      'utf8'
    );

    assert.ok(fileContent.includes('isTypeNotFound'), 'Must compute isTypeNotFound');
    assert.ok(fileContent.includes('Type Not Found'), 'Must display friendly Type Not Found text');
    assert.ok(fileContent.includes('fetchError'), 'Must capture fetchError');
    assert.ok(fileContent.includes('Retry'), 'Must include Retry button on fetch error');
    assert.ok(fileContent.includes('resolvedSubMeta'), 'Must compute resolvedSubMeta for dynamic types');
  });

  test('7. 404 NotFoundPage renders with navigation back to Dashboard', () => {
    const notFoundPath = path.join(CLIENT_ROOT, 'src/pages/NotFoundPage.jsx');
    assert.ok(fs.existsSync(notFoundPath), 'NotFoundPage.jsx must exist');
    const fileContent = fs.readFileSync(notFoundPath, 'utf8');

    assert.ok(fileContent.includes('404 - Page Not Found'));
    assert.ok(fileContent.includes('Back to Dashboard'));
    assert.ok(fileContent.includes('Go Back'));
  });
});
