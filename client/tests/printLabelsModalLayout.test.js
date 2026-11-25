import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const printModalPath = path.resolve(__dirname, '../src/components/inventory/PrintLabelsModal.jsx');
const recordModalPath = path.resolve(__dirname, '../src/components/common/RecordModal.jsx');
const confirmModalPath = path.resolve(__dirname, '../src/components/common/ConfirmModal.jsx');
const locationSwitcherPath = path.resolve(__dirname, '../src/components/layout/LocationSwitcherModal.jsx');

describe('PrintLabelsModal & Modal Portal Architecture Test Suite', () => {
  const printModalContent = fs.readFileSync(printModalPath, 'utf8');
  const recordModalContent = fs.readFileSync(recordModalPath, 'utf8');
  const confirmModalContent = fs.readFileSync(confirmModalPath, 'utf8');
  const locationSwitcherContent = fs.readFileSync(locationSwitcherPath, 'utf8');

  test('1. PrintLabelsModal imports createPortal and portals to document.body', () => {
    assert.match(printModalContent, /import\s+{[^}]*createPortal[^}]*}\s+from\s+['"]react-dom['"]/);
    assert.match(printModalContent, /createPortal\(/);
    assert.match(printModalContent, /document\.body\s*\)/);
  });

  test('2. PrintLabelsModal overlay has full viewport coverage, z-[1000], overflow-y-auto, and backdrop blur', () => {
    assert.match(printModalContent, /fixed\s+inset-0/);
    assert.match(printModalContent, /z-\[1000\]/);
    assert.match(printModalContent, /overflow-y-auto/);
    assert.match(printModalContent, /backdrop-blur/);
  });

  test('3. PrintLabelsModal dialog box has max-height dvh constraint and m-auto shrink-0', () => {
    assert.match(printModalContent, /max-h-\[calc\(100dvh-32px\)\]/);
    assert.match(printModalContent, /m-auto/);
    assert.match(printModalContent, /shrink-0/);
    assert.match(printModalContent, /min\(1100px,\s*calc\(100vw\s*-\s*32px\)\)/);
  });

  test('4. PrintLabelsModal has 3-tier layout: fixed header, flex-1 body with min-h-0, fixed footer', () => {
    assert.match(printModalContent, /print-labels-modal-title/);
    assert.match(printModalContent, /min-h-0/);
    assert.match(printModalContent, /overflow-hidden/);
    assert.match(printModalContent, /leftPanelRef/);
  });

  test('5. PrintLabelsModal includes accessibility features: role=dialog, aria-modal, focus trap, and Escape key', () => {
    assert.match(printModalContent, /role="dialog"/);
    assert.match(printModalContent, /aria-modal="true"/);
    assert.match(printModalContent, /aria-labelledby="print-labels-modal-title"/);
    assert.match(printModalContent, /aria-label="Close dialog"/);
    assert.match(printModalContent, /e\.key === 'Escape'/);
    assert.match(printModalContent, /e\.key === 'Tab'/);
  });

  test('6. PrintLabelsModal preserves all layout types, label presets, and print engine output', () => {
    assert.match(printModalContent, /layoutMode/);
    assert.match(printModalContent, /Roll \/ Single/);
    assert.match(printModalContent, /Sheet \(A4\)/);
    assert.match(printModalContent, /LABEL_PRESETS/);
    assert.match(printModalContent, /print-sheet-page/);
    assert.match(printModalContent, /print-label-cell/);
  });

  test('7. RecordModal is portalled to document.body with z-[1000], scroll lock, and m-auto shrink-0', () => {
    assert.match(recordModalContent, /createPortal\(/);
    assert.match(recordModalContent, /z-\[1000\]/);
    assert.match(recordModalContent, /overflow-y-auto/);
    assert.match(recordModalContent, /max-h-\[calc\(100dvh-32px\)\]/);
    assert.match(recordModalContent, /m-auto\s+shrink-0/);
    assert.match(recordModalContent, /role="dialog"/);
  });

  test('8. ConfirmModal is portalled to document.body with z-[1000], scroll lock, and m-auto shrink-0', () => {
    assert.match(confirmModalContent, /createPortal\(/);
    assert.match(confirmModalContent, /z-\[1000\]/);
    assert.match(confirmModalContent, /overflow-y-auto/);
    assert.match(confirmModalContent, /max-h-\[calc\(100dvh-32px\)\]/);
    assert.match(confirmModalContent, /m-auto\s+shrink-0/);
    assert.match(confirmModalContent, /role="dialog"/);
  });

  test('9. LocationSwitcherModal is portalled to document.body with z-[1000], scroll lock, and m-auto shrink-0', () => {
    assert.match(locationSwitcherContent, /createPortal\(/);
    assert.match(locationSwitcherContent, /z-\[1000\]/);
    assert.match(locationSwitcherContent, /overflow-y-auto/);
    assert.match(locationSwitcherContent, /max-h-\[calc\(100dvh-32px\)\]/);
    assert.match(locationSwitcherContent, /m-auto\s+shrink-0/);
    assert.match(locationSwitcherContent, /role="dialog"/);
  });
});

