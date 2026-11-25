import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate,
  formatRelativeDays,
  getVerificationCycleStatus,
  VERIFICATION_CYCLE_CONFIG
} from '../src/utils/formatters.js';

test('Verification Formatters & Cycle Status Test Suite', async (t) => {
  await t.test('1. formatDate outputs DD/MM/YYYY without time shifts', () => {
    assert.equal(formatDate('2026-11-04'), '04/11/2026');
    assert.equal(formatDate('2025-01-15'), '15/01/2025');
    assert.equal(formatDate(''), '—');
    assert.equal(formatDate(null), '—');
  });

  await t.test('2. formatRelativeDays computes calendar-day differences accurately', () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Today
    assert.equal(formatRelativeDays(toYMD(now)), 'Today');

    // Yesterday
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    assert.equal(formatRelativeDays(toYMD(yesterday)), 'Yesterday');

    // 12 days ago
    const twelveDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 12);
    assert.equal(formatRelativeDays(toYMD(twelveDaysAgo)), '12 days ago');

    // 90 days ago (~3 months ago)
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
    assert.equal(formatRelativeDays(toYMD(ninetyDaysAgo)), '3 months ago');

    // 400 days ago (~1 year ago)
    const yearAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 400);
    assert.equal(formatRelativeDays(toYMD(yearAgo)), '1 year ago');

    // Empty or invalid input
    assert.equal(formatRelativeDays(''), '');
    assert.equal(formatRelativeDays(null), '');
    assert.equal(formatRelativeDays('invalid'), '');
  });

  await t.test('3. getVerificationCycleStatus returns "Not started" for null or empty dates', () => {
    const res1 = getVerificationCycleStatus(null);
    assert.equal(res1.status, 'not_started');
    assert.equal(res1.label, 'Not started');

    const res2 = getVerificationCycleStatus('');
    assert.equal(res2.status, 'not_started');
    assert.equal(res2.label, 'Not started');
  });

  await t.test('4. getVerificationCycleStatus returns "Up to date" when within current calendar year', () => {
    const currentYear = new Date().getFullYear();
    const res = getVerificationCycleStatus(`${currentYear}-05-20`);
    assert.equal(res.status, 'up_to_date');
    assert.equal(res.label, 'Up to date');
    assert.ok(res.colorClass.includes('#40916C'));
  });

  await t.test('5. Constants and config thresholds', () => {
    assert.equal(VERIFICATION_CYCLE_CONFIG.DUE_SOON_START_MONTH, 11);
    assert.equal(VERIFICATION_CYCLE_CONFIG.GRACE_PERIOD_END_MONTH, 1);
  });
});

