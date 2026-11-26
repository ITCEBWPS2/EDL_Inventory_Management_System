/**
 * countSheetDocxGenerator.js
 * Generates an editable Microsoft Word (.docx) Physical Verification Count Sheet
 * matching the A4 Landscape form specification.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  ShadingType,
  VerticalAlign
} from 'docx';
import { REPORT_REGION_NAME, REPORT_LOGO_PATH, REPORT_COMPANY_NAME } from '../constants/report.js';
import { formatDate } from './formatters.js';

// Clean 0.5pt black border for table cells
const cellBorder = {
  style: BorderStyle.SINGLE,
  size: 4, // 0.5 pt in docx
  color: '000000'
};

const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder
};

/**
 * Loads the EDL logo image buffer for embedding in the Word header.
 */
async function loadLogoBuffer() {
  try {
    if (typeof window !== 'undefined' && window.fetch) {
      const res = await window.fetch(REPORT_LOGO_PATH);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return new Uint8Array(arrayBuf);
      }
    }
  } catch (err) {
    console.warn('Unable to load EDL logo image for docx header:', err);
  }
  return null;
}

/**
 * Generates the complete Word (.docx) document as a Blob or Buffer.
 *
 * @param {Object} countSheetData - Result of buildCountSheetData()
 * @param {Object} metadata - { unitName, date, year, verifier1, verifier2, verifier3 }
 * @returns {Promise<Blob|Buffer>}
 */
export async function generateCountSheetDocx(countSheetData, metadata = {}) {
  const { options, items, groups, totalItems, totalSystemQty } = countSheetData;
  const unitName = metadata.unitName || 'All Units';
  const rawDate = metadata.date || '';
  const dateFormatted = rawDate ? formatDate(rawDate) : '';
  const yearStr = metadata.year || new Date().getFullYear().toString();
  const verifier1 = metadata.verifier1 || '';
  const verifier2 = metadata.verifier2 || '';
  const verifier3 = metadata.verifier3 || '';

  const showSystemQty = Boolean(options.showSystemQty);
  const groupByCategory = Boolean(options.groupByCategory);
  const prefill = Boolean(options.prefillHeader);

  // Total printable width for A4 landscape: 15,704 twips (approx 277 mm)
  // Define column widths in twips
  const cols = [];
  if (groupByCategory) {
    // Category column is omitted from individual rows and rendered as group heading rows
    cols.push({ key: 'no', label: 'No.', width: 550, align: AlignmentType.CENTER });
    cols.push({ key: 'serial', label: 'Serial No.', width: showSystemQty ? 3600 : 4000, align: AlignmentType.LEFT });
    cols.push({ key: 'item', label: 'Item', width: showSystemQty ? 2200 : 2500, align: AlignmentType.LEFT });
    if (showSystemQty) {
      cols.push({ key: 'sys_qty', label: 'System\nQty', width: 850, align: AlignmentType.CENTER });
    }
    cols.push({ key: 'phys_qty', label: 'Physical\nQty', width: 950, align: AlignmentType.CENTER });
    cols.push({ key: 'diff', label: 'Diff.', width: 800, align: AlignmentType.CENTER });
    cols.push({ key: 'cond', label: 'Condition', width: 1100, align: AlignmentType.CENTER });
    cols.push({ key: 'issued', label: 'Issued /\nDestroyed', width: 1200, align: AlignmentType.CENTER });
    cols.push({ key: 'label', label: 'Verification\nLabel No.', width: 1250, align: AlignmentType.CENTER });
    // Remainder to remarks (~3204 twips / 56 mm)
    const used = cols.reduce((sum, c) => sum + c.width, 0);
    cols.push({ key: 'remarks', label: 'Remarks', width: Math.max(1000, 15704 - used), align: AlignmentType.LEFT });
  } else {
    // Category column is included
    cols.push({ key: 'no', label: 'No.', width: 550, align: AlignmentType.CENTER });
    cols.push({ key: 'serial', label: 'Serial No.', width: showSystemQty ? 3200 : 3500, align: AlignmentType.LEFT });
    cols.push({ key: 'item', label: 'Item', width: showSystemQty ? 2000 : 2200, align: AlignmentType.LEFT });
    cols.push({ key: 'category', label: 'Category', width: 1500, align: AlignmentType.LEFT });
    if (showSystemQty) {
      cols.push({ key: 'sys_qty', label: 'System\nQty', width: 800, align: AlignmentType.CENTER });
    }
    cols.push({ key: 'phys_qty', label: 'Physical\nQty', width: 900, align: AlignmentType.CENTER });
    cols.push({ key: 'diff', label: 'Diff.', width: 800, align: AlignmentType.CENTER });
    cols.push({ key: 'cond', label: 'Condition', width: 1100, align: AlignmentType.CENTER });
    cols.push({ key: 'issued', label: 'Issued /\nDestroyed', width: 1150, align: AlignmentType.CENTER });
    cols.push({ key: 'label', label: 'Verification\nLabel No.', width: 1200, align: AlignmentType.CENTER });
    const used = cols.reduce((sum, c) => sum + c.width, 0);
    cols.push({ key: 'remarks', label: 'Remarks', width: Math.max(1000, 15704 - used), align: AlignmentType.LEFT });
  }

  const logoBuffer = await loadLogoBuffer();

  // Document Headers & Top Banner
  const headerChildren = [];
  const topBannerCells = [];

  // Left cell: Logo or company text
  if (logoBuffer) {
    topBannerCells.push(
      new TableCell({
        width: { size: 7852, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: { width: 110, height: 44 }
              })
            ]
          })
        ]
      })
    );
  } else {
    topBannerCells.push(
      new TableCell({
        width: { size: 7852, type: WidthType.DXA },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'ELECTRICITY DISTRIBUTION LANKA', bold: true, size: 20, color: '7B1C3E' })
            ]
          })
        ]
      })
    );
  }

  // Right cell: Region Name
  topBannerCells.push(
    new TableCell({
      width: { size: 7852, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: REPORT_REGION_NAME,
              bold: true,
              size: 26,
              font: 'Times New Roman',
              color: '000000'
            })
          ]
        })
      ]
    })
  );

  headerChildren.push(
    new Table({
      width: { size: 15704, type: WidthType.DXA },
      rows: [new TableRow({ children: topBannerCells })]
    })
  );

  // Sub-band: Location & Printed on timestamp
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 80, after: 140 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 } },
      children: [
        new TextRun({ text: 'Location: ', bold: true, size: 16 }),
        new TextRun({ text: `${unitName}     |     `, size: 16 }),
        new TextRun({ text: 'Printed on: ', bold: true, size: 16 }),
        new TextRun({ text: `${formatDate(new Date())}     |     `, size: 16 }),
        new TextRun({ text: 'EDL Inventory Management System', italics: true, size: 16, color: '555555' })
      ]
    })
  );

  // Title
  const bodyParagraphs = [];
  bodyParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 140 },
      children: [
        new TextRun({
          text: 'ANNUAL PHYSICAL VERIFICATION - COUNT SHEET',
          bold: true,
          size: 24,
          font: 'Arial',
          color: '000000'
        })
      ]
    })
  );

  // Handwriting Fields Block (2 neat rows)
  const dateFieldText = prefill && dateFormatted ? dateFormatted : '____ / ____ / ________';
  const ver1Text = prefill && verifier1 ? verifier1 : '______________________________';
  const ver2Text = prefill && verifier2 ? verifier2 : '______________________________';
  const ver3Text = prefill && verifier3 ? verifier3 : '______________________________';

  bodyParagraphs.push(
    new Table({
      width: { size: 15704, type: WidthType.DXA },
      spacing: { after: 180 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5234, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Location: ', bold: true, size: 18 }),
                    new TextRun({ text: unitName, size: 18 })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 5234, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Date: ', bold: true, size: 18 }),
                    new TextRun({ text: dateFieldText, size: 18 })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 5236, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Year: ', bold: true, size: 18 }),
                    new TextRun({ text: yearStr, size: 18 })
                  ]
                })
              ]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              width: { size: 15704, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 120 },
                  children: [
                    new TextRun({ text: 'Verified by: ', bold: true, size: 18 }),
                    new TextRun({ text: '1) ', bold: true, size: 18 }),
                    new TextRun({ text: `${ver1Text}   `, size: 18 }),
                    new TextRun({ text: '2) ', bold: true, size: 18 }),
                    new TextRun({ text: `${ver2Text}   `, size: 18 }),
                    new TextRun({ text: '3) ', bold: true, size: 18 }),
                    new TextRun({ text: ver3Text, size: 18 })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  );

  // Table Building
  const tableRows = [];

  // 1. Repeating Header Row
  const headerCells = cols.map(col => {
    const lines = col.label.split('\n');
    return new TableCell({
      width: { size: col.width, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
      verticalAlign: VerticalAlign.CENTER,
      children: lines.map(line => new Paragraph({
        alignment: col.align,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: line, bold: true, size: 16, font: 'Arial' })]
      }))
    });
  });

  tableRows.push(
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headerCells
    })
  );

  // Helper to build a data row
  const createItemRow = (item, displayIdx) => {
    const rowCells = [];
    const isPending = item.is_pending_condemnation;

    // No.
    rowCells.push(
      new TableCell({
        width: { size: cols[0].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: String(displayIdx), size: 15, font: 'Arial' })]
          })
        ]
      })
    );

    // Serial No. (One serial per line, Consolas 8pt)
    const serialChildren = [];
    const serials = Array.isArray(item.serial_numbers) && item.serial_numbers.length > 0
      ? item.serial_numbers
      : (item.primary_serial ? [item.primary_serial] : []);

    serials.forEach((sn, sIdx) => {
      serialChildren.push(
        new Paragraph({
          spacing: { before: sIdx === 0 ? 30 : 15, after: sIdx === serials.length - 1 ? 30 : 15 },
          children: [
            new TextRun({ text: sn, font: 'Consolas', size: 15 })
          ]
        })
      );
    });

    if (serialChildren.length === 0) {
      serialChildren.push(
        new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [new TextRun({ text: '—', size: 15 })]
        })
      );
    }

    rowCells.push(
      new TableCell({
        width: { size: cols[1].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: serialChildren
      })
    );

    // Item (Item name + small "(Pending condemnation)" note underneath if applicable)
    const itemChildren = [
      new Paragraph({
        spacing: { before: 30, after: isPending ? 10 : 30 },
        children: [new TextRun({ text: item.item_name || '—', size: 15, bold: true, font: 'Arial' })]
      })
    ];
    if (isPending) {
      itemChildren.push(
        new Paragraph({
          spacing: { before: 0, after: 30 },
          children: [new TextRun({ text: '(Pending condemnation)', italics: true, size: 13, color: 'B4483A', font: 'Arial' })]
        })
      );
    }

    rowCells.push(
      new TableCell({
        width: { size: cols[2].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: itemChildren
      })
    );

    let currentColIdx = 3;

    // Category (if not grouped)
    if (!groupByCategory) {
      rowCells.push(
        new TableCell({
          width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: item.category || 'General', size: 14, font: 'Arial' })]
            })
          ]
        })
      );
    }

    // System Qty (if enabled)
    if (showSystemQty) {
      rowCells.push(
        new TableCell({
          width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: String(item.system_qty || 0), size: 16, bold: true, font: 'Arial' })]
            })
          ]
        })
      );
    }

    // Physical Qty (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    // Difference (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    // Condition (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    // Issued / Destroyed (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    // Verification Label No. (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    // Remarks (Empty box for handwriting)
    rowCells.push(
      new TableCell({
        width: { size: cols[currentColIdx++].width, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        children: [
          new Paragraph({
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: ' ', size: 16 })]
          })
        ]
      })
    );

    return new TableRow({
      cantSplit: true,
      children: rowCells
    });
  };

  // Render rows (with category grouping if enabled)
  let rowCounter = 1;
  if (groupByCategory && groups && groups.length > 0) {
    groups.forEach(group => {
      // Category Group Header Row spanning all columns
      tableRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              columnSpan: cols.length,
              borders: cellBorders,
              shading: { fill: 'E5E7EB', type: ShadingType.CLEAR },
              children: [
                new Paragraph({
                  spacing: { before: 50, after: 50 },
                  children: [
                    new TextRun({
                      text: `CATEGORY: ${group.category.toUpperCase()} (${group.items.length} items)`,
                      bold: true,
                      size: 16,
                      font: 'Arial',
                      color: '000000'
                    })
                  ]
                })
              ]
            })
          ]
        })
      );

      group.items.forEach(item => {
        tableRows.push(createItemRow(item, rowCounter++));
      });
    });
  } else {
    items.forEach(item => {
      tableRows.push(createItemRow(item, rowCounter++));
    });
  }

  bodyParagraphs.push(
    new Table({
      width: { size: 15704, type: WidthType.DXA },
      rows: tableRows
    })
  );

  // Totals Line
  const totalsText = showSystemQty
    ? `Total items: ${totalItems}     |     Total units (System Qty): ${totalSystemQty}`
    : `Total items: ${totalItems}`;

  bodyParagraphs.push(
    new Paragraph({
      spacing: { before: 120, after: 140 },
      children: [
        new TextRun({ text: totalsText, bold: true, size: 17, font: 'Arial' })
      ]
    })
  );

  // Signature Block (3 verifiers + Unit Head)
  if (options.includeSignatureBlock) {
    bodyParagraphs.push(
      new Table({
        width: { size: 15704, type: WidthType.DXA },
        spacing: { before: 140, after: 120 },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 5234, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Verifier 1 Signature:\n__________________________\n', size: 16 }),
                      new TextRun({ text: 'Date: ____________________', size: 15 })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 5234, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Verifier 2 Signature:\n__________________________\n', size: 16 }),
                      new TextRun({ text: 'Date: ____________________', size: 15 })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 5236, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Verifier 3 Signature:\n__________________________\n', size: 16 }),
                      new TextRun({ text: 'Date: ____________________', size: 15 })
                    ]
                  })
                ]
              })
            ]
          }),
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                columnSpan: 3,
                width: { size: 15704, type: WidthType.DXA },
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                children: [
                  new Paragraph({
                    spacing: { before: 120, after: 60 },
                    children: [
                      new TextRun({ text: 'Verified by Unit Head: ____________________________________     ', size: 16, bold: true }),
                      new TextRun({ text: 'Date: ____________________', size: 15 })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  }

  // Footer: Running page number and report note
  const footerChildren = [
    new Table({
      width: { size: 15704, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 11000, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `EDL IMS - Annual Verification Count Sheet - ${unitName} - ${dateFormatted || formatDate(new Date())}`,
                      size: 14,
                      color: '555555'
                    })
                  ]
                })
              ]
            }),
            new TableCell({
              width: { size: 4704, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'Page ', size: 14, color: '555555' }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '555555' }),
                    new TextRun({ text: ' of ', size: 14, color: '555555' }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '555555' })
                  ]
                })
              ]
            })
          ]
        })
      ]
    })
  ];

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838, // A4 landscape width (297 mm)
              height: 11906 // A4 landscape height (210 mm)
            },
            margin: {
              top: 567, // 10mm margins = ~567 twips
              bottom: 567,
              left: 567,
              right: 567
            }
          }
        },
        headers: {
          default: new Header({ children: headerChildren })
        },
        footers: {
          default: new Footer({ children: footerChildren })
        },
        children: bodyParagraphs
      }
    ]
  });

  return doc;
}

/**
 * Generates and triggers download of the count sheet Word (.docx) file.
 */
export async function downloadCountSheetDocx(countSheetData, metadata = {}) {
  const doc = await generateCountSheetDocx(countSheetData, metadata);
  const blob = await Packer.toBlob(doc);

  const cleanUnit = (metadata.unitName || 'UNIT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `EDL_Verification_Count_Sheet_${cleanUnit}_${dateStamp}.docx`;

  if (typeof window !== 'undefined' && window.document) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  return { blob, filename };
}
