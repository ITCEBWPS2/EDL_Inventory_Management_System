// verify_decoupled_received.js
// Automated verification for decoupled received and expended items

const db = require('../src/services/db');
const assert = require('assert');

async function runVerification() {
  console.log('--- Starting Decoupled Received Items Verification ---');

  const testUnitId = '11111111-1111-1111-1111-111111111145'; // Homagama CSC
  const testItemName = 'Custom Conference Desk ' + Date.now();

  // 1. Initial inventory catalog count
  const initialCatalog = await db.getInventoryItems();
  const initialCatalogCount = initialCatalog.length;
  console.log(`Initial inventory catalog count: ${initialCatalogCount}`);

  // 2. Create a Received Transaction with free-text item_name
  const receivedTx = await db.createReceivedTransaction({
    item_name: testItemName,
    category: 'Furniture',
    quantity: 10,
    date: '2026-09-16',
    unit_id: testUnitId,
    voucher_no: 'RV-TEST-999',
    from_whom: 'Finco Furnitures',
    notes: 'Test batch of decoupled incoming desks',
    created_by: '00000000-0000-0000-0000-000000000001'
  });

  assert.ok(receivedTx.id, 'Received transaction created successfully');
  assert.strictEqual(receivedTx.item_name, testItemName, 'item_name preserved');
  console.log('✓ Step 1: Received transaction created without catalog item');

  // 3. Confirm inventory_items was NOT modified or polluted
  const currentCatalog = await db.getInventoryItems();
  assert.strictEqual(currentCatalog.length, initialCatalogCount, 'Inventory catalog was NOT touched');
  console.log('✓ Step 2: Inventory catalog untouched and independent');

  // 4. Confirm getReceivedTransactions returns item_name and no item_code
  const receivedList = await db.getReceivedTransactions([testUnitId]);
  const foundReceived = receivedList.find(r => r.id === receivedTx.id);
  assert.ok(foundReceived, 'Transaction found in received list');
  assert.strictEqual(foundReceived.item_name, testItemName, 'Received record has correct item_name');
  assert.strictEqual(foundReceived.item_code, undefined, 'Received record does NOT have item_code');
  console.log('✓ Step 3: Received records display only item_name, no catalog code');

  // 5. Confirm Remaining Stock correctly aggregates by item_name
  const remainingBefore = await db.getRemainingInventory([testUnitId]);
  const remItemBefore = remainingBefore.find(r => r.item_name === testItemName);
  assert.ok(remItemBefore, 'Remaining inventory includes the new item');
  assert.strictEqual(remItemBefore.total_received, 10, 'Total received is 10');
  assert.strictEqual(remItemBefore.total_expended, 0, 'Total expended is 0');
  assert.strictEqual(remItemBefore.remaining_qty, 10, 'Remaining balance is 10');
  console.log('✓ Step 4: Remaining stock computed accurately by unit + item_name');

  // 6. Create an Expended Transaction matching this item_name
  const expendedTx = await db.createExpendedTransaction({
    item_name: testItemName,
    category: 'Furniture',
    quantity: 4,
    date: '2026-09-16',
    unit_id: testUnitId,
    voucher_no: 'EV-TEST-999',
    disposition: 'Transferred to Area Maintenance Unit',
    notes: 'Expended 4 units for maintenance station',
    created_by: '00000000-0000-0000-0000-000000000001'
  });

  assert.ok(expendedTx.id, 'Expended transaction created successfully');
  console.log('✓ Step 5: Expended transaction created referencing received item name');

  // 7. Verify Remaining Stock balance after expenditure
  const remainingAfter = await db.getRemainingInventory([testUnitId]);
  const remItemAfter = remainingAfter.find(r => r.item_name === testItemName);
  assert.ok(remItemAfter, 'Item still in remaining inventory');
  assert.strictEqual(remItemAfter.total_received, 10, 'Total received remains 10');
  assert.strictEqual(remItemAfter.total_expended, 4, 'Total expended is now 4');
  assert.strictEqual(remItemAfter.remaining_qty, 6, 'Remaining balance accurately updated to 6');
  console.log('✓ Step 6: Remaining stock reconciled: 10 in - 4 out = 6 remaining');

  // 8. Confirm original received record was NEVER modified
  const receivedListAfter = await db.getReceivedTransactions([testUnitId]);
  const originalReceived = receivedListAfter.find(r => r.id === receivedTx.id);
  assert.ok(originalReceived, 'Original received record still exists');
  assert.strictEqual(originalReceived.quantity, 10, 'Original received record quantity is UNCHANGED');
  assert.strictEqual(originalReceived.voucher_no, 'RV-TEST-999', 'Original received voucher is UNCHANGED');
  console.log('✓ Step 7: Original received record is permanent historical log and untouched');

  console.log('--- All Decoupling Verification Checks PASSED Successfully! ---');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
