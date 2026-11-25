import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('Unified Add Button Architecture Test Suite', async (t) => {
  await t.test('1. AddButton components exist and export properly', () => {
    const uiAddButtonPath = path.join(CLIENT_ROOT, 'src/components/ui/AddButton.jsx');
    const commonAddButtonPath = path.join(CLIENT_ROOT, 'src/components/common/AddButton.jsx');
    const pageHeaderPath = path.join(CLIENT_ROOT, 'src/components/common/PageHeader.jsx');

    assert.ok(fs.existsSync(uiAddButtonPath), 'AddButton.jsx should exist in src/components/ui/');
    assert.ok(fs.existsSync(commonAddButtonPath), 'AddButton.jsx should exist in src/components/common/');
    assert.ok(fs.existsSync(pageHeaderPath), 'PageHeader.jsx should exist in src/components/common/');

    const uiContent = fs.readFileSync(uiAddButtonPath, 'utf8');
    assert.ok(uiContent.includes('export const AddButton'), 'AddButton must export AddButton named component');
    assert.ok(uiContent.includes('export default AddButton'), 'AddButton must export default');
    assert.ok(uiContent.includes('btn-unified-add'), 'AddButton must include btn-unified-add class');
    assert.ok(uiContent.includes('Plus'), 'AddButton must include Plus icon');
  });

  await t.test('2. CSS and component define height 32px, rounded 6px and brand gradient', () => {
    const cssPath = path.join(CLIENT_ROOT, 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const btnPath = path.join(CLIENT_ROOT, 'src/components/ui/AddButton.jsx');
    const btnContent = fs.readFileSync(btnPath, 'utf8');

    assert.ok(cssContent.includes('.btn-unified-add'), 'index.css must include .btn-unified-add');
    assert.ok(cssContent.includes('linear-gradient'), 'Add button must use brand maroon linear gradient');
    assert.ok(btnContent.includes('h-8'), 'Add button must have height 32px (h-8)');
    assert.ok(btnContent.includes('rounded-md'), 'Add button must have rounded-md (6px)');
    assert.ok(btnContent.includes('px-3'), 'Add button must have horizontal padding 12px (px-3)');
  });

  await t.test('3. ReceivedTransactions.jsx uses unified AddButton and has no floating button', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/ReceivedTransactions.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-received-record"'), 'Must maintain id="btn-add-received-record"');
    assert.ok(!content.includes('fixed bottom-6 right-6'), 'Floating button must be completely removed');
  });

  await t.test('4. ExpendedTransactions.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/ExpendedTransactions.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-expended"'), 'Must maintain id="btn-add-expended"');
  });

  await t.test('5. CategoryInventoryPage.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/CategoryInventoryPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('label="Add Item"'), 'Must maintain label="Add Item"');
  });

  await t.test('6. CategoriesPage.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/CategoriesPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-category"'), 'Must maintain id="btn-add-category"');
  });

  await t.test('7. IssuedDestroyedPage.jsx uses unified AddButton at top and removes footer button', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/IssuedDestroyedPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-issued-destroyed"'), 'Must maintain id="btn-add-issued-destroyed"');
    assert.ok(!content.includes('Card Footer with "Add" button at bottom right'), 'Footer button must be removed');
  });

  await t.test('8. UnitManagementPage.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/UnitManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-unit"'), 'Must maintain id="btn-add-unit"');
  });

  await t.test('9. UserManagementPage.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/UserManagementPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-add-staff-account"'), 'Must maintain id="btn-add-staff-account"');
  });

  await t.test('10. VerificationHistory.jsx uses unified AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/VerificationHistory.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes("from '../components/ui/AddButton'"), 'Must import AddButton');
    assert.ok(content.includes('<AddButton'), 'Must render AddButton');
    assert.ok(content.includes('id="btn-start-new-survey"'), 'Must maintain id="btn-start-new-survey"');
    assert.ok(content.includes('to="/verification/new"'), 'Must link to /verification/new');
  });
});
