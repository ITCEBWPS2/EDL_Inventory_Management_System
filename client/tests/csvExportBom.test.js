import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportToCSV,
  buildCSVWithBOM,
  formatCSVField
} from '../src/utils/formatters.js';

test('CSV Export UTF-8 BOM and Excel Encoding Compatibility Test Suite', async (t) => {
  await t.test('1. formatCSVField: Handles plain numbers, strings, and dates accurately', () => {
    // Null / undefined -> empty string
    assert.equal(formatCSVField(null), '');
    assert.equal(formatCSVField(undefined), '');

    // Numeric cells preserved unaltered
    assert.equal(formatCSVField(0), '0');
    assert.equal(formatCSVField(42), '42');
    assert.equal(formatCSVField(-15), '-15');
    assert.equal(formatCSVField(3.14), '3.14');
    assert.equal(formatCSVField('-5'), '-5');
    assert.equal(formatCSVField('+10'), '+10');

    // ISO dates formatted to DD/MM/YYYY
    assert.equal(formatCSVField('2026-11-18'), '18/11/2026');

    // Strings without special characters remain unquoted
    assert.equal(formatCSVField('Cupboard – 4 Door'), 'Cupboard – 4 Door');
    assert.equal(formatCSVField('වගුව'), 'වගුව');
    assert.equal(formatCSVField('50 µF'), '50 µF');

    // Strings with commas, double quotes, or newlines are wrapped in double quotes with doubled internal quotes
    assert.equal(formatCSVField('Desk, Wooden'), '"Desk, Wooden"');
    assert.equal(formatCSVField('Conference "Executive" Desk'), '"Conference ""Executive"" Desk"');
    assert.equal(formatCSVField("Line 1\nLine 2"), '"Line 1\nLine 2"');
  });

  await t.test('2. formatCSVField: Protects against formula injection without altering numbers', () => {
    // Formula triggers prefixed with single quote
    assert.equal(formatCSVField('=SUM(A1:B1)'), "'=SUM(A1:B1)");
    assert.equal(formatCSVField('@command'), "'@command");
    assert.equal(formatCSVField('\tTabIndented'), "'\tTabIndented");
    assert.equal(formatCSVField('\rReturn'), "\"'\rReturn\"");
    assert.equal(formatCSVField('- Non-numeric text'), "'- Non-numeric text");
    assert.equal(formatCSVField('+ Special text'), "'+ Special text");

    // Plain numbers with + or - remain untouched
    assert.equal(formatCSVField('-100'), '-100');
    assert.equal(formatCSVField('+50'), '+50');
    assert.equal(formatCSVField(-25), '-25');
  });

  await t.test('3. buildCSVWithBOM: Prepends UTF-8 BOM (\uFEFF) and avoids double-BOM', () => {
    const rawData = [
      { 'No.': 1, 'Item': 'Cupboard – 4 Door', 'Quantity': 5 }
    ];
    const csv = buildCSVWithBOM(rawData);

    // Starts with BOM character
    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM character');
    assert.equal(csv.charCodeAt(0), 0xFEFF);

    // Line endings are CRLF (\r\n)
    assert.ok(csv.includes('\r\n'), 'CSV must use CRLF line endings');

    // Does not double-add BOM if already present
    const alreadyWithBom = '\uFEFFHeader1,Header2\r\nVal1,Val2';
    const result = buildCSVWithBOM(alreadyWithBom);
    assert.equal(result.startsWith('\uFEFF'), true);
    assert.notEqual(result.slice(1).startsWith('\uFEFF'), true, 'Must not duplicate BOM');
  });

  await t.test('4. UTF-8 Byte verification: "Cupboard – 4 Door", Sinhala "වගුව", and "50 µF" round-trip accurately', () => {
    const sampleRows = [
      {
        'No.': 1,
        'Item Name': 'Cupboard – 4 Door',
        'Description': 'Wooden table / වගුව',
        'Specification': 'Capacitor 50 µF',
        'Date': '2026-11-18'
      }
    ];

    const csvText = buildCSVWithBOM(sampleRows);
    const buffer = Buffer.from(csvText, 'utf8');

    // First 3 bytes MUST be EF BB BF (UTF-8 BOM)
    assert.equal(buffer[0], 0xEF);
    assert.equal(buffer[1], 0xBB);
    assert.equal(buffer[2], 0xBF);

    // Decode buffer back to UTF-8 string and assert round-trip integrity
    const decoded = buffer.toString('utf8');
    assert.equal(decoded, csvText);
    assert.ok(decoded.includes('Cupboard – 4 Door'), 'Must preserve en dash (–) in Cupboard – 4 Door');
    assert.ok(decoded.includes('වගුව'), 'Must preserve Sinhala text (වගුව)');
    assert.ok(decoded.includes('50 µF'), 'Must preserve micro sign (µ)');
    assert.ok(decoded.includes('18/11/2026'), 'Must format date to DD/MM/YYYY');
  });

  await t.test('5. exportToCSV returns content with BOM in non-DOM environments', () => {
    const data = [
      { 'Item': 'Test Item', 'Qty': 10 }
    ];
    const out = exportToCSV(data, 'test.csv');
    assert.ok(out.startsWith('\uFEFF'));
    assert.ok(out.includes('Test Item'));
  });
});
