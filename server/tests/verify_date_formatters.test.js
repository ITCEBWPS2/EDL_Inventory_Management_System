const test = require('node:test');
const assert = require('node:assert/strict');

test('Date Formatter, Parser, and ISO Conversion Test Suite', async (t) => {
  const {
    formatDate,
    formatDateTime,
    toISODate,
    fromISODate,
    isValidDateParts,
    isValidDateString,
    parseDate
  } = await import('../../client/src/utils/formatters.js');

  await t.test('1. formatDate converts ISO strings to DD/MM/YYYY without timezone shift', () => {
    assert.equal(formatDate('2008-04-27'), '27/04/2008');
    assert.equal(formatDate('2026-10-13'), '13/10/2026');
    assert.equal(formatDate('2026-10-13T00:00:00.000Z'), '13/10/2026');
    assert.equal(formatDate('2026-01-01T23:59:59.999Z'), '01/01/2026');
    assert.equal(formatDate('27/04/2008'), '27/04/2008');
  });

  await t.test('2. formatDate returns "—" for empty or invalid values (no NaN or Invalid Date)', () => {
    assert.equal(formatDate(''), '—');
    assert.equal(formatDate('   '), '—');
    assert.equal(formatDate(null), '—');
    assert.equal(formatDate(undefined), '—');
    assert.equal(formatDate('invalid-date'), '—');
    assert.equal(formatDate('31/02/2026'), '—');
  });

  await t.test('3. formatDateTime preserves time part while formatting date as DD/MM/YYYY', () => {
    assert.equal(formatDateTime('2026-10-13T14:05:00.000Z'), '13/10/2026 14:05');
    assert.equal(formatDateTime('2026-10-13 09:30'), '13/10/2026 09:30');
    assert.equal(formatDateTime(''), '—');
    assert.equal(formatDateTime(null), '—');
  });

  await t.test('4. toISODate converts DD/MM/YYYY to YYYY-MM-DD', () => {
    assert.equal(toISODate('27/04/2008'), '2008-04-27');
    assert.equal(toISODate('13/10/2026'), '2026-10-13');
    assert.equal(toISODate('2026-10-13'), '2026-10-13');
    assert.equal(toISODate(''), '');
    assert.equal(toISODate('31/02/2026'), ''); // invalid calendar date
  });

  await t.test('5. fromISODate converts YYYY-MM-DD to DD/MM/YYYY', () => {
    assert.equal(fromISODate('2008-04-27'), '27/04/2008');
    assert.equal(fromISODate('2026-10-13'), '13/10/2026');
    assert.equal(fromISODate(''), '');
    assert.equal(fromISODate(null), '');
  });

  await t.test('6. Calendar validation rejects impossible dates (e.g. Feb 31, April 31, non-leap year Feb 29)', () => {
    // Leap year Feb 29
    assert.equal(isValidDateParts(29, 2, 2024), true, '2024 is a leap year');
    // Non-leap year Feb 29
    assert.equal(isValidDateParts(29, 2, 2025), false, '2025 is not a leap year');
    assert.equal(isValidDateParts(29, 2, 2026), false, '2026 is not a leap year');

    // Feb 31 is always invalid
    assert.equal(isValidDateParts(31, 2, 2026), false);

    // April has 30 days, not 31
    assert.equal(isValidDateParts(31, 4, 2026), false);
    assert.equal(isValidDateParts(30, 4, 2026), true);

    // Month > 12 or < 1
    assert.equal(isValidDateParts(15, 13, 2026), false);
    assert.equal(isValidDateParts(15, 0, 2026), false);

    // isValidDateString string format validation
    assert.equal(isValidDateString('27/04/2008'), true);
    assert.equal(isValidDateString('31/02/2026'), false);
    assert.equal(isValidDateString('abc'), false);
  });

  await t.test('7. parseDate parses valid DD/MM/YYYY to Date object', () => {
    const d = parseDate('27/04/2008');
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2008);
    assert.equal(d.getMonth(), 3); // 0-indexed April
    assert.equal(d.getDate(), 27);

    assert.equal(parseDate('31/02/2026'), null);
    assert.equal(parseDate(''), null);
  });
});
