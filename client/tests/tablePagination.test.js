import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const paginationPath = path.resolve(__dirname, '../src/components/common/TablePagination.jsx');
const reportsPagePath = path.resolve(__dirname, '../src/pages/ReportsPage.jsx');

describe('TablePagination & Reports Clean Card Architecture Test Suite', () => {
  const paginationContent = fs.readFileSync(paginationPath, 'utf8');
  const reportsContent = fs.readFileSync(reportsPagePath, 'utf8');

  test('1. TablePagination component exists and exports TablePagination component', () => {
    assert.ok(fs.existsSync(paginationPath), 'TablePagination.jsx must exist in client/src/components/common/');
    assert.match(paginationContent, /export\s+const\s+TablePagination/);
    assert.match(paginationContent, /export\s+default\s+TablePagination/);
  });

  test('2. TablePagination supports required props: totalItems, page, pageSize, onPageChange, showAll', () => {
    assert.match(paginationContent, /totalItems/);
    assert.match(paginationContent, /page\s*=/);
    assert.match(paginationContent, /pageSize\s*=/);
    assert.match(paginationContent, /onPageChange/);
    assert.match(paginationContent, /onPageSizeChange/);
    assert.match(paginationContent, /showAll/);
    assert.match(paginationContent, /onToggleShowAll/);
  });

  test('3. TablePagination provides sticky bottom, keyboard accessible pager and ellipsis', () => {
    assert.match(paginationContent, /sticky\s+bottom-0/);
    assert.match(paginationContent, /aria-label="Previous page"/);
    assert.match(paginationContent, /aria-label="Next page"/);
    assert.match(paginationContent, /aria-current={isCurrent\s*\?\s*['"]page['"]\s*:\s*undefined}/);
    assert.match(paginationContent, /&hellip;/);
  });

  test('4. ReportsPage embeds tabs, toolbar with inline chips, table and TablePagination inside ONE main card', () => {
    assert.match(reportsContent, /TablePagination/);
    assert.match(reportsContent, /variant="chip"/);
    assert.match(reportsContent, /label="Total Items"/);
    assert.match(reportsContent, /label="Active Categories"/);
    // TablePagination placed at bottom of table
    assert.match(reportsContent, /<TablePagination/);
  });

  test('5. DataTable integrates TablePagination with defined totalItems prop', () => {
    const dataTablePath = path.resolve(__dirname, '../src/components/common/DataTable.jsx');
    const dataTableContent = fs.readFileSync(dataTablePath, 'utf8');
    assert.match(dataTableContent, /import\s+{[^}]*TablePagination[^}]*}\s+from/);
    assert.match(dataTableContent, /<TablePagination/);
    assert.match(dataTableContent, /totalItems=\{filteredData\.length\}/);
    assert.doesNotMatch(dataTableContent, /totalFilteredItems/);
  });
});

