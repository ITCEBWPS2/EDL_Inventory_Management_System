import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');

test('Unified Action & Export Buttons Test Suite', async (t) => {
  await t.test('1. ActionButtons and ExportButton components exist and export properly', () => {
    const actionButtonsPath = path.join(CLIENT_ROOT, 'src/components/ui/ActionButtons.jsx');
    const commonActionButtonsPath = path.join(CLIENT_ROOT, 'src/components/common/ActionButtons.jsx');
    const exportButtonPath = path.join(CLIENT_ROOT, 'src/components/ui/ExportButton.jsx');
    const commonExportButtonPath = path.join(CLIENT_ROOT, 'src/components/common/ExportButton.jsx');

    assert.ok(fs.existsSync(actionButtonsPath), 'ActionButtons.jsx must exist in src/components/ui/');
    assert.ok(fs.existsSync(commonActionButtonsPath), 'ActionButtons.jsx must exist in src/components/common/');
    assert.ok(fs.existsSync(exportButtonPath), 'ExportButton.jsx must exist in src/components/ui/');
    assert.ok(fs.existsSync(commonExportButtonPath), 'ExportButton.jsx must exist in src/components/common/');

    const actionContent = fs.readFileSync(actionButtonsPath, 'utf8');
    assert.ok(actionContent.includes('export const EditButton'), 'Must export EditButton');
    assert.ok(actionContent.includes('export const DeleteButton'), 'Must export DeleteButton');
    assert.ok(actionContent.includes('export const ViewButton'), 'Must export ViewButton');
    assert.ok(actionContent.includes('export const RowActionButton'), 'Must export RowActionButton');
    assert.ok(actionContent.includes('export const IconActionButton'), 'Must export IconActionButton');

    const exportContent = fs.readFileSync(exportButtonPath, 'utf8');
    assert.ok(exportContent.includes('export const ExportButton'), 'Must export ExportButton');
  });

  await t.test('2. CSS rules in index.css match design specs for row actions and export', () => {
    const cssPath = path.join(CLIENT_ROOT, 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.btn-row-action'), 'index.css must define .btn-row-action');
    assert.ok(cssContent.includes('height: 28px;'), 'Row actions must have height 28px');
    assert.ok(cssContent.includes('border-radius: 6px;'), 'Row actions must have radius 6px');
    assert.ok(cssContent.includes('.btn-row-action-neutral'), 'index.css must define .btn-row-action-neutral');
    assert.ok(cssContent.includes('.btn-row-action-danger'), 'index.css must define .btn-row-action-danger');
    assert.ok(cssContent.includes('background-color: #fdf1f1;'), 'Delete button must have soft red #fdf1f1 background');
    assert.ok(cssContent.includes('color: #b42318;'), 'Delete button must have #b42318 text/icon');
    assert.ok(cssContent.includes('.btn-unified-export'), 'index.css must define .btn-unified-export');
    assert.ok(cssContent.includes('height: 32px;'), 'Export button must have height 32px');
    assert.ok(cssContent.includes('border-radius: 6px;'), 'Export button must have radius 6px');
  });

  await t.test('3. ReceivedTransactions.jsx uses unified action buttons, icon button, and no ExportButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/ReceivedTransactions.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const tablePath = path.join(CLIENT_ROOT, 'src/components/common/TransactionsTable.jsx');
    const tableContent = fs.existsSync(tablePath) ? fs.readFileSync(tablePath, 'utf8') : '';
    const combined = content + '\n' + tableContent;

    assert.ok(combined.includes('EditButton'), 'Must import or use EditButton');
    assert.ok(combined.includes('DeleteButton'), 'Must import or use DeleteButton');
    assert.ok(combined.includes('IconActionButton'), 'Must use IconActionButton for Info column');
    assert.ok(!content.includes('bg-[#B4483A] hover:bg-[#9B3C2F] text-white'), 'Solid red delete button must be removed');
    assert.ok(combined.includes('ACTIONS'), 'Header must be ACTIONS');
    assert.ok(!content.includes('ExportButton'), 'Must not use ExportButton on Received Transactions');
    assert.ok(!content.includes('label="Export CSV"'), 'Must not have Export CSV button on Received Transactions');
  });

  await t.test('4. ExpendedTransactions.jsx uses unified action buttons and no ExportButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/ExpendedTransactions.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const tablePath = path.join(CLIENT_ROOT, 'src/components/common/TransactionsTable.jsx');
    const tableContent = fs.existsSync(tablePath) ? fs.readFileSync(tablePath, 'utf8') : '';
    const combined = content + '\n' + tableContent;

    assert.ok(combined.includes('EditButton'), 'Must use EditButton');
    assert.ok(combined.includes('DeleteButton'), 'Must use DeleteButton');
    assert.ok(combined.includes('ACTIONS'), 'Header must be ACTIONS');
    assert.ok(!content.includes('ExportButton'), 'Must not use ExportButton on Expended Transactions');
    assert.ok(!content.includes('label="Export CSV"'), 'Must not have Export CSV button on Expended Transactions');
  });

  await t.test('5. DataTable.jsx uses unified action buttons and ACTIONS header', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/components/common/DataTable.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('EditButton'), 'Must use EditButton');
    assert.ok(content.includes('DeleteButton'), 'Must use DeleteButton');
    assert.ok(content.includes('ACTIONS'), 'Header must be ACTIONS');
  });

  await t.test('6. IssuedDestroyedPage.jsx uses unified action buttons and ExportButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/IssuedDestroyedPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('EditButton'), 'Must use EditButton');
    assert.ok(content.includes('DeleteButton'), 'Must use DeleteButton');
    assert.ok(content.includes('ACTIONS'), 'Header must be ACTIONS');
    assert.ok(content.includes('ExportButton'), 'Must use ExportButton');
    assert.ok(content.includes('label="Export CSV"'), 'Must have Export CSV button');
  });

  await t.test('7. CategoryInventoryPage.jsx does not render ExportButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/CategoryInventoryPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(!content.includes('ExportButton'), 'Must not use ExportButton on category inventory pages');
    assert.ok(!content.includes('label="Export CSV"'), 'Must not have Export CSV button on category inventory pages');
  });

  await t.test('8. UnitManagementPage.jsx and UserManagementPage.jsx use ExportButton', () => {
    const unitPath = path.join(CLIENT_ROOT, 'src/pages/UnitManagementPage.jsx');
    const unitContent = fs.readFileSync(unitPath, 'utf8');
    assert.ok(unitContent.includes('ExportButton'), 'UnitManagementPage must use ExportButton');
    assert.ok(unitContent.includes('label="Export CSV"'), 'UnitManagementPage must have Export CSV button');

    const userPath = path.join(CLIENT_ROOT, 'src/pages/UserManagementPage.jsx');
    const userContent = fs.readFileSync(userPath, 'utf8');
    assert.ok(userContent.includes('ExportButton'), 'UserManagementPage must use ExportButton');
    assert.ok(userContent.includes('label="Export CSV"'), 'UserManagementPage must have Export CSV button');
  });

  await t.test('7. RemainingInventory.jsx uses ExportButton in header', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/RemainingInventory.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('ExportButton'), 'Must use ExportButton');
    assert.ok(content.includes('label="Export CSV"'), 'Must specify label="Export CSV"');
  });

  await t.test('8. VerificationHistory.jsx uses ExportButton in header with AddButton', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/VerificationHistory.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('ExportButton'), 'Must use ExportButton');
    assert.ok(content.includes('label="Export CSV"'), 'Must have Export CSV button');
    assert.ok(content.includes('format="print"'), 'Must have Print ExportButton');
    assert.ok(content.includes('AddButton'), 'Must have AddButton alongside ExportButton in header');
  });

  await t.test('9. ReportsPage.jsx uses ExportButton for CSV and Print', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/ReportsPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('ExportButton'), 'Must use ExportButton');
    assert.ok(content.includes('label="Export CSV"'), 'Must have Export CSV button');
    assert.ok(content.includes('format="print"'), 'Must have Print ExportButton');
  });

  await t.test('10. AuditLogPage.jsx uses ViewButton in rows and ExportButton in header', () => {
    const filePath = path.join(CLIENT_ROOT, 'src/pages/AuditLogPage.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.ok(content.includes('ViewButton'), 'Must use ViewButton in row actions');
    assert.ok(content.includes('ExportButton'), 'Must use ExportButton in header');
    assert.ok(content.includes('ACTIONS'), 'Header must be ACTIONS');
  });
});

