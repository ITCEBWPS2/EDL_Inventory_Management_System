import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const detailPagePath = path.resolve(__dirname, '../src/pages/DisposalRequestDetailPage.jsx');
const listPagePath = path.resolve(__dirname, '../src/pages/DisposalRequestsListPage.jsx');
const newPagePath = path.resolve(__dirname, '../src/pages/NewDisposalRequestPage.jsx');
const bosPrintPath = path.resolve(__dirname, '../src/components/disposal/BoardOfSurveyPrint.jsx');
const destructionPrintPath = path.resolve(__dirname, '../src/components/disposal/DestructionCertificatePrint.jsx');
const waybillPrintPath = path.resolve(__dirname, '../src/components/disposal/WayBillPrint.jsx');
const statusBadgePath = path.resolve(__dirname, '../src/components/common/StatusBadge.jsx');

describe('Disposal Requests Committee Workflow Client Test Suite', () => {
  const detailContent = fs.readFileSync(detailPagePath, 'utf8');
  const listContent = fs.readFileSync(listPagePath, 'utf8');
  const newContent = fs.readFileSync(newPagePath, 'utf8');
  const bosContent = fs.readFileSync(bosPrintPath, 'utf8');
  const destructionContent = fs.readFileSync(destructionPrintPath, 'utf8');
  const waybillContent = fs.readFileSync(waybillPrintPath, 'utf8');
  const badgeContent = fs.readFileSync(statusBadgePath, 'utf8');

  test('1. Detail page stepper defines exactly 5 stages and no separate Inspected or Approval stage', () => {
    assert.match(detailContent, /key:\s*['"]submitted['"],\s*label:\s*['"]Submitted['"]/);
    assert.match(detailContent, /key:\s*['"]board_appointed['"],\s*label:\s*['"]Board [Aa]ppointed['"]/);
    assert.match(detailContent, /key:\s*['"]committee_decision['"],\s*label:\s*['"]Committee [Dd]ecision['"]/);
    assert.match(detailContent, /key:\s*['"]in_disposal['"],\s*label:\s*['"]Disposal['"]/);
    assert.match(detailContent, /key:\s*['"]completed['"],\s*label:\s*['"]Completed['"]/);

    // Ensure no 'Inspected' or separate 'Approval' in stepper
    assert.doesNotMatch(detailContent, /label:\s*['"]Inspected['"]/i);
    assert.doesNotMatch(detailContent, /label:\s*['"]Approval['"]/i);
  });

  test('2. Detail page defines 5 tabs: Overview, Items, Committee, Disposal, Timeline', () => {
    assert.match(detailContent, /key:\s*['"]overview['"],\s*label:\s*['"]Overview['"]/);
    assert.match(detailContent, /key:\s*['"]items['"]/);
    assert.match(detailContent, /key:\s*['"]committee['"],\s*label:\s*['"]Committee['"]/);
    assert.match(detailContent, /key:\s*['"]disposal['"]/);
    assert.match(detailContent, /key:\s*['"]timeline['"]/);

    // Old tabs "Board of Survey" and "Approval" are merged into one "Committee" tab
    assert.doesNotMatch(detailContent, /key:\s*['"]approval['"]/i);
  });

  test('3. Record board appointment form validates 3 to 6 members, appointment date and default DGM without letter no field', () => {
    assert.match(detailContent, /RecordBoardAppointmentModal/);
    assert.match(detailContent, /members\.length\s*<\s*3/);
    assert.match(detailContent, /members\.length\s*>\s*6/);
    assert.doesNotMatch(detailContent, /<label[^>]*>\s*Appointment Letter No/);
    assert.match(detailContent, /appointmentDate/);
    assert.match(detailContent, /appointedByName/);
    assert.match(detailContent, /Appointed By \(DGM\)/);
    assert.match(detailContent, /Eng\.E\.K\.\s*Indranatha/);
  });

  test('4. Record committee decision modal implements per-item decision selector and helpers', () => {
    assert.match(detailContent, /RecordCommitteeDecisionModal/);
    assert.match(detailContent, /reportRef/);
    assert.match(detailContent, /decisionDate/);
    assert.match(detailContent, /membersPresent/);
    assert.match(detailContent, /handleSetAllTo/);

    // Per-item decisions
    assert.match(detailContent, /Approve for Destroy/);
    assert.match(detailContent, /Approve for Tender/);
  });

  test('5. DGM Approval fields and wording are completely removed from committee decision form', () => {
    assert.doesNotMatch(detailContent, /approved_by_name/i);
    assert.doesNotMatch(detailContent, /approved by \(DGM\)/i);
    assert.doesNotMatch(detailContent, /DGM Approval/i);
    assert.doesNotMatch(detailContent, /approval_letter_no/i);
  });

  test('6. List page status chips include Draft, Submitted, Board Appointed, Approved, In Disposal, Completed, Rejected (no Inspected)', () => {
    assert.match(listContent, /{\s*key:\s*['"]all['"],\s*label:\s*['"]All['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]draft['"],\s*label:\s*['"]Draft['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]submitted['"],\s*label:\s*['"]Submitted['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]board_appointed['"],\s*label:\s*['"]Board Appointed['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]approved['"],\s*label:\s*['"]Approved['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]in_disposal['"],\s*label:\s*['"]In Disposal['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]completed['"],\s*label:\s*['"]Completed['"]\s*}/);
    assert.match(listContent, /{\s*key:\s*['"]rejected['"],\s*label:\s*['"]Rejected['"]\s*}/);

    assert.doesNotMatch(listContent, /['"]inspected['"]/i);
  });

  test('7. StatusBadge handles Board Appointed, In Disposal, and per-item committee decisions', () => {
    assert.match(badgeContent, /board appointed/i);
    assert.match(badgeContent, /in disposal/i);
    assert.match(badgeContent, /approve for destroy/i);
    assert.match(badgeContent, /approve for tender/i);
    assert.match(badgeContent, /retain/i);
    assert.match(badgeContent, /repair/i);
  });

  test('8. Board of Survey Print shows committee members signature lines and NO DGM approval block', () => {
    assert.match(bosContent, /BoardOfSurveyPrint/);
    assert.match(bosContent, /Committee Decision/);
    assert.match(bosContent, /Certification by the Board of Survey Committee/);
    assert.match(bosContent, /boardMembers\.map/);

    // Strictly no DGM approval block in print template
    assert.doesNotMatch(bosContent, /DGM Approval/i);
    assert.doesNotMatch(bosContent, /Approved by DGM/i);
    assert.doesNotMatch(bosContent, /Deputy General Manager Approval/i);
  });

  test('9. Destruction Certificate and Way Bill print templates cite Committee Report Ref as authority', () => {
    assert.match(destructionContent, /Authority.*committee_decision.*report_ref/);
    assert.match(waybillContent, /Authority.*committee_decision.*report_ref/);
    assert.match(waybillContent, /waybill_no/);
  });

  test('10. New Disposal Request page handles operational units defensively without undefined units.map crash', () => {
    const newPagePath = path.resolve(__dirname, '../src/pages/NewDisposalRequestPage.jsx');
    const newPageContent = fs.readFileSync(newPagePath, 'utf8');

    // Must not attempt to destructure 'units' directly from useAuth (as AuthContext provides systemUnits)
    assert.doesNotMatch(newPageContent, /const\s*\{[^}]*\bunits\b[^}]*\}\s*=\s*useAuth\(\)/);
    // Must map availableUnits with safe array fallback
    assert.match(newPageContent, /availableUnits/);
    assert.doesNotMatch(newPageContent, /\{units\.map\(/);
  });

  test('11. New Disposal Request page simplifies form fields and inventory quick-fill', () => {
    const newPagePath = path.resolve(__dirname, '../src/pages/NewDisposalRequestPage.jsx');
    const newPageContent = fs.readFileSync(newPagePath, 'utf8');

    // Item Code text box removed
    assert.doesNotMatch(newPageContent, /<label[^>]*>\s*Item Code\s*<\/label>/);
    // Description & Background Notes (Optional) removed
    assert.doesNotMatch(newPageContent, /Description &amp; Background Notes/);
    // Simplified label: Reason for Disposal
    assert.match(newPageContent, /Reason for Disposal/);
    // Quick-fill shows only item name and availability (no item_code / serial number in dropdown options)
    assert.match(newPageContent, /\{inv\.item_name\}\s*\(Available:\s*\{inv\.quantity\}\)/);
  });

  test('12. EDL logo tile is removed from disposal page headers as per redesign requirements', () => {
    const listPageContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/DisposalRequestsListPage.jsx'), 'utf8');
    const newPageContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/NewDisposalRequestPage.jsx'), 'utf8');
    const detailPageContent = fs.readFileSync(path.resolve(__dirname, '../src/pages/DisposalRequestDetailPage.jsx'), 'utf8');

    // Headers start directly without logo tile
    assert.doesNotMatch(listPageContent, /<img\s+src=\{edlLogo \|\| EDL_LOGO\}\s+alt="EDL Logo"/);
    assert.doesNotMatch(newPageContent, /<img\s+src=\{edlLogo \|\| EDL_LOGO\}\s+alt="EDL Logo"/);
    assert.doesNotMatch(detailPageContent, /<img\s+src=\{edlLogo \|\| EDL_LOGO\}\s+alt="EDL Logo"/);
  });

  test('13. DisposalRequestDetailPage calls all hooks unconditionally before any early returns (rules of hooks)', () => {
    const lines = detailContent.split('\n');
    let earlyReturnIndex = -1;
    let parentChainIndex = -1;

    lines.forEach((line, idx) => {
      if (line.includes('if (loading) {') && earlyReturnIndex === -1) {
        earlyReturnIndex = idx;
      }
      if (line.includes('const parentChain = useMemo(')) {
        parentChainIndex = idx;
      }
    });

    assert.ok(earlyReturnIndex > 0, 'Must have early loading check');
    assert.ok(parentChainIndex > 0, 'Must define parentChain');
    assert.ok(
      parentChainIndex < earlyReturnIndex,
      `parentChain hook (line ${parentChainIndex + 1}) must be called BEFORE early return (line ${earlyReturnIndex + 1})`
    );
  });
});

