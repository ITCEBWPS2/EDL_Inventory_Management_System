const test = require('node:test');
const assert = require('node:assert/strict');

test('Category Item Union and Name-Only Dropdown Test Suite', async (t) => {
  // Dynamically import ESM module from client
  const {
    buildCategoryItemUnion,
    CATEGORY_SUBTYPES,
    SUBTYPE_METADATA
  } = await import('../../client/src/constants/categorySubtypes.js');

  const categories = [
    'Furniture',
    'IT & Computing Equipment',
    'Network & Communication Equipment',
    'Audio Visual & Presentation',
    'Tools & Equipment'
  ];

  await t.test('1. Configured items are present for all 5 categories with clean names only', () => {
    for (const cat of categories) {
      const items = buildCategoryItemUnion(cat, []);
      assert.ok(items.length > 0, `Expected items for category: ${cat}`);

      const seen = new Set();
      for (const item of items) {
        // Name must not be empty
        assert.ok(item.item_name && item.item_name.trim().length > 0);

        // Deduplication check: no duplicate lowercase names
        const lower = item.item_name.trim().toLowerCase();
        assert.strictEqual(seen.has(lower), false, `Duplicate item name found: "${item.item_name}" in ${cat}`);
        seen.add(lower);

        // Name must NOT contain serial numbers, parenthesized serials, or codes
        assert.strictEqual(
          item.item_name.includes('DGM(') ||
          item.item_name.includes('/TLS/') ||
          item.item_name.includes('/CMP/') ||
          item.item_name.includes('/CHR/'),
          false,
          `Item name "${item.item_name}" contains serial code text`
        );
      }
    }
  });

  await t.test('2. Key specific items exist across categories without needing existing inventory', () => {
    // Tools & Equipment: Battery, UPS, Hammer, Hacksaw, Puncher (L), Puncher (S)
    const tools = buildCategoryItemUnion('Tools & Equipment', []);
    const toolNames = tools.map(i => i.item_name);
    assert.ok(toolNames.includes('Battery'), 'Battery should be present');
    assert.ok(toolNames.includes('UPS'), 'UPS should be present');
    assert.ok(toolNames.includes('Hammer'), 'Hammer should be present');
    assert.ok(toolNames.includes('Puncher (L)'), 'Puncher (L) should be present');
    assert.ok(toolNames.includes('Puncher (S)'), 'Puncher (S) should be present');
    assert.ok(toolNames.includes('Digital Multimeter'), 'Digital Multimeter should be present');

    // IT & Computing Equipment: Tab, Laptop, Desktop Computer, HDMI to VGA Convertor
    const it = buildCategoryItemUnion('IT & Computing Equipment', []);
    const itNames = it.map(i => i.item_name);
    assert.ok(itNames.includes('Tab'), 'Tab should be present');
    assert.ok(itNames.includes('Desktop Computer'), 'Desktop Computer should be present');
    assert.ok(itNames.includes('HDMI to VGA Convertor'), 'HDMI to VGA Convertor should be present');
    assert.ok(itNames.includes('Dot Matrix Printer'), 'Dot Matrix Printer should be present');
    assert.ok(itNames.includes('Dot Matrix Printer Backup'), 'Dot Matrix Printer Backup should be present');

    // Network: Managed Access Point
    const net = buildCategoryItemUnion('Network & Communication Equipment', []);
    const netNames = net.map(i => i.item_name);
    assert.ok(netNames.includes('Managed Access Point'), 'Managed Access Point should be present');

    // Furniture: Computer Executive Chair, Computer Typist Chair, Computer Assistant Chair
    const furn = buildCategoryItemUnion('Furniture', []);
    const furnNames = furn.map(i => i.item_name);
    assert.ok(furnNames.includes('Computer Executive Chair'));
    assert.ok(furnNames.includes('Computer Typist Chair'));
    assert.ok(furnNames.includes('Computer Assistant Chair'));
  });

  await t.test('3. Deduplication and single vs multiple inventory records', () => {
    const mockInventory = [
      // Single match
      { id: 'inv-hammer-1', item_name: 'Hammer', item_code: 'DGM(WPSII)/CE(COM)/ITO/TLS/HTL/HAMMER-HTL-001' },
      // Multiple matches with different case/trim
      { id: 'inv-ups-1', item_name: 'UPS', item_code: 'UPS-001' },
      { id: 'inv-ups-2', item_name: '  ups  ', item_code: 'UPS-002' },
      // Non-configured inventory item
      { id: 'inv-hydraulic-1', item_name: 'Hydraulic Press', item_code: 'HP-001' }
    ];

    const result = buildCategoryItemUnion('Tools & Equipment', mockInventory);

    // Hammer: single inventory record exists -> item_id should match inv-hammer-1
    const hammer = result.find(i => i.item_name.toLowerCase() === 'hammer');
    assert.ok(hammer);
    assert.strictEqual(hammer.item_name, 'Hammer');
    assert.strictEqual(hammer.id, 'inv-hammer-1');
    assert.strictEqual(hammer.is_configured, true);
    assert.strictEqual(hammer.is_inventory, true);

    // UPS: multiple records exist -> item_id should be null, appears only ONCE
    const upsList = result.filter(i => i.item_name.toLowerCase() === 'ups');
    assert.strictEqual(upsList.length, 1, 'UPS must appear exactly once');
    assert.strictEqual(upsList[0].id, null, 'Multiple inventory records must yield id: null');
    assert.strictEqual(upsList[0].item_name, 'UPS');

    // Battery: zero inventory records exist -> item_id null, is_inventory false
    const battery = result.find(i => i.item_name.toLowerCase() === 'battery');
    assert.ok(battery);
    assert.strictEqual(battery.id, null);
    assert.strictEqual(battery.is_inventory, false);

    // Non-configured Hydraulic Press: appears once with its single id
    const press = result.find(i => i.item_name.toLowerCase() === 'hydraulic press');
    assert.ok(press);
    assert.strictEqual(press.id, 'inv-hydraulic-1');
    assert.strictEqual(press.is_configured, false);
    assert.strictEqual(press.is_inventory, true);
  });

  await t.test('4. Preserves current item name when editing legacy record', () => {
    const result = buildCategoryItemUnion('Furniture', [], 'Legacy Ancient Wooden Stool');
    const legacy = result.find(i => i.item_name === 'Legacy Ancient Wooden Stool');
    assert.ok(legacy);
    assert.strictEqual(legacy.id, null);
    assert.strictEqual(legacy.sub_category_name, 'Existing Record Item');
  });
});
