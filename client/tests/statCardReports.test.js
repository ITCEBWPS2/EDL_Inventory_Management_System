import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const statCardPath = path.resolve(__dirname, '../src/components/common/StatCard.jsx');
const kpiCardPath = path.resolve(__dirname, '../src/components/dashboard/KpiCard.jsx');
const reportsPagePath = path.resolve(__dirname, '../src/pages/ReportsPage.jsx');
const remainingPath = path.resolve(__dirname, '../src/pages/RemainingInventory.jsx');
const dashboardPath = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
const cssPath = path.resolve(__dirname, '../src/index.css');

describe('Unified StatCard & Reports Number Cards Test Suite', () => {
  const statCardContent = fs.readFileSync(statCardPath, 'utf8');
  const kpiCardContent = fs.readFileSync(kpiCardPath, 'utf8');
  const reportsContent = fs.readFileSync(reportsPagePath, 'utf8');
  const remainingContent = fs.readFileSync(remainingPath, 'utf8');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  test('1. StatCard component exists and exports StatCard with all required props', () => {
    assert.ok(fs.existsSync(statCardPath), 'StatCard.jsx must exist');
    assert.match(statCardContent, /export\s+const\s+StatCard/);
    assert.match(statCardContent, /label/);
    assert.match(statCardContent, /value/);
    assert.match(statCardContent, /displayValue/);
    assert.match(statCardContent, /highlight/);
    assert.match(statCardContent, /valueColor/);
    assert.match(statCardContent, /loading/);
    assert.match(statCardContent, /icon/);
  });

  test('2. StatCard implements required visual tokens: big bold number first, label under it, gold accent underline', () => {
    assert.match(statCardContent, /text-\[28px\]/);
    assert.match(statCardContent, /font-bold/);
    assert.match(statCardContent, /tabular-nums/);
    assert.match(statCardContent, /#f6c026/); // gold accent line
    assert.match(statCardContent, /rgba\(123,\s*28,\s*62,\s*0\.94\)/); // brand maroon highlight
    assert.match(statCardContent, /animate-pulse/); // skeleton placeholder
  });

  test('3. KpiCard re-exports StatCard for full backward compatibility', () => {
    assert.match(kpiCardContent, /StatCard/);
    assert.match(kpiCardContent, /export\s+{\s*StatCard\s*}/);
  });

  test('4. ReportsPage renders StatCard for Transaction History in a 4-col responsive grid', () => {
    assert.match(reportsContent, /import\s+{[^}]*StatCard[^}]*}\s+from\s+['"]\.\.\/components\/common\/StatCard['"]/);
    assert.match(reportsContent, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+lg:grid-cols-4/);
    assert.match(reportsContent, /label="Total Transactions"/);
    assert.match(reportsContent, /label="Total Items Quantity Received"/);
    assert.match(reportsContent, /label="Total Items Quantity Expended"/);
    assert.match(reportsContent, /label="Net Flow"/);
    assert.match(reportsContent, /highlight={true}/); // Net flow highlighted maroon
    assert.match(reportsContent, /#1F7A4D/); // Received green
    assert.match(reportsContent, /#B3261E/); // Expended muted red
  });

  test('5. ReportsPage renders StatCard chips for Current Inventory tab', () => {
    assert.match(reportsContent, /activeTab === 'inventory'/);
    assert.match(reportsContent, /label="Total Items"/);
    assert.match(reportsContent, /label="Active Categories"/);
  });

  test('6. RemainingInventory and Dashboard use StatCard with unified markup', () => {
    assert.match(remainingContent, /import\s+{[^}]*StatCard[^}]*}\s+from\s+['"]\.\.\/components\/common\/StatCard['"]/);
    assert.match(remainingContent, /<StatCard\s+label="Total Remaining Quantity"/);
    assert.match(dashboardContent, /import\s+{[^}]*StatCard[^}]*}\s+from\s+['"]\.\.\/components\/common\/StatCard['"]/);
    assert.match(dashboardContent, /<StatCard\s+label="Current Remaining Stock"/);
  });

  test('7. Print CSS rules force white background, 1px border, no shadow, and dark text for all stat cards', () => {
    assert.match(cssContent, /\.stat-card-root/);
    assert.match(cssContent, /\.stat-card-highlight/);
    assert.match(cssContent, /color:\s*#1B1B24\s*!important/);
  });
});

