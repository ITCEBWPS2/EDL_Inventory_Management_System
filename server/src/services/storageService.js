const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/vouchers');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DISPOSAL_UPLOADS_DIR = path.join(__dirname, '../../uploads/disposal');
if (!fs.existsSync(DISPOSAL_UPLOADS_DIR)) {
  fs.mkdirSync(DISPOSAL_UPLOADS_DIR, { recursive: true });
}

const storageService = {
  /**
   * Upload a voucher file (multer file object)
   * Saves to local disk and returns local:<filename>
   */
  async uploadVoucher(file, transactionId) {
    if (!file) return null;

    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    if (fileSize > env.MAX_ATTACHMENT_BYTES) {
      const err = new Error(`File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`);
      err.code = 'LIMIT_FILE_SIZE';
      err.status = 413;
      throw err;
    }

    const ext = path.extname(file.originalname);
    const identifier = (transactionId && String(transactionId).trim())
      ? String(transactionId).trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : Date.now();
    const fileName = `voucher_${identifier}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destPath = path.join(UPLOADS_DIR, fileName);

    if (file.buffer) {
      fs.writeFileSync(destPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, destPath);
    }

    return `local:${fileName}`;
  },

  /**
   * Upload a disposal attachment (scan, report, certificate, waybill)
   * Supports JPG, PNG, WebP, PDF up to 800 KB
   */
  async uploadDisposalAttachment(file, requestId) {
    if (!file) return null;

    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    if (fileSize > env.MAX_ATTACHMENT_BYTES) {
      const err = new Error(`File is too large. Maximum allowed size is ${env.ATTACHMENT_MAX_KB} KB.`);
      err.code = 'LIMIT_FILE_SIZE';
      err.status = 413;
      throw err;
    }

    const ext = path.extname(file.originalname);
    const identifier = (requestId && String(requestId).trim())
      ? String(requestId).trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : Date.now();
    const fileName = `disp_${identifier}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destPath = path.join(DISPOSAL_UPLOADS_DIR, fileName);

    if (file.buffer) {
      fs.writeFileSync(destPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, destPath);
    }

    return {
      filename: fileName,
      original_name: file.originalname,
      url: `/api/disposal-requests/attachment/${fileName}`,
      size: fileSize,
      mimetype: file.mimetype
    };
  },

  /**
   * Get direct view URL for voucher
   */
  async getVoucherUrl(storedPath) {
    if (!storedPath) return null;

    if (storedPath.startsWith('local:')) {
      const fileName = storedPath.replace('local:', '');
      return `/api/vouchers/file/${fileName}`;
    }

    // Default fallback placeholder / direct file URL
    return `/api/vouchers/file/${path.basename(storedPath)}`;
  }
};

module.exports = storageService;
