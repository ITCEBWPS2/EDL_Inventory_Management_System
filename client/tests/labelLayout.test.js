import test from 'node:test';
import assert from 'node:assert';
import {
  LABEL_PRESETS,
  PAGE_DIMENSIONS,
  calculateSheetLayout,
  calculateSerialFontSize,
  splitSerialForDisplay,
  buildPrintItems,
  loadSavedPrintOptions,
  savePrintOptions
} from '../src/utils/labelLayout.js';

test('Label Presets contain correct dimensional configurations', () => {
  assert.ok(LABEL_PRESETS['90x25'], '90x25 preset must exist as default recommended');
  assert.strictEqual(LABEL_PRESETS['90x25'].widthMm, 90);
  assert.strictEqual(LABEL_PRESETS['90x25'].heightMm, 25);
  assert.strictEqual(LABEL_PRESETS['90x25'].defaultColumns, 2);
  assert.strictEqual(LABEL_PRESETS['90x25'].defaultRows, 11);

  assert.ok(LABEL_PRESETS['70x30'], '70x30 preset must exist');
  assert.strictEqual(LABEL_PRESETS['70x30'].widthMm, 70);
  assert.strictEqual(LABEL_PRESETS['70x30'].heightMm, 30);
  assert.strictEqual(LABEL_PRESETS['70x30'].defaultColumns, 3);
  assert.strictEqual(LABEL_PRESETS['70x30'].defaultRows, 9);

  assert.ok(LABEL_PRESETS['50x25'], '50x25 preset must exist');
  assert.strictEqual(LABEL_PRESETS['50x25'].widthMm, 50);
  assert.strictEqual(LABEL_PRESETS['50x25'].heightMm, 25);
  assert.strictEqual(LABEL_PRESETS['50x25'].defaultColumns, 4);
  assert.strictEqual(LABEL_PRESETS['50x25'].defaultRows, 11);

  assert.ok(LABEL_PRESETS['100x40'], '100x40 preset must exist');
  assert.strictEqual(LABEL_PRESETS['100x40'].widthMm, 100);
  assert.strictEqual(LABEL_PRESETS['100x40'].heightMm, 40);
  assert.strictEqual(LABEL_PRESETS['100x40'].defaultColumns, 2);
  assert.strictEqual(LABEL_PRESETS['100x40'].defaultRows, 7);
});

test('calculateSheetLayout computes grid columns, rows, and labelsPerPage for 90x25mm on A4', () => {
  const layout = calculateSheetLayout({
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 90,
    labelHeightMm: 25,
    marginTopMm: 11,
    marginBottomMm: 11,
    marginLeftMm: 10,
    marginRightMm: 10,
    gapXMm: 5,
    gapYMm: 0
  });

  assert.strictEqual(layout.columns, 2, '90mm width fits 2 columns across A4 width');
  assert.strictEqual(layout.rows, 11, '25mm height fits 11 rows down available height');
  assert.strictEqual(layout.labelsPerPage, 22, 'Total 2x11 = 22 labels per sheet');
});

test('calculateSheetLayout computes grid for 70x30mm, 50x25mm, and 100x40mm presets', () => {
  const layout70 = calculateSheetLayout({
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 70,
    labelHeightMm: 30,
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 0,
    marginRightMm: 0,
    gapXMm: 0,
    gapYMm: 0
  });
  assert.strictEqual(layout70.columns, 3);
  assert.strictEqual(layout70.rows, 9);
  assert.strictEqual(layout70.labelsPerPage, 27);

  const layout50 = calculateSheetLayout({
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 50,
    labelHeightMm: 25,
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 5,
    marginRightMm: 5,
    gapXMm: 0,
    gapYMm: 0
  });
  assert.strictEqual(layout50.columns, 4);
  assert.strictEqual(layout50.rows, 11);
  assert.strictEqual(layout50.labelsPerPage, 44);

  const layout100 = calculateSheetLayout({
    pageWidthMm: 210,
    pageHeightMm: 297,
    labelWidthMm: 100,
    labelHeightMm: 40,
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 5,
    marginRightMm: 5,
    gapXMm: 0,
    gapYMm: 0
  });
  assert.strictEqual(layout100.columns, 2);
  assert.strictEqual(layout100.rows, 7);
  assert.strictEqual(layout100.labelsPerPage, 14);
});

test('calculateSerialFontSize for the longest serial in system across widths 50, 70, 90, 100 mm with and without QR', () => {
  const longestSerial = 'DGM(WPSII)/CE(COM)/ITO/TLS/ETE/MULTIMETER-ETE-001'; // 49 chars

  // Width: 50 mm
  const w50NoQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 50, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(w50NoQr.fits, false, '49 chars on 50mm cannot fit at >=5pt without QR');
  assert.strictEqual(w50NoQr.fontSizePt, 5, 'Clamped to min 5pt');

  const w50WithQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 50, labelHeightMm: 25, hasQr: true });
  assert.strictEqual(w50WithQr.fits, false, '49 chars on 50mm cannot fit with QR');
  assert.strictEqual(w50WithQr.fontSizePt, 5);

  // Width: 70 mm
  const w70NoQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 70, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(w70NoQr.fits, true, '49 chars on 70mm fits without QR');
  assert.ok(w70NoQr.fontSizePt >= 6 && w70NoQr.fontSizePt <= 7, `Expected font size ~6.4pt, got ${w70NoQr.fontSizePt}`);

  const w70WithQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 70, labelHeightMm: 25, hasQr: true });
  assert.strictEqual(w70WithQr.fits, false, '49 chars on 70mm cannot fit with QR at >=5pt');

  // Width: 90 mm (Default)
  const w90NoQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 90, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(w90NoQr.fits, true, '49 chars on 90mm fits comfortably without QR');
  assert.ok(w90NoQr.fontSizePt >= 8 && w90NoQr.fontSizePt <= 9, `Expected font size ~8.3pt, got ${w90NoQr.fontSizePt}`);

  const w90WithQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 90, labelHeightMm: 25, hasQr: true });
  assert.strictEqual(w90WithQr.fits, true, '49 chars on 90mm fits comfortably WITH QR');
  assert.ok(w90WithQr.fontSizePt >= 5.8 && w90WithQr.fontSizePt <= 6.5, `Expected font size ~6.0pt, got ${w90WithQr.fontSizePt}`);

  // Width: 100 mm
  const w100NoQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 100, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(w100NoQr.fits, true, '49 chars on 100mm fits without QR');
  assert.ok(w100NoQr.fontSizePt >= 9 && w100NoQr.fontSizePt <= 10, `Expected font size ~9.3pt, got ${w100NoQr.fontSizePt}`);

  const w100WithQr = calculateSerialFontSize({ serial: longestSerial, labelWidthMm: 100, labelHeightMm: 25, hasQr: true });
  assert.strictEqual(w100WithQr.fits, true, '49 chars on 100mm fits WITH QR');
  assert.ok(w100WithQr.fontSizePt >= 6.8 && w100WithQr.fontSizePt <= 7.5, `Expected font size ~7.0pt, got ${w100WithQr.fontSizePt}`);
});

test('calculateSerialFontSize for prompt screenshot example serial "DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-003"', () => {
  const serial = 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-003'; // 48 chars

  // On default 90x25mm sheet label size
  const resNoQr = calculateSerialFontSize({ serial, labelWidthMm: 90, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(resNoQr.fits, true);
  assert.ok(resNoQr.fontSizePt >= 8.2 && resNoQr.fontSizePt <= 8.8);

  const resWithQr = calculateSerialFontSize({ serial, labelWidthMm: 90, labelHeightMm: 25, hasQr: true });
  assert.strictEqual(resWithQr.fits, true);
  assert.ok(resWithQr.fontSizePt >= 6.0 && resWithQr.fontSizePt <= 6.5);
});

test('calculateSerialFontSize clamps short serials to maximum font size', () => {
  const short = 'TX-100KVA-01'; // 12 chars
  const res = calculateSerialFontSize({ serial: short, labelWidthMm: 90, labelHeightMm: 25, hasQr: false });
  assert.strictEqual(res.fits, true);
  assert.strictEqual(res.fontSizePt, 14, 'Short serial clamped to max 14pt');
});

test('splitSerialForDisplay always returns serial on a single line without splitting', () => {
  const serial = 'DGM(WPSII)/CE(COM)/ITO/FUR/CHR/COMP-EXEC-CHR-003';
  const res = splitSerialForDisplay(serial);
  assert.deepStrictEqual(res, [serial], 'Must be 1 single line');
  assert.strictEqual(res.length, 1);
});

test('buildPrintItems handles copies per serial', () => {
  const items = [
    { serial: 'SN-001', itemName: 'Item 1' },
    { serial: 'SN-002', itemName: 'Item 2' }
  ];

  const res = buildPrintItems({
    items,
    copies: 3,
    startPosition: 1,
    layoutMode: 'sheet',
    labelsPerPage: 10
  });

  assert.strictEqual(res.totalLabels, 6, '2 items * 3 copies = 6 total labels');
  assert.strictEqual(res.totalPages, 1);
  assert.strictEqual(res.pages[0].length, 6);
  assert.strictEqual(res.pages[0][0].serial, 'SN-001');
  assert.strictEqual(res.pages[0][1].serial, 'SN-001');
  assert.strictEqual(res.pages[0][2].serial, 'SN-001');
  assert.strictEqual(res.pages[0][3].serial, 'SN-002');
  assert.strictEqual(res.pages[0][4].serial, 'SN-002');
  assert.strictEqual(res.pages[0][5].serial, 'SN-002');
});

test('buildPrintItems handles startPosition N on first sheet to reuse partly used sticker sheets', () => {
  const items = [
    { serial: 'SN-001', itemName: 'Item 1' },
    { serial: 'SN-002', itemName: 'Item 2' }
  ];

  const res = buildPrintItems({
    items,
    copies: 1,
    startPosition: 4, // 3 empty slots before first label
    layoutMode: 'sheet',
    labelsPerPage: 5
  });

  assert.strictEqual(res.totalLabels, 2);
  assert.strictEqual(res.pages.length, 1);
  const page1 = res.pages[0];
  assert.strictEqual(page1.length, 5); // 3 empty + 2 labels = 5

  assert.strictEqual(page1[0].isEmpty, true);
  assert.strictEqual(page1[1].isEmpty, true);
  assert.strictEqual(page1[2].isEmpty, true);
  assert.strictEqual(page1[3].isEmpty, false);
  assert.strictEqual(page1[3].serial, 'SN-001');
  assert.strictEqual(page1[4].isEmpty, false);
  assert.strictEqual(page1[4].serial, 'SN-002');
});

test('buildPrintItems handles sheet mode multi-page', () => {
  const items = [
    { serial: 'SN-001', itemName: 'Item 1' },
    { serial: 'SN-002', itemName: 'Item 2' }
  ];

  const res = buildPrintItems({
    items,
    copies: 2,
    startPosition: 1,
    layoutMode: 'sheet',
    labelsPerPage: 3
  });

  // 2 items * 2 copies = 4 total labels, labelsPerPage=3 → 2 pages
  assert.strictEqual(res.totalLabels, 4);
  assert.strictEqual(res.totalPages, 2);
  assert.strictEqual(res.pages.length, 2);
  assert.strictEqual(res.pages[0][0].serial, 'SN-001');
  assert.strictEqual(res.pages[0][1].serial, 'SN-001');
  assert.strictEqual(res.pages[0][2].serial, 'SN-002');
  assert.strictEqual(res.pages[1][0].serial, 'SN-002');
});
