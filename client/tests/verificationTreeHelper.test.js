import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTopHeading,
  isNodeSelectable,
  analyzeLocationTree,
  filterLocationTree
} from '../src/utils/verificationTreeHelper.js';

describe('Verification Tree Helper Test Suite', () => {
  const sampleHierarchy = [
    {
      id: 'root-1',
      unit_code: 'EDL-HQ',
      unit_name: 'Electrical Distribution Lanka (Pvt) Ltd',
      unit_type: 'area',
      children: [
        {
          id: 'div-d3',
          unit_code: 'DIV-D3',
          unit_name: 'D3',
          unit_type: 'area',
          children: [
            {
              id: 'reg-wps2',
              unit_code: 'REG-WPS-II',
              unit_name: 'WPS-II',
              unit_type: 'area',
              children: [
                {
                  id: 'unit-ito',
                  unit_code: 'WPS-ITO',
                  unit_name: 'ITO',
                  unit_type: 'unit',
                  children: []
                },
                {
                  id: 'unit-acc',
                  unit_code: 'ACC-EXP',
                  unit_name: 'ACC EXP',
                  unit_type: 'unit',
                  children: []
                },
                {
                  id: 'area-avissawella',
                  unit_code: 'AREA-AVISSAWELLA',
                  unit_name: 'AREA AVISSAWELLA',
                  unit_type: 'area',
                  children: [
                    {
                      id: 'amu-avissawella',
                      unit_code: 'AMU-AVISSAWELLA',
                      unit_name: 'AMU-Avissawella',
                      unit_type: 'unit',
                      children: []
                    },
                    {
                      id: 'csc-avissawella',
                      unit_code: 'CSC-AVISSAWELLA',
                      unit_name: 'CSC_AVISSAWELLA',
                      unit_type: 'csc',
                      children: []
                    }
                  ]
                },
                {
                  id: 'area-horana',
                  unit_code: 'AREA-HORANA',
                  unit_name: 'AREA HORANA',
                  unit_type: 'area',
                  children: [
                    {
                      id: 'amu-horana',
                      unit_code: 'AMU-HORANA',
                      unit_name: 'AMU-Horana',
                      unit_type: 'unit',
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ];

  test('1. Headings check: EDL, D3, WPS-II are non-selectable headings', () => {
    assert.equal(isTopHeading(sampleHierarchy[0]), true);
    assert.equal(isNodeSelectable(sampleHierarchy[0]), false);

    const d3 = sampleHierarchy[0].children[0];
    assert.equal(isTopHeading(d3), true);
    assert.equal(isNodeSelectable(d3), false);

    const wps2 = d3.children[0];
    assert.equal(isTopHeading(wps2), true);
    assert.equal(isNodeSelectable(wps2), false);
  });

  test('2. Operational and Area nodes: AREA AVISSAWELLA, AMU-Avissawella, and ITO are selectable', () => {
    const wps2Children = sampleHierarchy[0].children[0].children[0].children;
    const ito = wps2Children.find(c => c.unit_name === 'ITO');
    const areaAvissawella = wps2Children.find(c => c.unit_name === 'AREA AVISSAWELLA');
    const amuAvissawella = areaAvissawella.children[0];

    assert.equal(isNodeSelectable(ito), true);
    assert.equal(isNodeSelectable(areaAvissawella), true); // Group nodes are selectable!
    assert.equal(isNodeSelectable(amuAvissawella), true);
  });

  test('3. Tree analysis: calculates paths and counts all selectable nodes', () => {
    const { selectableNodes, pathsMap, parentGroupMap } = analyzeLocationTree(sampleHierarchy);

    // Total selectable nodes: ITO, ACC EXP, AREA AVISSAWELLA, AMU-Avissawella, CSC_AVISSAWELLA, AREA HORANA, AMU-Horana = 7
    assert.equal(selectableNodes.length, 7);

    // Path check
    assert.equal(pathsMap.get('amu-avissawella'), 'EDL > D3 > WPS-II > AREA AVISSAWELLA > AMU-Avissawella');
    assert.equal(pathsMap.get('unit-ito'), 'EDL > D3 > WPS-II > ITO');

    // Dynamic Grouping check:
    // ITO -> WPS-II (direct)
    assert.equal(parentGroupMap.get('unit-ito'), 'WPS-II (direct)');
    // AMU-Avissawella -> AREA AVISSAWELLA
    assert.equal(parentGroupMap.get('amu-avissawella'), 'AREA AVISSAWELLA');
    // CSC_AVISSAWELLA -> AREA AVISSAWELLA
    assert.equal(parentGroupMap.get('csc-avissawella'), 'AREA AVISSAWELLA');
    // AMU-Horana -> AREA HORANA
    assert.equal(parentGroupMap.get('amu-horana'), 'AREA HORANA');
  });

  test('4. Tree search: filters nodes by search query while maintaining ancestor chains', () => {
    const filtered = filterLocationTree(sampleHierarchy, 'AVISS');
    assert.equal(filtered.length, 1);
    const wps2 = filtered[0].children[0].children[0];
    assert.equal(wps2.children.length, 1);
    assert.equal(wps2.children[0].unit_name, 'AREA AVISSAWELLA');
    assert.equal(wps2.children[0].children.length, 2);
  });
});
