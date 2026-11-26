import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageOrientation,
  Header,
  Footer
} from 'docx';

const MAROON_COLOR = '7B1C3E';
const GOLD_COLOR = 'F4B731';
const BORDER_COLOR = 'D1D5DB';

/**
 * Generates an editable Microsoft Word (.docx) document listing all appointed verification teams.
 * Only includes locations that have an appointed team, grouped by parent hierarchy node.
 */
export async function generateVerificationTeamsDocx(teams = [], groupedData = {}, year = new Date().getFullYear()) {
  const tableRows = [];

  // Table Header Row
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 600, type: WidthType.DXA },
          shading: { fill: MAROON_COLOR },
          children: [new Paragraph({ children: [new TextRun({ text: 'NO.', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 3200, type: WidthType.DXA },
          shading: { fill: MAROON_COLOR },
          children: [new Paragraph({ children: [new TextRun({ text: 'LOCATION / UNIT', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          shading: { fill: MAROON_COLOR },
          children: [new Paragraph({ children: [new TextRun({ text: 'VERIFIER 1 (NAME & DESIGNATION)', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          shading: { fill: MAROON_COLOR },
          children: [new Paragraph({ children: [new TextRun({ text: 'VERIFIER 2 (NAME & DESIGNATION)', bold: true, color: 'FFFFFF', size: 18 })] })]
        }),
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          shading: { fill: MAROON_COLOR },
          children: [new Paragraph({ children: [new TextRun({ text: 'VERIFIER 3 (NAME & DESIGNATION)', bold: true, color: 'FFFFFF', size: 18 })] })]
        })
      ]
    })
  );

  let seqNo = 1;

  // Process groups in alphabetical order, putting WPS-II (direct) first or last cleanly
  const groupNames = Object.keys(groupedData).sort((a, b) => {
    if (a.includes('direct')) return -1;
    if (b.includes('direct')) return 1;
    return a.localeCompare(b);
  });

  groupNames.forEach(groupName => {
    const locsInGroup = groupedData[groupName] || [];
    // Filter to only locations that have an appointed team
    const appointedInGroup = locsInGroup.filter(loc => loc.team && Array.isArray(loc.team.members) && loc.team.members.length === 3);
    if (appointedInGroup.length === 0) return;

    // Category / Area Group Heading Row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            shading: { fill: 'F3F4F6' },
            children: [
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: `HIERARCHY GROUP: ${groupName.toUpperCase()} (${appointedInGroup.length} appointed)`,
                    bold: true,
                    color: MAROON_COLOR,
                    size: 19
                  })
                ]
              })
            ]
          })
        ]
      })
    );

    appointedInGroup.forEach(loc => {
      const m1 = loc.team.members[0] || { name: '—', designation: '—' };
      const m2 = loc.team.members[1] || { name: '—', designation: '—' };
      const m3 = loc.team.members[2] || { name: '—', designation: '—' };

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 600, type: WidthType.DXA },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(seqNo++), size: 18 })] })]
            }),
            new TableCell({
              width: { size: 3200, type: WidthType.DXA },
              children: [
                new Paragraph({ children: [new TextRun({ text: loc.unit_name || loc.name, bold: true, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: loc.pathString || loc.unit_code || '', size: 15, color: '6B7280' })] })
              ]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              children: [
                new Paragraph({ children: [new TextRun({ text: m1.name, bold: true, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: m1.designation, size: 16, color: '4B5563' })] })
              ]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              children: [
                new Paragraph({ children: [new TextRun({ text: m2.name, bold: true, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: m2.designation, size: 16, color: '4B5563' })] })
              ]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              children: [
                new Paragraph({ children: [new TextRun({ text: m3.name, bold: true, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: m3.designation, size: 16, color: '4B5563' })] })
              ]
            })
          ]
        })
      );
    });
  });

  // If no teams appointed at all
  if (seqNo === 1) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No verification teams appointed yet for this year.', italic: true, size: 18 })] })]
          })
        ]
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'ELECTRICITY DISTRIBUTION LANKA (PVT) LTD', bold: true, size: 28, color: MAROON_COLOR })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: `WESTERN PROVINCE SOUTH II — ANNUAL VERIFICATION TEAMS APPOINTMENT SCHEDULE (${year})`, bold: true, size: 22 })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: `Appointed Board of Survey Teams as of: ${new Date().toLocaleDateString('en-GB')}`, italic: true, size: 18, color: '6B7280' })
            ]
          }),
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          }),
          new Paragraph({
            spacing: { before: 400 },
            children: [
              new TextRun({ text: 'Certified and Approved by: ____________________________________    Date: ____________________', size: 18, color: '374151' })
            ]
          }),
          new Paragraph({
            spacing: { before: 80 },
            children: [
              new TextRun({ text: 'Chief Engineer (Commercial) / Regional DGM — Western Province South II', bold: true, size: 18, color: MAROON_COLOR })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

/**
 * Triggers browser download of the generated .docx file.
 */
export async function downloadVerificationTeamsDocx(teams, groupedData, year) {
  const blob = await generateVerificationTeamsDocx(teams, groupedData, year);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EDL_Verification_Teams_${year}_Appointment_Schedule.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
