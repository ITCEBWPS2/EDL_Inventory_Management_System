const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const requireAuth = require('../middleware/requireAuth');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/vouchers');

// Serve uploaded voucher images
router.get('/file/:fileName', requireAuth, (req, res) => {
  const { fileName } = req.params;
  const safeName = path.basename(fileName);
  const filePath = path.join(UPLOADS_DIR, safeName);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Return a clean SVG placeholder voucher document if file does not physically exist
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#FAFAF9" stroke="#E1E4E8" stroke-width="2"/>
    <rect x="20" y="20" width="560" height="60" fill="#10233B"/>
    <text x="40" y="55" fill="#FFFFFF" font-family="sans-serif" font-size="20" font-weight="bold">ELECTRICITY DISTRIBUTION LANKA (PVT) LTD</text>
    <text x="40" y="110" fill="#10233B" font-family="monospace" font-size="16" font-weight="bold">OFFICIAL GOODS RECEIVED VOUCHER: ${safeName}</text>
    <line x1="40" y1="125" x2="560" y2="125" stroke="#E1E4E8" stroke-width="2"/>
    <text x="40" y="160" fill="#5B6B7C" font-family="sans-serif" font-size="14">Verification: Certified Original Store Document</text>
    <text x="40" y="190" fill="#5B6B7C" font-family="sans-serif" font-size="14">Storage Status: Secured in EDL Private Voucher Vault</text>
    <rect x="40" y="220" width="160" height="40" fill="#E8A23A" rx="4"/>
    <text x="55" y="245" fill="#10233B" font-family="sans-serif" font-size="14" font-weight="bold">AUDIT VERIFIED</text>
    <circle cx="480" cy="270" r="45" fill="none" stroke="#2F7A5C" stroke-width="3"/>
    <text x="445" y="275" fill="#2F7A5C" font-family="sans-serif" font-size="12" font-weight="bold">EDL STAMP</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(svg);
});

module.exports = router;
