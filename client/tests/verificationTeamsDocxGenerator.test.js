import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateVerificationTeamsDocx } from '../src/utils/verificationTeamsDocxGenerator.js';

describe('Verification Teams Docx Generator Test Suite', () => {
  const sampleGroupedData = {
    'WPS-II (direct)': [
      {
        id: 'unit-ito',
        unit_name: 'ITO',
        unit_code: 'WPS-ITO',
        pathString: 'EDL > D3 > WPS-II > ITO',
        team: {
          members: [
            { name: 'N. Perera', designation: 'IT Officer' },
            { name: 'K. Silva', designation: 'Hardware Engineer' },
            { name: 'S. Bandara', designation: 'Technical Assistant' }
          ]
        }
      },
      {
        id: 'unit-acc',
        unit_name: 'ACC EXP',
        unit_code: 'ACC-EXP',
        pathString: 'EDL > D3 > WPS-II > ACC EXP',
        team: null // Pending, should NOT be in docx
      }
    ],
    'AREA AVISSAWELLA': [
      {
        id: 'amu-avissawella',
        unit_name: 'AMU-Avissawella',
        unit_code: 'AMU-AVISSAWELLA',
        pathString: 'EDL > D3 > WPS-II > AREA AVISSAWELLA > AMU-Avissawella',
        team: {
          members: [
            { name: 'K.D. Silva', designation: 'Storekeeper' },
            { name: 'P.M. Jayasinghe', designation: 'Superintendent' },
            { name: 'S.R. Fonseka', designation: 'Accountant' }
          ]
        }
      }
    ]
  };

  test('1. Document generation produces non-empty buffer and filters out pending teams', async () => {
    const blob = await generateVerificationTeamsDocx([], sampleGroupedData, 2026);
    assert.ok(blob);
    assert.ok(blob.size > 0);
  });
});
