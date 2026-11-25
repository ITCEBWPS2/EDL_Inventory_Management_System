import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIdentifier,
  validateIdentifier,
  validateEmail,
  validateUsername,
  validatePassword
} from '../src/utils/authValidation.js';

test('Auth Client Validation & Normalisation Test Suite', async (t) => {
  await t.test('1. normalizeIdentifier trims surrounding spaces and lowercases', () => {
    assert.equal(normalizeIdentifier('  Manjula.hemantha@edl.lk '), 'manjula.hemantha@edl.lk');
    assert.equal(normalizeIdentifier('  ADMIN123  '), 'admin123');
    assert.equal(normalizeIdentifier('User_Name'), 'user_name');
    assert.equal(normalizeIdentifier(''), '');
    assert.equal(normalizeIdentifier(null), '');
    assert.equal(normalizeIdentifier(undefined), '');
  });

  await t.test('2. validateIdentifier handles required empty check', () => {
    assert.equal(validateIdentifier(''), 'Enter your username or email address.');
    assert.equal(validateIdentifier('   '), 'Enter your username or email address.');
    assert.equal(validateIdentifier(null), 'Enter your username or email address.');
    assert.equal(validateIdentifier(undefined), 'Enter your username or email address.');
  });

  await t.test('3. validateIdentifier validates valid and invalid emails', () => {
    // Valid emails
    assert.equal(validateIdentifier('manjula.hemantha@edl.lk'), null);
    assert.equal(validateIdentifier('Manjula.Hemantha@EDL.lk'), null);
    assert.equal(validateIdentifier('test.user+tag@edl.co.uk'), null);
    assert.equal(validateIdentifier('admin@edl.lk'), null);

    // Invalid emails with '@'
    const invalidEmails = [
      'user@',
      '@domain.com',
      'user@domain',
      'user..name@edl.lk',
      'user name@edl.lk',
      'user@domain..com',
      'user@@domain.com',
      'a'.repeat(250) + '@edl.lk' // > 254 characters
    ];

    for (const bad of invalidEmails) {
      assert.equal(
        validateIdentifier(bad),
        'Enter a valid email address, for example name@edl.lk.',
        `Expected error for: ${bad}`
      );
    }
  });

  await t.test('4. validateIdentifier validates valid and invalid usernames', () => {
    // Valid usernames (3-50 chars, letters, digits, dot, underscore, hyphen)
    assert.equal(validateIdentifier('admin123'), null);
    assert.equal(validateIdentifier('unit_head'), null);
    assert.equal(validateIdentifier('emp-rw'), null);
    assert.equal(validateIdentifier('M.Hemantha'), null);
    assert.equal(validateIdentifier('abc'), null); // 3 chars
    assert.equal(validateIdentifier('a'.repeat(50)), null); // 50 chars

    // Invalid usernames (no '@')
    const invalidUsernames = [
      'ab', // < 3 chars
      'a'.repeat(51), // > 50 chars
      'user name', // contains space
      'user!#', // invalid special characters
      'user$1',
      'user*test'
    ];

    for (const bad of invalidUsernames) {
      assert.equal(
        validateIdentifier(bad),
        'Username can only contain letters, numbers, dots, underscores and hyphens.',
        `Expected error for: ${bad}`
      );
    }
  });

  await t.test('5. validateEmail helper standalone checks', () => {
    assert.equal(validateEmail('test@edl.lk'), null);
    assert.equal(validateEmail(''), 'Enter a valid email address, for example name@edl.lk.');
    assert.equal(validateEmail('invalid'), 'Enter a valid email address, for example name@edl.lk.');
    assert.equal(validateEmail('test@sub.edl.lk'), null);
  });

  await t.test('6. validatePassword rules (required, max 128 characters, untrimmed)', () => {
    assert.equal(validatePassword(''), 'Enter your password.');
    assert.equal(validatePassword(null), 'Enter your password.');
    assert.equal(validatePassword(undefined), 'Enter your password.');
    assert.equal(validatePassword('password123'), null);
    assert.equal(validatePassword('  spaces-retained  '), null); // Spaces preserved, valid password
    assert.equal(validatePassword('a'.repeat(128)), null); // Exactly 128 chars allowed
    assert.equal(validatePassword('a'.repeat(129)), 'Password cannot exceed 128 characters.');
  });

  await t.test('7. index.css disables native Edge/IE password reveal icons to prevent duplicates', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = fs.existsSync(path.resolve(process.cwd(), 'src/index.css'))
      ? path.resolve(process.cwd(), 'src/index.css')
      : path.resolve(process.cwd(), 'client/src/index.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /::-ms-reveal/, 'Must include ::-ms-reveal selector');
    assert.match(css, /::-ms-clear/, 'Must include ::-ms-clear selector');
  });
});
