import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Reports Overview Page & Unified Hub Architecture Verification', async (t) => {
  await t.test('1. ReportsOverviewPage defines all 3 required report cards and uses HubPage', () => {
    const filePath = path.resolve(__dirname, '../src/pages/ReportsOverviewPage.jsx');
    assert.ok(fs.existsSync(filePath), 'ReportsOverviewPage.jsx must exist');

    const content = fs.readFileSync(filePath, 'utf8');

    // Uses unified HubPage
    assert.ok(content.includes('HubPage'), 'Must use unified HubPage');

    // Check report IDs and paths
    assert.ok(content.includes('Current Inventory Report'), 'Must have Current Inventory Report title');
    assert.ok(content.includes('/reports/inventory'), 'Must link to /reports/inventory');

    assert.ok(content.includes('Transaction History Report'), 'Must have Transaction History Report title');
    assert.ok(content.includes('/reports/transactions'), 'Must link to /reports/transactions');

    assert.ok(content.includes('Verification Audit Report'), 'Must have Verification Audit Report title');
    assert.ok(content.includes('/reports/verification'), 'Must link to /reports/verification');

    // Check icons
    assert.ok(content.includes('BarChart2'), 'Must use BarChart2 icon');
    assert.ok(content.includes('ArrowUpDown'), 'Must use ArrowUpDown icon');
    assert.ok(content.includes('ShieldCheck'), 'Must use ShieldCheck icon');
  });

  await t.test('2. HubPage and HubCard implement standard layout, responsive grid and back button', () => {
    const hubPagePath = path.resolve(__dirname, '../src/components/common/HubPage.jsx');
    const hubCardPath = path.resolve(__dirname, '../src/components/common/HubCard.jsx');
    assert.ok(fs.existsSync(hubPagePath), 'HubPage.jsx must exist');
    assert.ok(fs.existsSync(hubCardPath), 'HubCard.jsx must exist');

    const hubPageContent = fs.readFileSync(hubPagePath, 'utf8');
    const hubCardContent = fs.readFileSync(hubCardPath, 'utf8');

    // Responsive 3-col grid (>=1100px), 2 tablet, 1 mobile
    assert.ok(hubPageContent.includes('grid-cols-1 md:grid-cols-2 min-[1100px]:grid-cols-3'), 'Must have responsive grid specification');
    // Standard back button returning to Dashboard
    assert.ok(hubPageContent.includes('<BackButton to={backTo} id="btn-back-dashboard" />'), 'Must have BackButton to dashboard');

    // HubCard features: action link "Open", brand maroon hover/link, focus ring
    assert.ok(hubCardContent.includes('Open'), 'Action link must say Open');
    assert.ok(hubCardContent.includes('text-[#7a1a3c]'), 'Action link and hover must use brand maroon');
    assert.ok(hubCardContent.includes('line-clamp-2'), 'Must clamp description to 2 lines');
  });

  await t.test('3. All 4 overview/hub pages use HubPage', () => {
    const pages = [
      '../src/pages/CategoriesPage.jsx',
      '../src/pages/TransactionsOverviewPage.jsx',
      '../src/pages/AnnualVerificationOverviewPage.jsx',
      '../src/pages/ReportsOverviewPage.jsx'
    ];

    for (const p of pages) {
      const fullPath = path.resolve(__dirname, p);
      assert.ok(fs.existsSync(fullPath), `${p} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.includes('HubPage'), `${p} must use HubPage`);
    }
  });

  await t.test('4. App.jsx registers /reports route to ReportsOverviewPage without breaking /reports/:tab', () => {
    const appPath = path.resolve(__dirname, '../src/App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes("import { ReportsOverviewPage } from './pages/ReportsOverviewPage';"), 'App.jsx must import ReportsOverviewPage');
    assert.ok(content.includes('<Route path="/reports"') && content.includes('<ReportsOverviewPage />'), 'App.jsx must register /reports route');
    assert.ok(content.includes('<Route path="/reports/:tab"') && content.includes('<ReportsPage />'), 'App.jsx must register /reports/:tab route');
  });

  await t.test('5. ReportsPage.jsx breadcrumbs link back to /reports and includes BackButton', () => {
    const reportsPagePath = path.resolve(__dirname, '../src/pages/ReportsPage.jsx');
    const content = fs.readFileSync(reportsPagePath, 'utf8');

    assert.ok(content.includes("{ label: 'Reports', path: '/reports' }"), 'Breadcrumb Reports label must link to /reports');
    assert.ok(content.includes('<BackButton to="/reports" id="btn-back-reports" className="no-print" />'), 'ReportsPage must render BackButton to /reports');
  });

  await t.test('6. AppShell.jsx handles navigation to /reports and isolated active highlighting', () => {
    const appShellPath = path.resolve(__dirname, '../src/components/layout/AppShell.jsx');
    const content = fs.readFileSync(appShellPath, 'utf8');

    assert.ok(content.includes('handleReportsClick'), 'AppShell must define handleReportsClick');
    assert.ok(content.includes('handleReportsToggleOnly'), 'AppShell must define handleReportsToggleOnly');
    assert.ok(content.includes("isCurrent('/reports')"), 'AppShell must check isCurrent for /reports');
    assert.ok(!content.includes("isCurrent('/reports/inventory') || isCurrent('/reports')"), 'Sub-item must not highlight on /reports');
  });
});
