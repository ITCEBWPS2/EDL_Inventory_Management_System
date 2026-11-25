import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ATTACHMENT_KB,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  validateAttachmentFile
} from '../src/constants/upload.js';

test('Attachment Size & Type Validation Test Suite', async (t) => {
  await t.test('1. Constants are accurately defined', () => {
    assert.equal(MAX_ATTACHMENT_KB, 800);
    assert.equal(MAX_ATTACHMENT_BYTES, 800 * 1024);
    assert.equal(MAX_ATTACHMENT_BYTES, 819200);
  });

  await t.test('2. File size formatting (KB vs MB)', () => {
    assert.equal(formatFileSize(0), '0.0 KB');
    assert.equal(formatFileSize(500 * 1024), '500.0 KB');
    assert.equal(formatFileSize(800 * 1024), '800.0 KB');
    assert.equal(formatFileSize(1.2 * 1024 * 1024), '1.2 MB');
    assert.equal(formatFileSize(15 * 1024 * 1024), '15.0 MB');
  });

  await t.test('3. Exactly 800 KB (819,200 bytes) is accepted', () => {
    const fileExactly800KB = {
      name: 'voucher_receipt.jpg',
      size: 800 * 1024,
      type: 'image/jpeg'
    };
    const result = validateAttachmentFile(fileExactly800KB);
    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
  });

  await t.test('4. 800 KB + 1 byte (819,201 bytes) is strictly rejected', () => {
    const fileOversizedByOneByte = {
      name: 'voucher_receipt.jpg',
      size: 800 * 1024 + 1,
      type: 'image/jpeg'
    };
    const result = validateAttachmentFile(fileOversizedByOneByte);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'LIMIT_FILE_SIZE');
    assert.ok(result.error.includes('File is too large'));
    assert.ok(result.error.includes('Maximum allowed size is 800 KB'));
  });

  await t.test('5. Large 1.2 MB file reports actual size in MB error message', () => {
    const file1Point2MB = {
      name: 'high_res_photo.png',
      size: Math.round(1.2 * 1024 * 1024),
      type: 'image/png'
    };
    const result = validateAttachmentFile(file1Point2MB);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'LIMIT_FILE_SIZE');
    assert.ok(result.error.includes('1.2 MB'), `Expected error to mention 1.2 MB, got: ${result.error}`);
    assert.ok(result.error.includes('800 KB'));
  });

  await t.test('6. Allowed image formats (JPG, PNG, WebP) are valid', () => {
    const validJpg = { name: 'photo.jpg', size: 100000, type: 'image/jpeg' };
    const validPng = { name: 'scan.png', size: 200000, type: 'image/png' };
    const validWebp = { name: 'receipt.webp', size: 50000, type: 'image/webp' };

    assert.equal(validateAttachmentFile(validJpg).valid, true);
    assert.equal(validateAttachmentFile(validPng).valid, true);
    assert.equal(validateAttachmentFile(validWebp).valid, true);
  });

  await t.test('7. Non-image formats are rejected with invalid type error', () => {
    const pdfFile = { name: 'invoice.pdf', size: 50000, type: 'application/pdf' };
    const exeFile = { name: 'virus.exe', size: 10000, type: 'application/octet-stream' };
    const docFile = { name: 'doc.docx', size: 50000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

    const pdfRes = validateAttachmentFile(pdfFile);
    assert.equal(pdfRes.valid, false);
    assert.equal(pdfRes.code, 'INVALID_TYPE');
    assert.ok(pdfRes.error.includes('Only JPG, PNG, and WebP images are allowed'));

    const exeRes = validateAttachmentFile(exeFile);
    assert.equal(exeRes.valid, false);
    assert.equal(exeRes.code, 'INVALID_TYPE');

    const docRes = validateAttachmentFile(docFile);
    assert.equal(docRes.valid, false);
    assert.equal(docRes.code, 'INVALID_TYPE');
  });

  await t.test('8. Empty or null file passes cleanly (optional upload)', () => {
    assert.equal(validateAttachmentFile(null).valid, true);
    assert.equal(validateAttachmentFile(undefined).valid, true);
  });
});

