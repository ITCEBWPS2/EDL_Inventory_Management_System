import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');

test('Table Headers & Column Widths Fix Test Suite', async (t) => {
  await t.test('1. index.css enforces unbreakable words and solid sticky white headers', () => {
    const cssContent = fs.readFileSync(path.join(clientRoot, 'src', 'index.css'), 'utf8');
    assert.match(cssContent, /table\s+th,\s*th\s*\{/);
    assert.match(cssContent, /word-break:\s*normal\s*!important/);
    assert.match(cssContent, /overflow-wrap:\s*normal\s*!important/);
    assert.match(cssContent, /hyphens:\s*none\s*!important/);
    assert.match(cssContent, /background-color:\s*#ffffff\s*!important/);
  });

  await t.test('2. DataTable.jsx implements table-layout fixed, colgroup and custom widths', () => {
    const dtContent = fs.readFileSync(path.join(clientRoot, 'src', 'components', 'common', 'DataTable.jsx'), 'utf8');
    assert.match(dtContent, /<colgroup>/);
    assert.match(dtContent, /tableLayout:\s*'fixed'/);
    assert.match(dtContent, /resolveColWidth/);
    assert.match(dtContent, /resolveColMinWidth/);
    assert.match(dtContent, /totalTableMinWidth/);
  });

  await t.test('3. CategoryInventoryPage.jsx defines explicit widths for category columns', () => {
    const pageContent = fs.readFileSync(path.join(clientRoot, 'src', 'pages', 'CategoryInventoryPage.jsx'), 'utf8');
    assert.match(pageContent, /header:\s*'No\.'/);
    assert.match(pageContent, /header:\s*'Serial No\.'/);
    assert.match(pageContent, /header:\s*'Manufacturer S\/N'/);
    assert.match(pageContent, /header:\s*'Quantity'/);
    assert.match(pageContent, /header:\s*'Unit \/ Location'/);
    assert.match(pageContent, /whitespace-nowrap/);
    assert.match(pageContent, /font-mono/);
  });

  await t.test('4. BatchSerialSubTable.jsx enforces table-layout fixed and explicit colgroup', () => {
    const subTableContent = fs.readFileSync(path.join(clientRoot, 'src', 'components', 'inventory', 'BatchSerialSubTable.jsx'), 'utf8');
    assert.match(subTableContent, /<colgroup>/);
    assert.match(subTableContent, /tableLayout:\s*'fixed'/);
    assert.match(subTableContent, /bg-white/);
  });

  await t.test('5. TransactionsTable.jsx and IssuedDestroyedPage.jsx have fixed layout without overflowWrap anywhere', () => {
    const txContent = fs.readFileSync(path.join(clientRoot, 'src', 'components', 'common', 'TransactionsTable.jsx'), 'utf8');
    assert.doesNotMatch(txContent, /overflowWrap:\s*'anywhere'/);
    assert.match(txContent, /tableLayout:\s*'fixed'/);
    assert.match(txContent, /<colgroup>/);

    const idContent = fs.readFileSync(path.join(clientRoot, 'src', 'pages', 'IssuedDestroyedPage.jsx'), 'utf8');
    assert.doesNotMatch(idContent, /overflowWrap:\s*'anywhere'/);
    assert.match(idContent, /tableLayout:\s*'fixed'/);
    assert.match(idContent, /<colgroup>/);
  });
});
