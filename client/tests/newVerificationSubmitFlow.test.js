import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { safeNode } from '../src/utils/safeNode.js';
import { hasTestGeneratedData } from '../src/utils/verificationTestHelper.js';

test('New Verification Submit Flow, safeNode & ErrorBoundary Regression Tests', async (t) => {
  await t.test('1. safeNode guard blocks DOM Nodes and non-React objects without throwing', () => {
    // Mock DOM node if running in pure Node environment
    class FakeHTMLBodyElement {
      constructor() {
        this.nodeType = 1;
        this.tagName = 'BODY';
      }
    }
    const fakeBody = new FakeHTMLBodyElement();
    // Simulate instanceof Node
    globalThis.Node = FakeHTMLBodyElement;

    // Primitives must pass through
    assert.equal(safeNode('Hello world'), 'Hello world');
    assert.equal(safeNode(42), 42);
    assert.equal(safeNode(true), true);
    assert.equal(safeNode(null, 'default'), 'default');
    assert.equal(safeNode(undefined, 'default'), 'default');

    // Valid React elements must pass through
    const element = React.createElement('span', null, 'Text');
    assert.equal(safeNode(element), element);

    // Raw DOM nodes must be blocked and return fallback
    assert.equal(safeNode(fakeBody, 'fallback'), 'fallback');
    assert.equal(safeNode(fakeBody, null), null);

    // Plain non-React objects must be blocked and return fallback
    assert.equal(safeNode({ foo: 'bar' }, 'fallback'), 'fallback');
  });

  await t.test('2. ErrorBoundary defines componentDidUpdate for automatic reset on resetKey / location change', () => {
    const errorBoundaryPath = path.resolve(process.cwd(), 'client/src/components/common/ErrorBoundary.jsx');
    const content = fs.readFileSync(errorBoundaryPath, 'utf8');

    assert.ok(content.includes('componentDidUpdate(prevProps)'), 'Must implement componentDidUpdate');
    assert.ok(content.includes('resetKeyChanged'), 'Must detect resetKey change');
    assert.ok(content.includes('locationChanged'), 'Must detect location change');
    assert.ok(content.includes('this.handleReset()'), 'Must call handleReset when key or location changes');
  });

  await t.test('3. ErrorBoundary handleReset clears error and triggers onReset callback', () => {
    const errorBoundaryPath = path.resolve(process.cwd(), 'client/src/components/common/ErrorBoundary.jsx');
    const content = fs.readFileSync(errorBoundaryPath, 'utf8');

    assert.ok(content.includes('handleReset = () =>'), 'Must define handleReset method');
    assert.ok(content.includes('hasError: false'), 'Must clear hasError state');
    assert.ok(content.includes('this.props.onReset'), 'Must invoke onReset callback if provided');
  });

  await t.test('4. Step 2 JSX in NewVerification does NOT leak document.body via comma operator', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const newVerifPath = path.resolve(process.cwd(), 'client/src/pages/NewVerification.jsx');
    const content = fs.readFileSync(newVerifPath, 'utf8');

    // Must NOT have `currentStep === 2 && ( ... document.body )`
    const step2Match = content.match(/currentStep === 2\s*&&\s*\([\s\S]*?\)/);
    assert.ok(step2Match, 'Step 2 render block must exist');
    assert.doesNotMatch(
      step2Match[0],
      /,\s*document\.body\s*\)/,
      'Step 2 view must NOT end with ", document.body)"'
    );
  });

  await t.test('5. Submit to Review validation and test data safety flow', () => {
    // Case A: Missing required fields
    const validate = ({ date, verifier1, items }) => {
      const errors = {};
      if (!date) errors.date = 'Date is required.';
      if (!verifier1?.trim()) errors.verifier1 = 'Verifier 1 is required.';
      if (!items || items.length === 0) {
        errors.items = 'No items.';
      } else {
        const hasCount = items.some(it => it.physical_qty !== '' && it.physical_qty !== null && !isNaN(Number(it.physical_qty)));
        if (!hasCount) errors.items = 'At least one item must have physical qty.';
      }
      return errors;
    };

    const emptyErrors = validate({ date: '', verifier1: '', items: [] });
    assert.ok(emptyErrors.date);
    assert.ok(emptyErrors.verifier1);
    assert.ok(emptyErrors.items);

    // Case B: Normal verification with counts
    const validItems = [
      { id: '1', system_qty: 5, physical_qty: 5, label_no: 'VL-0001' }
    ];
    const normalErrors = validate({ date: '2026-11-18', verifier1: 'John Doe', items: validItems });
    assert.equal(Object.keys(normalErrors).length, 0);
    assert.equal(hasTestGeneratedData(validItems), false);

    // Case C: Test data verification
    const testItems = [
      { id: '1', system_qty: 5, physical_qty: 5, label_no: 'TEST-0001' }
    ];
    const testErrors = validate({ date: '2026-11-18', verifier1: 'Test Verifier 1', items: testItems });
    assert.equal(Object.keys(testErrors).length, 0);
    assert.equal(hasTestGeneratedData(testItems), true);
  });
});
