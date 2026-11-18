import type { LaporanDosenRow } from '../services/laporanService';

const MAROON = 'FF8F2438';
const LIGHT_ROW = 'FFF9FAFB';
const TOTAL_BG = 'FFF8E9ED';
const RP_FORMAT = '_-"Rp"* #,##0_-;\\-"Rp"* #,##0_-;_-"Rp"* "-"_-;_-@_-';

function rpStyle() {
  return { numFmt: RP_FORMAT, alignment: { horizontal: 'right' as const } };
}

function headerStyle() {
  return {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: MAROON } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true },
    border: {
      bottom: { style: 'thin' as const, color: { argb: 'FFE4E7EC' } },
    },
  };
}

function totalStyle(isRp = false) {
  return {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: TOTAL_BG } },
    ...(isRp ? { numFmt: RP_FORMAT, alignment: { horizontal: 'right' as const } } : {}),
  };
}

export async function exportLaporanExcel(
  rows: LaporanDosenRow[],
  jenis: 'SEMUA' | 'OPEX' | 'CAPEX',
  fakultas: string,
  tahunDari: number,
  tahunSampai: number
) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLectra';
  wb.created = new Date();

  const fkLabel = fakultas === 'SEMUA' ? 'Semua Fakultas' : fakultas;
  const tahunLabel =
    tahunDari === tahunSampai ? String(tahunDari) : `${tahunDari}-${tahunSampai}`;

  // ---- Sheet 1: Per Dosen ----
  const ws1 = wb.addWorksheet('Per Dosen');

  // Build columns
  const cols: { header: string; key: string; width: number }[] = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Dosen', key: 'nama', width: 32 },
    { header: 'NIP', key: 'nip', width: 20 },
    { header: 'Fakultas', key: 'fakultas', width: 8 },
    { header: 'Program Studi', key: 'programStudi', width: 28 },
    { header: 'Tahun', key: 'tahun', width: 8 },
  ];
  if (jenis !== 'CAPEX') cols.push({ header: 'OPEX Anggaran', key: 'opexAnggaran', width: 18 });
  if (jenis !== 'OPEX') cols.push({ header: 'CAPEX Anggaran', key: 'capexAnggaran', width: 18 });

  ws1.columns = cols;

  const lastColLetter = String.fromCharCode(65 + cols.length - 1);

  // Title rows
  ws1.mergeCells(`A1:${lastColLetter}1`);
  ws1.getCell('A1').value = `LAPORAN ANGGARAN DOSEN — ${fkLabel.toUpperCase()} (${tahunLabel})`;
  ws1.getCell('A1').font = { bold: true, size: 12, color: { argb: MAROON } };
  ws1.getCell('A1').alignment = { horizontal: 'center' };

  ws1.mergeCells(`A2:${lastColLetter}2`);
  ws1.getCell('A2').value = `Jenis: ${jenis}  |  Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  ws1.getCell('A2').alignment = { horizontal: 'center' };
  ws1.getCell('A2').font = { size: 9, color: { argb: 'FF667085' } };
  ws1.getRow(3).height = 6;

  // Header row (row 4)
  const headerRow = ws1.getRow(4);
  headerRow.height = 30;
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    Object.assign(cell, headerStyle());
    Object.assign(cell.style, headerStyle());
  });

  const rpKeys = new Set(['opexAnggaran', 'capexAnggaran']);

  rows.forEach((r, idx) => {
    const rowData: Record<string, any> = {
      no: idx + 1,
      nama: r.nama,
      nip: r.nip,
      fakultas: r.fakultas,
      programStudi: r.programStudi,
      tahun: r.tahun,
      opexAnggaran: r.opexAnggaran,
      capexAnggaran: r.capexAnggaran,
    };

    const exRow = ws1.addRow(cols.map((c) => rowData[c.key]));
    exRow.height = 18;

    // Alternating fill
    if (idx % 2 === 1) {
      exRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
      });
    }

    // Number formats
    cols.forEach((c, ci) => {
      const cell = exRow.getCell(ci + 1);
      if (rpKeys.has(c.key)) Object.assign(cell.style, rpStyle());
      if (c.key === 'no' || c.key === 'tahun') cell.alignment = { horizontal: 'center' };
    });
  });

  // Totals row
  const totals: Record<string, any> = {
    no: '',
    nama: 'TOTAL',
    nip: '',
    fakultas: '',
    programStudi: '',
    tahun: '',
    opexAnggaran: rows.reduce((s, r) => s + r.opexAnggaran, 0),
    capexAnggaran: rows.reduce((s, r) => s + r.capexAnggaran, 0),
  };

  const totalRow = ws1.addRow(cols.map((c) => totals[c.key]));
  totalRow.height = 20;
  cols.forEach((c, ci) => {
    const cell = totalRow.getCell(ci + 1);
    if (rpKeys.has(c.key)) Object.assign(cell.style, totalStyle(true));
    else Object.assign(cell.style, totalStyle());
  });

  // ---- Sheet 2: Rekap per Tahun ----
  const ws2 = wb.addWorksheet('Rekap per Tahun');

  ws2.mergeCells('A1:G1');
  ws2.getCell('A1').value = `REKAP JUMLAH DOSEN & ANGGARAN PER TAHUN — ${fkLabel.toUpperCase()} (${tahunLabel})`;
  ws2.getCell('A1').font = { bold: true, size: 12, color: { argb: MAROON } };
  ws2.getCell('A1').alignment = { horizontal: 'center' };
  ws2.getRow(2).height = 6;

  const cols2 = [
    { header: 'Tahun', key: 'tahun', width: 10 },
    { header: 'Dosen OPEX', key: 'opexDosen', width: 14 },
    { header: 'Dosen CAPEX', key: 'capexDosen', width: 14 },
    { header: 'Total Dosen', key: 'totalDosen', width: 14 },
    { header: 'Total OPEX (Rp)', key: 'totalOpex', width: 20 },
    { header: 'Total CAPEX (Rp)', key: 'totalCapex', width: 20 },
    { header: 'Total Anggaran (Rp)', key: 'totalAnggaran', width: 22 },
  ];

  ws2.columns = cols2;

  const hdr2 = ws2.getRow(3);
  hdr2.height = 28;
  cols2.forEach((c, i) => {
    const cell = hdr2.getCell(i + 1);
    cell.value = c.header;
    Object.assign(cell.style, headerStyle());
  });

  // Aggregate per year from rows
  const byTahun = new Map<
    number,
    {
      tahun: number;
      opexDosen: Set<string>;
      capexDosen: Set<string>;
      allDosen: Set<string>;
      totalOpex: number;
      totalCapex: number;
    }
  >();

  const minYear = Math.min(tahunDari, tahunSampai);
  const maxYear = Math.max(tahunDari, tahunSampai);
  for (let y = minYear; y <= maxYear; y++) {
    byTahun.set(y, {
      tahun: y,
      opexDosen: new Set(),
      capexDosen: new Set(),
      allDosen: new Set(),
      totalOpex: 0,
      totalCapex: 0,
    });
  }

  for (const r of rows) {
    if (!byTahun.has(r.tahun)) {
      byTahun.set(r.tahun, {
        tahun: r.tahun,
        opexDosen: new Set(),
        capexDosen: new Set(),
        allDosen: new Set(),
        totalOpex: 0,
        totalCapex: 0,
      });
    }
    const entry = byTahun.get(r.tahun)!;
    if (r.opexAnggaran > 0) {
      entry.opexDosen.add(r.dosenId);
      entry.allDosen.add(r.dosenId);
      entry.totalOpex += r.opexAnggaran;
    }
    if (r.capexAnggaran > 0) {
      entry.capexDosen.add(r.dosenId);
      entry.allDosen.add(r.dosenId);
      entry.totalCapex += r.capexAnggaran;
    }
  }

  const sortedYears = Array.from(byTahun.values()).sort((a, b) => a.tahun - b.tahun);

  sortedYears.forEach((t, idx) => {
    const exRow = ws2.addRow([
      t.tahun,
      t.opexDosen.size,
      t.capexDosen.size,
      t.allDosen.size,
      t.totalOpex,
      t.totalCapex,
      t.totalOpex + t.totalCapex,
    ]);
    exRow.height = 18;

    if (idx % 2 === 1) {
      exRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
      });
    }

    cols2.forEach((c, ci) => {
      const cell = exRow.getCell(ci + 1);
      if (['totalOpex', 'totalCapex', 'totalAnggaran'].includes(c.key)) {
        Object.assign(cell.style, rpStyle());
      } else {
        cell.alignment = { horizontal: 'center' };
      }
    });
  });

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan Anggaran ${fkLabel} ${tahunLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
