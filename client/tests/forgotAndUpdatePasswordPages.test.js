import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkPasswordRules,
  validateNewPassword,
  getPasswordStrength
} from '../src/utils/authValidation.js';

test('Forgot & Update Password Pages Client Test Suite', async (t) => {
  await t.test('1. checkPasswordRules correctly checks length >= 8, letters, and numbers', () => {
    assert.deepEqual(checkPasswordRules(''), { minLength: false, hasLetter: false, hasNumber: false, isValid: false });
    assert.deepEqual(checkPasswordRules('short1A'), { minLength: false, hasLetter: true, hasNumber: true, isValid: false });
    assert.deepEqual(checkPasswordRules('allletterslong'), { minLength: true, hasLetter: true, hasNumber: false, isValid: false });
    assert.deepEqual(checkPasswordRules('123456789'), { minLength: true, hasLetter: false, hasNumber: true, isValid: false });
    assert.deepEqual(checkPasswordRules('ValidPass123'), { minLength: true, hasLetter: true, hasNumber: true, isValid: true });
  });

  await t.test('2. getPasswordStrength computes Weak, Medium, and Strong', () => {
    assert.equal(getPasswordStrength('').label, '');
    assert.equal(getPasswordStrength('short').label, 'Weak');
    assert.equal(getPasswordStrength('pass1234').label, 'Medium');
    assert.equal(getPasswordStrength('Complex!Pass99').label, 'Strong');
  });

  await t.test('3. validateNewPassword returns proper validation errors', () => {
    assert.equal(validateNewPassword(''), 'Enter a new password.');
    assert.equal(validateNewPassword('short'), 'Password must be at least 8 characters long.');
    assert.equal(validateNewPassword('123456789'), 'Password must contain at least one letter.');
    assert.equal(validateNewPassword('abcdefghijk'), 'Password must contain at least one number.');
    assert.equal(validateNewPassword('ValidPass123'), null);
  });

  await t.test('4. Login.jsx displays both Forgot password? and Update password links side by side', () => {
    const loginPath = path.resolve(import.meta.dirname, '../src/pages/Login.jsx');
    const content = fs.readFileSync(loginPath, 'utf8');
    assert.match(content, /to="\/forgot-password"/, 'Must contain link to /forgot-password');
    assert.match(content, /Forgot password\?/, 'Must contain label "Forgot password?"');
    assert.match(content, /to="\/update-password"/, 'Must contain link to /update-password');
    assert.match(content, /Update password/, 'Must contain label "Update password"');
  });

  await t.test('5. ForgotPassword.jsx contains Username, New Password, Confirm New Password, and RESET PASSWORD', () => {
    const forgotPath = path.resolve(import.meta.dirname, '../src/pages/ForgotPassword.jsx');
    const content = fs.readFileSync(forgotPath, 'utf8');
    assert.match(content, /id="forgot-username"/);
    assert.match(content, /id="forgot-new-password"/);
    assert.match(content, /id="forgot-confirm-password"/);
    assert.match(content, /RESET PASSWORD/);
    assert.match(content, /api\.post\('\/auth\/forgot-password'/);
  });

  await t.test('6. UpdatePassword.jsx contains Username, Current Password, New Secure Password, and UPDATE PASSWORD', () => {
    const updatePath = path.resolve(import.meta.dirname, '../src/pages/UpdatePassword.jsx');
    const content = fs.readFileSync(updatePath, 'utf8');
    assert.match(content, /id="update-username"/);
    assert.match(content, /id="update-current-password"/);
    assert.match(content, /id="update-new-password"/);
    assert.match(content, /UPDATE PASSWORD/);
    assert.match(content, /api\.post\('\/auth\/update-password'/);
    assert.doesNotMatch(content, /admin123/, 'Must not contain default password hints');
  });

  await t.test('7. App.jsx registers both /forgot-password and /update-password public routes', () => {
    const appPath = path.resolve(import.meta.dirname, '../src/App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');
    assert.match(content, /path="\/forgot-password"/);
    assert.match(content, /path="\/update-password"/);
  });
});
