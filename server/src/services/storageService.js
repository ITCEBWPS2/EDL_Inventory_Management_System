const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/vouchers');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storageService = {
  /**
   * Upload a voucher file (multer file object)
   * Saves to local disk and returns local:<filename>
   */
  async uploadVoucher(file, transactionId) {
    const ext = path.extname(file.originalname);
    const fileName = `voucher_${transactionId || Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destPath = path.join(UPLOADS_DIR, fileName);

    if (file.buffer) {
      fs.writeFileSync(destPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, destPath);
    }

    return `local:${fileName}`;
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
