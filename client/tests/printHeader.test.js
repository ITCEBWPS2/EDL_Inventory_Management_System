import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime } from '../src/utils/formatters.js';
import { getUnitParentChain } from '../src/utils/reportUtils.js';
import { REPORT_REGION_NAME, REPORT_COMPANY_NAME, REPORT_LOGO_PATH } from '../src/constants/report.js';

test('Print Header & Report Formatting Test Suite', async (t) => {
  await t.test('1. Constants are accurately configured', () => {
    assert.equal(REPORT_REGION_NAME, 'Western Province South II');
    assert.equal(REPORT_COMPANY_NAME, 'Electricity Distribution Lanka (Pvt) Ltd');
    assert.equal(REPORT_LOGO_PATH, '/images/edl-logo.png');
  });

  await t.test('2. formatDateTime outputs DD/MM/YYYY HH:mm with 24-hr clock, no seconds or US format', () => {
    // Exact Date object
    const d = new Date(2026, 10, 5, 9, 35); // 05/11/2026 09:35
    assert.equal(formatDateTime(d), '05/11/2026 09:35');

    // Afternoon hours (24-hour verification)
    const afternoon = new Date(2026, 3, 14, 15, 7); // 14/04/2026 15:07
    assert.equal(formatDateTime(afternoon), '14/04/2026 15:07');

    // Midnight edge cases
    const midnight = new Date(2026, 0, 1, 0, 5); // 01/01/2026 00:05
    assert.equal(formatDateTime(midnight), '01/01/2026 00:05');

    // ISO string inputs
    assert.equal(formatDateTime('2026-11-05T09:35:00Z'), formatDateTime(new Date('2026-11-05T09:35:00Z')));

    // Invalid & empty values
    assert.equal(formatDateTime(null), '—');
    assert.equal(formatDateTime(''), '—');
    assert.equal(formatDateTime('invalid-date'), '—');
  });

  await t.test('3. getUnitParentChain builds hierarchical parent chain and omits corporate root', () => {
    const mockUnits = [
      { id: 'root-1', unit_name: 'Electricity Distribution Lanka (Pvt) Ltd', parent_unit_id: null },
      { id: 'wps-2', unit_name: 'Western Province South II', unit_code: 'WPS-II', parent_unit_id: 'root-1' },
      { id: 'ito-3', unit_name: 'ITO', unit_code: 'ITO', parent_unit_id: 'wps-2' },
      { id: 'standalone-4', unit_name: 'Store Branch Alpha', parent_unit_id: null }
    ];

    // Sub-unit with parent
    const chain = getUnitParentChain('ito-3', mockUnits);
    assert.equal(chain, 'Western Province South II > ITO');

    // Standalone unit without parent
    const standaloneChain = getUnitParentChain('standalone-4', mockUnits);
    assert.equal(standaloneChain, 'Store Branch Alpha');

    // Non-existent unit returns empty string
    assert.equal(getUnitParentChain('unknown-99', mockUnits), '');
    assert.equal(getUnitParentChain(null, mockUnits), '');
  });

  await t.test('4. PrintHeader markup and print styles guarantee larger logo and removal of "Printed by"', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    // Verify PrintHeader component source
    const headerPath = fs.existsSync(path.resolve('src/components/common/PrintHeader.jsx'))
      ? path.resolve('src/components/common/PrintHeader.jsx')
      : path.resolve('client/src/components/common/PrintHeader.jsx');
    const headerSource = fs.readFileSync(headerPath, 'utf8');
    assert.equal(headerSource.includes('Printed by:'), false, 'PrintHeader must not contain "Printed by:"');
    assert.equal(headerSource.includes('printedByName'), false, 'PrintHeader must not contain printedByName');
    assert.equal(headerSource.includes('formatRole'), false, 'PrintHeader must not contain formatRole');
    assert.equal(headerSource.includes('h-[28mm]'), true, 'PrintHeader must set logo height to 28mm');

    // Verify print.css
    const printCssPath = fs.existsSync(path.resolve('src/styles/print.css'))
      ? path.resolve('src/styles/print.css')
      : path.resolve('client/src/styles/print.css');
    const printCss = fs.readFileSync(printCssPath, 'utf8');
    assert.equal(printCss.includes('height: 29mm !important'), true, 'print.css must size logo to 29mm');
    assert.equal(printCss.includes('max-height: 30mm !important'), true, 'print.css must cap logo to 30mm');
    assert.equal(printCss.includes('font-family: "Times New Roman"'), true, 'print.css must enforce serif font');
  });

  await t.test('5. PrintHeader omits parent hierarchy chain for Verification Audit and Transaction History Reports', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const headerPath = fs.existsSync(path.resolve('src/components/common/PrintHeader.jsx'))
      ? path.resolve('src/components/common/PrintHeader.jsx')
      : path.resolve('client/src/components/common/PrintHeader.jsx');
    const headerSource = fs.readFileSync(headerPath, 'utf8');

    assert.equal(headerSource.includes('verification audit'), true, 'PrintHeader must detect Verification Audit Report');
    assert.equal(headerSource.includes('transaction history'), true, 'PrintHeader must detect Transaction History Report');
    assert.equal(headerSource.includes('shouldShowParentChain'), true, 'PrintHeader must condition parentChainDisplay on shouldShowParentChain');
  });
});
