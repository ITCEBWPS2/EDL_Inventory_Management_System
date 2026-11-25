import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('Add Item Type Feature Test Suite', async (t) => {
  const catInvPath = path.join(CLIENT_ROOT, 'src/pages/CategoryInventoryPage.jsx');
  const catInvContent = fs.readFileSync(catInvPath, 'utf8');

  await t.test('1. Category page shows "Add Type" while sub-type items page shows "Add Item"', () => {
    assert.ok(catInvContent.includes('id={activeSubTypeSlug ? "btn-add-item" : "btn-add-type"}'));
    assert.ok(catInvContent.includes('label={activeSubTypeSlug ? "Add Item" : "Add Type"}'));
    assert.ok(catInvContent.includes('onClick={activeSubTypeSlug ? handleOpenAdd : handleOpenAddType}'));
  });

  await t.test('2. "Add New {Category} Type" modal is configured with required fields and validation', () => {
    assert.ok(catInvContent.includes('title={`Add New ${categoryDisplayName} Type`}'));
    assert.ok(catInvContent.includes('submitLabel="Add Type"'));
    assert.ok(catInvContent.includes('id="input-new-type-name"'));
    assert.ok(catInvContent.includes('id="input-new-type-category"'));
    assert.ok(catInvContent.includes('validateNewTypeName'));
    assert.ok(catInvContent.includes('This type already exists in'));
  });

  await t.test('3. Card grid includes new types, gold highlight ring, and card-type-enter animation', () => {
    assert.ok(catInvContent.includes('card-type-enter'));
    assert.ok(catInvContent.includes('ring-[#E0A75E]'));
    assert.ok(catInvContent.includes('highlightedTypeSlug'));
    assert.ok(catInvContent.includes('truncate'));
    assert.ok(catInvContent.includes('title={st.name}'));
  });

  await t.test('4. Empty state on sub-type page displays friendly message and shared Add Item button', () => {
    assert.ok(catInvContent.includes('No items yet under'));
    assert.ok(catInvContent.includes('Add your first item under this type to get started.'));
  });

  await t.test('5. Constants and helper registerCustomSubtypes merges custom types with hardcoded ones', () => {
    const subtypesPath = path.join(CLIENT_ROOT, 'src/constants/categorySubtypes.js');
    const subtypesContent = fs.readFileSync(subtypesPath, 'utf8');
    assert.ok(subtypesContent.includes('registerCustomSubtypes'));
    assert.ok(subtypesContent.includes('getCategorySubtypes'));
  });

  await t.test('6. CSS defines .card-type-enter animation with prefers-reduced-motion support', () => {
    const cssPath = path.join(CLIENT_ROOT, 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert.ok(cssContent.includes('.card-type-enter'));
    assert.ok(cssContent.includes('@keyframes card-type-enter'));
    assert.ok(cssContent.includes('prefers-reduced-motion: reduce'));
  });
});

