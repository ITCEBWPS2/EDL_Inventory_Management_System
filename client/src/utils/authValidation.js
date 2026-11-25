export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Normalise username or email by trimming leading/trailing spaces and lowercasing
 */
export function normalizeIdentifier(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().toLowerCase();
}

/**
 * Validate login/auth identifier (either email or username)
 */
export function validateIdentifier(rawVal) {
  if (!rawVal || !String(rawVal).trim()) {
    return 'Enter your username or email address.';
  }
  const val = String(rawVal).trim();
  if (val.includes('@')) {
    return validateEmail(val);
  } else {
    return validateUsername(val);
  }
}

/**
 * Validate email address format
 */
export function validateEmail(rawVal) {
  if (!rawVal || !String(rawVal).trim()) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  const val = String(rawVal).trim();
  if (val.length > 254) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  if (val.includes(' ') || val.includes('..')) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  const parts = val.split('@');
  if (parts.length !== 2) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  const [local, domain] = parts;
  if (!local || !domain) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  if (!EMAIL_REGEX.test(val)) {
    return 'Enter a valid email address, for example name@edl.lk.';
  }
  return null;
}

/**
 * Validate username format
 */
export function validateUsername(rawVal) {
  if (!rawVal || !String(rawVal).trim()) {
    return 'Username can only contain letters, numbers, dots, underscores and hyphens.';
  }
  const val = String(rawVal).trim();
  if (val.length < 3 || val.length > 50) {
    return 'Username can only contain letters, numbers, dots, underscores and hyphens.';
  }
  if (val.includes(' ')) {
    return 'Username can only contain letters, numbers, dots, underscores and hyphens.';
  }
  if (!USERNAME_REGEX.test(val)) {
    return 'Username can only contain letters, numbers, dots, underscores and hyphens.';
  }
  return null;
}

/**
 * Validate password length
 */
export function validatePassword(val) {
  if (!val) {
    return 'Enter your password.';
  }
  if (typeof val !== 'string' || val.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  return null;
}

/**
 * Check password against rules: minimum 8 characters, at least 1 letter and 1 number
 */
export function checkPasswordRules(password) {
  const pwd = typeof password === 'string' ? password : '';
  const minLength = pwd.length >= 8 && pwd.length <= 128;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const isValid = minLength && hasLetter && hasNumber;
  return { minLength, hasLetter, hasNumber, isValid };
}

/**
 * Validate new password meets policy: >= 8 chars, >= 1 letter, >= 1 number, <= 128 chars
 */
export function validateNewPassword(val) {
  if (!val) {
    return 'Enter a new password.';
  }
  if (typeof val !== 'string' || val.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (val.length > 128) {
    return 'Password cannot exceed 128 characters.';
  }
  if (!/[a-zA-Z]/.test(val)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(val)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

/**
 * Evaluate password strength score (0-3) and label
 */
export function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: '', percent: 0, color: '#e2e8f0' };
  }
  const { minLength, hasLetter, hasNumber } = checkPasswordRules(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasMixed = /[a-z]/.test(password) && /[A-Z]/.test(password);

  let score = 0;
  if (minLength) score += 1;
  if (hasLetter && hasNumber) score += 1;
  if (password.length >= 10 && (hasSpecial || hasMixed)) score += 1;

  if (score <= 1) {
    return { score: 1, label: 'Weak', percent: 33, color: '#dc2626' };
  } else if (score === 2) {
    return { score: 2, label: 'Medium', percent: 66, color: '#d97706' };
  } else {
    return { score: 3, label: 'Strong', percent: 100, color: '#16a34a' };
  }
}

