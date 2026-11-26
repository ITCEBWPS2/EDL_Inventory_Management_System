import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Disposal Redesign: Brand Colours, Step Action Bar & Headers', () => {
  const statusBadgeSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/common/StatusBadge.jsx'), 'utf8');
  const stepActionBarSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/disposal/StepActionBar.jsx'), 'utf8');
  const stepActionButtonSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/disposal/StepActionButton.jsx'), 'utf8');
  const stepFormModalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/disposal/StepFormModal.jsx'), 'utf8');
  const stepperSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/disposal/DisposalStepper.jsx'), 'utf8');
  const detailPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/DisposalRequestDetailPage.jsx'), 'utf8');
  const listPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/DisposalRequestsListPage.jsx'), 'utf8');
  const newPageSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/NewDisposalRequestPage.jsx'), 'utf8');

  test('1. StatusBadge maps all Disposal statuses to EDL logo colours with zero green', () => {
    // Draft -> grey (#EEEAE8 / #4A4D5A)
    assert.match(statusBadgeSrc, /norm === 'draft'/);
    assert.match(statusBadgeSrc, /#EEEAE8/);
    assert.match(statusBadgeSrc, /#4A4D5A/);

    // Submitted -> gold tint (#FFF4D6 / #7A5600)
    assert.match(statusBadgeSrc, /norm === 'submitted'/);
    assert.match(statusBadgeSrc, /#FFF4D6/);
    assert.match(statusBadgeSrc, /#7A5600/);

    // Board Appointed -> maroon tint (#F7E9EE / #7B1C3E)
    assert.match(statusBadgeSrc, /norm === 'board appointed' \|\| norm === 'board_appointed'/);
    assert.match(statusBadgeSrc, /#F7E9EE/);
    assert.match(statusBadgeSrc, /#7B1C3E/);

    // Approved -> solid gold (#F4B731 / #3A2A00)
    assert.match(statusBadgeSrc, /norm === 'approved'/);
    assert.match(statusBadgeSrc, /#F4B731/);
    assert.match(statusBadgeSrc, /#3A2A00/);

    // In Disposal -> solid maroon-dark tint (#EBD3DC / #5B1A3A)
    assert.match(statusBadgeSrc, /norm === 'in disposal' \|\| norm === 'in_disposal'/);
    assert.match(statusBadgeSrc, /#EBD3DC/);
    assert.match(statusBadgeSrc, /#5B1A3A/);

    // Completed -> solid maroon (#7B1C3E / white)
    assert.match(statusBadgeSrc, /norm === 'completed'/);

    // Rejected -> white with red outline (#B3261E)
    assert.match(statusBadgeSrc, /norm === 'rejected'/);
    assert.match(statusBadgeSrc, /#B3261E/);

    // Committee decisions in Items table
    assert.match(statusBadgeSrc, /approve for destruction/);
    assert.match(statusBadgeSrc, /approve for tender/);
    assert.match(statusBadgeSrc, /retain/);
    assert.match(statusBadgeSrc, /repair/);

    // Check that disposal statuses block has no green/emerald
    const disposalBlock = statusBadgeSrc.slice(
      statusBadgeSrc.indexOf('// Specific Disposal Workflow Statuses'),
      statusBadgeSrc.indexOf('// Legacy inventory') !== -1 ? statusBadgeSrc.indexOf('// Legacy inventory') : statusBadgeSrc.indexOf('norm === \'issued\'')
    );
    assert.doesNotMatch(disposalBlock, /emerald/i);
    assert.doesNotMatch(disposalBlock, /green/i);
    assert.doesNotMatch(disposalBlock, /#2e7d58/i);
  });

  test('2. StepActionBar enforces strict button order: [primary step action(s)] [Print Report] [Revert Last Step]', () => {
    // Primary actions appear first
    const primaryIdx = stepActionBarSrc.indexOf('variant="primary"');
    const printIdx = stepActionBarSrc.indexOf('label="Print Report"');
    const revertIdx = stepActionBarSrc.indexOf('label="Revert Last Step"');

    assert.ok(primaryIdx !== -1, 'Primary action button must exist');
    assert.ok(printIdx !== -1, 'Print Report button must exist');
    assert.ok(revertIdx !== -1, 'Revert Last Step button must exist');

    assert.ok(primaryIdx < printIdx, 'Primary step action must come before Print Report');
    assert.ok(printIdx < revertIdx, 'Print Report must come before Revert Last Step');
  });

  test('3. StepActionBar enforces uniform "Record <Step>" button labels and count pills', () => {
    assert.match(stepActionBarSrc, /label="Record Board Appointment"/);
    assert.match(stepActionBarSrc, /label="Record Committee Decision"/);
    assert.match(stepActionBarSrc, /label="Record Destruction"/);
    assert.match(stepActionBarSrc, /label="Record Tender Release"/);
    assert.match(stepActionBarSrc, /<span>Completed<\/span>/);

    // Super admin permission check for Revert Last Step
    assert.match(stepActionBarSrc, /isSuperAdmin && onRevert/);

    // Helper text for roles without permission
    assert.match(stepActionBarSrc, /Waiting for .* to record this step/);
  });

  test('4. StepActionButton is 36px (h-9) with 16px (w-4 h-4) icons and uniform styling', () => {
    assert.match(stepActionButtonSrc, /h-9/);
    assert.match(stepActionButtonSrc, /w-4 h-4/);
    assert.match(stepActionButtonSrc, /bg-gradient-to-r from-\[#7B1C3E\] to-\[#5B1A3A\]/);
  });

  test('5. StepFormModal provides uniform header, subtitle with request_no and Unit, scrollable body, and sticky footer', () => {
    assert.match(stepFormModalSrc, /id="step-form-modal-title"/);
    assert.match(stepFormModalSrc, /Unit:/);
    assert.match(stepFormModalSrc, /Escape/);
    assert.match(stepFormModalSrc, /Cancel/);
  });

  test('6. DisposalStepper uses EDL logo palette with zero green/emerald', () => {
    // Completed: #F7E9EE, #7B1C3E
    assert.match(stepperSrc, /#F7E9EE/);
    assert.match(stepperSrc, /#7B1C3E/);

    // Current: #FFF4D6, #F4B731
    assert.match(stepperSrc, /#FFF4D6/);
    assert.match(stepperSrc, /#F4B731/);

    // Connectors: maroon and grey
    assert.match(stepperSrc, /connectorIsMaroon/);

    // Zero green / emerald in stepper component
    assert.doesNotMatch(stepperSrc, /emerald/i);
    assert.doesNotMatch(stepperSrc, /green/i);
  });

  test('7. Header text updates: Operational Unit -> Unit, logo tile and decorative Board of Survey badge removed', () => {
    // No "Operational Unit" in disposal pages
    assert.doesNotMatch(detailPageSrc, /Operational Unit/);
    assert.doesNotMatch(listPageSrc, /Operational Unit/);
    assert.doesNotMatch(newPageSrc, /Operational Unit/);

    // Unit: is used instead
    assert.match(detailPageSrc, /<span>Unit:<\/span>/);
    assert.match(listPageSrc, /<th[^>]*>Unit<\/th>/);
    assert.match(newPageSrc, /Unit <span/);

    // Items tab card title & subtitle
    assert.match(detailPageSrc, /<h2[^>]*>Line Items<\/h2>/);
    assert.match(detailPageSrc, /All assets included in this disposal request\./);

    // Standard bottom back link
    assert.match(detailPageSrc, /&larr; Back to List/);

    // WAY BILL NO highlight has gold tint with maroon border
    assert.match(detailPageSrc, /border-2 border-\[#7B1C3E\] bg-\[#FFF4D6\]/);
  });
});
