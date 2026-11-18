import type { LaporanDosenRow, LaporanTrenRow } from '../services/laporanService';

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
  trenRows: LaporanTrenRow[],
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

  // Title rows
  ws1.mergeCells('A1:J1');
  ws1.getCell('A1').value = `LAPORAN ANGGARAN DOSEN — ${fkLabel.toUpperCase()} (${tahunLabel})`;
  ws1.getCell('A1').font = { bold: true, size: 12, color: { argb: MAROON } };
  ws1.getCell('A1').alignment = { horizontal: 'center' };

  ws1.mergeCells('A2:J2');
  ws1.getCell('A2').value = `Jenis: ${jenis}  |  Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  ws1.getCell('A2').alignment = { horizontal: 'center' };
  ws1.getCell('A2').font = { size: 9, color: { argb: 'FF667085' } };
  ws1.getRow(3).height = 6;

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
  cols.push({ header: 'Total Anggaran', key: 'totalAnggaran', width: 18 });
  cols.push({ header: 'Total Realisasi', key: 'totalRealisasi', width: 18 });
  cols.push({ header: 'Serapan (%)', key: 'serapan', width: 13 });

  ws1.columns = cols;

  // Header row (row 4)
  const headerRow = ws1.getRow(4);
  headerRow.height = 32;
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    Object.assign(cell, headerStyle());
    Object.assign(cell.style, headerStyle());
  });

  const rpKeys = new Set(['opexAnggaran', 'capexAnggaran', 'totalAnggaran', 'totalRealisasi']);

  rows.forEach((r, idx) => {
    const serapan =
      r.totalAnggaran > 0 ? +(((r.totalRealisasi / r.totalAnggaran) * 100).toFixed(1)) : 0;

    const rowData: Record<string, any> = {
      no: idx + 1,
      nama: r.nama,
      nip: r.nip,
      fakultas: r.fakultas,
      programStudi: r.programStudi,
      tahun: r.tahun,
      opexAnggaran: r.opexAnggaran,
      capexAnggaran: r.capexAnggaran,
      totalAnggaran: r.totalAnggaran,
      totalRealisasi: r.totalRealisasi,
      serapan: serapan / 100,
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
      if (c.key === 'serapan') {
        cell.numFmt = '0.0%';
        cell.alignment = { horizontal: 'center' };
      }
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
    totalAnggaran: rows.reduce((s, r) => s + r.totalAnggaran, 0),
    totalRealisasi: rows.reduce((s, r) => s + r.totalRealisasi, 0),
    serapan: '',
  };

  const totalRow = ws1.addRow(cols.map((c) => totals[c.key]));
  totalRow.height = 20;
  cols.forEach((c, ci) => {
    const cell = totalRow.getCell(ci + 1);
    if (rpKeys.has(c.key)) Object.assign(cell.style, totalStyle(true));
    else Object.assign(cell.style, totalStyle());
  });

  // ---- Sheet 2: Tren per Tahun ----
  const ws2 = wb.addWorksheet('Tren per Tahun');

  ws2.mergeCells('A1:G1');
  ws2.getCell('A1').value = `TREN ANGGARAN PER TAHUN — ${fkLabel.toUpperCase()} (${tahunLabel})`;
  ws2.getCell('A1').font = { bold: true, size: 12, color: { argb: MAROON } };
  ws2.getCell('A1').alignment = { horizontal: 'center' };
  ws2.getRow(2).height = 6;

  const cols2 = [
    { header: 'Tahun', key: 'tahun', width: 8 },
    { header: 'OPEX Anggaran', key: 'opexAnggaran', width: 18 },
    { header: 'OPEX Realisasi', key: 'opexRealisasi', width: 18 },
    { header: 'CAPEX Anggaran', key: 'capexAnggaran', width: 18 },
    { header: 'CAPEX Realisasi', key: 'capexRealisasi', width: 18 },
    { header: 'Total Anggaran', key: 'totalAnggaran', width: 18 },
    { header: 'Total Realisasi', key: 'totalRealisasi', width: 18 },
  ];

  ws2.columns = cols2;

  const hdr2 = ws2.getRow(3);
  hdr2.height = 28;
  cols2.forEach((c, i) => {
    const cell = hdr2.getCell(i + 1);
    cell.value = c.header;
    Object.assign(cell.style, headerStyle());
  });

  trenRows.forEach((t, idx) => {
    const exRow = ws2.addRow([
      t.tahun,
      t.opexAnggaran,
      t.opexRealisasi,
      t.capexAnggaran,
      t.capexRealisasi,
      t.totalAnggaran,
      t.totalRealisasi,
    ]);
    exRow.height = 18;

    if (idx % 2 === 1) {
      exRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
      });
    }

    cols2.forEach((c, ci) => {
      const cell = exRow.getCell(ci + 1);
      if (c.key !== 'tahun') Object.assign(cell.style, rpStyle());
      else cell.alignment = { horizontal: 'center' };
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
