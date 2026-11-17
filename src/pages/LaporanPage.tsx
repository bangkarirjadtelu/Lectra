import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { LaporanService, type LaporanDosenRow, type LaporanTrenRow } from '../services/laporanService';
import { exportLaporanExcel } from '../utils/exportLaporan';
import { getDynamicYearOptions, formatRupiah } from '../data/mockData';
import {
  COLOR_PRIMARY,
  CHART_COLOR_CAPEX,
  COLOR_TEXT_SECONDARY,
  COLOR_BORDER,
  COLOR_BG,
  COLOR_SUCCESS,
  COLOR_SUCCESS_SOFT,
  COLOR_WARNING,
  COLOR_WARNING_SOFT,
  COLOR_DANGER,
  COLOR_DANGER_SOFT,
  COLOR_PRIMARY_SOFT,
} from '../lib/designTokens';

const FAKULTAS_OPTIONS = [
  'SEMUA', 'FRI', 'FTE', 'FIT', 'FKS', 'FKB', 'FIF', 'FEB', 'FIK', 'TUP', 'TUS', 'TUJ',
];

type Jenis = 'SEMUA' | 'OPEX' | 'CAPEX';

function SerapanBadge({ persen }: { persen: number }) {
  let bg = COLOR_SUCCESS_SOFT, color = COLOR_SUCCESS;
  if (persen > 100) { bg = COLOR_DANGER_SOFT; color = COLOR_DANGER; }
  else if (persen >= 80) { bg = COLOR_WARNING_SOFT; color = COLOR_WARNING; }
  return (
    <span
      style={{ background: bg, color, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}
    >
      {persen.toFixed(1)}%
    </span>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm p-5 flex flex-col gap-1">
      <p className="text-sm text-[#667085] font-medium">{label}</p>
      <p className="text-xl font-bold text-[#1F2937] leading-tight">{formatRupiah(value)}</p>
      {sub && <p className="text-xs text-[#98A2B3]">{sub}</p>}
    </div>
  );
}

function CustomTooltipChart({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E4E7EC] rounded-[12px] shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-[#1F2937] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatRupiah(p.value)}
        </p>
      ))}
    </div>
  );
}

export function LaporanPage() {
  const yearOptions = useMemo(() => getDynamicYearOptions(), []);
  const currentYear = new Date().getFullYear();

  // Filters (before fetch)
  const [fakultas, setFakultas] = useState('SEMUA');
  const [tahunDari, setTahunDari] = useState(currentYear);
  const [tahunSampai, setTahunSampai] = useState(currentYear);
  const [jenis, setJenis] = useState<Jenis>('SEMUA');

  // Data state
  const [rows, setRows] = useState<LaporanDosenRow[]>([]);
  const [trenRows, setTrenRows] = useState<LaporanTrenRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applied filters (snapshot at fetch time, for export label)
  const [appliedFilter, setAppliedFilter] = useState({ fakultas: 'SEMUA', tahunDari: currentYear, tahunSampai: currentYear, jenis: 'SEMUA' as Jenis });

  // Search
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (tahunDari > tahunSampai) {
      setError('Tahun Dari tidak boleh lebih besar dari Tahun Sampai.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearch('');
    try {
      const [dosenRows, tren] = await Promise.all([
        LaporanService.getDosenRows(tahunDari, tahunSampai, jenis, fakultas),
        LaporanService.getTrenData(tahunDari, tahunSampai, fakultas),
      ]);
      setRows(dosenRows);
      setTrenRows(tren);
      setAppliedFilter({ fakultas, tahunDari, tahunSampai, jenis });
      setHasFetched(true);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengambil data.');
    } finally {
      setIsLoading(false);
    }
  }, [tahunDari, tahunSampai, jenis, fakultas]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.nip.includes(q) ||
        r.fakultas.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const summary = useMemo(() => ({
    totalAnggaran: rows.reduce((s, r) => s + r.totalAnggaran, 0),
    totalRealisasi: rows.reduce((s, r) => s + r.totalRealisasi, 0),
    totalOpex: rows.reduce((s, r) => s + r.opexAnggaran, 0),
    totalCapex: rows.reduce((s, r) => s + r.capexAnggaran, 0),
  }), [rows]);

  const totals = useMemo(() => ({
    opexAnggaran: filteredRows.reduce((s, r) => s + r.opexAnggaran, 0),
    capexAnggaran: filteredRows.reduce((s, r) => s + r.capexAnggaran, 0),
    totalAnggaran: filteredRows.reduce((s, r) => s + r.totalAnggaran, 0),
    totalRealisasi: filteredRows.reduce((s, r) => s + r.totalRealisasi, 0),
  }), [filteredRows]);

  const handleExportExcel = async () => {
    try {
      await exportLaporanExcel(
        rows, trenRows, appliedFilter.jenis, appliedFilter.fakultas,
        appliedFilter.tahunDari, appliedFilter.tahunSampai
      );
    } catch (e: any) {
      alert('Gagal export Excel: ' + (e?.message ?? e));
    }
  };

  const handleExportPdf = () => window.print();

  const fkLabel = appliedFilter.fakultas === 'SEMUA' ? 'Semua Fakultas' : appliedFilter.fakultas;
  const tahunLabel =
    appliedFilter.tahunDari === appliedFilter.tahunSampai
      ? String(appliedFilter.tahunDari)
      : `${appliedFilter.tahunDari}–${appliedFilter.tahunSampai}`;

  const showOpexCol = appliedFilter.jenis !== 'CAPEX';
  const showCapexCol = appliedFilter.jenis !== 'OPEX';

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold text-[#1F2937]">Laporan Anggaran Dosen</h1>
        <p className="text-sm text-[#667085]">
          Fakultas: {fkLabel} &nbsp;|&nbsp; Tahun: {tahunLabel} &nbsp;|&nbsp; Jenis: {appliedFilter.jenis}
        </p>
        <p className="text-xs text-[#98A2B3]">
          Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <hr className="my-3 border-[#E4E7EC]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-bold text-[#1F2937]">Laporan Anggaran</h1>
          <p className="text-sm text-[#667085] mt-1">
            Lihat, filter, dan ekspor data anggaran dosen per fakultas dan rentang tahun.
          </p>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm p-5 mb-6 print:hidden">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Fakultas */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-[#667085]">Fakultas</label>
              <select
                value={fakultas}
                onChange={(e) => setFakultas(e.target.value)}
                className="border border-[#E4E7EC] rounded-[10px] px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {FAKULTAS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f === 'SEMUA' ? 'Semua Fakultas' : f}</option>
                ))}
              </select>
            </div>

            {/* Tahun Dari */}
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-xs font-medium text-[#667085]">Tahun Dari</label>
              <select
                value={tahunDari}
                onChange={(e) => setTahunDari(Number(e.target.value))}
                className="border border-[#E4E7EC] rounded-[10px] px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            {/* Tahun Sampai */}
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-xs font-medium text-[#667085]">Tahun Sampai</label>
              <select
                value={tahunSampai}
                onChange={(e) => setTahunSampai(Number(e.target.value))}
                className="border border-[#E4E7EC] rounded-[10px] px-3 py-2 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            {/* Jenis */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#667085]">Jenis Anggaran</label>
              <div className="flex gap-1">
                {(['SEMUA', 'OPEX', 'CAPEX'] as Jenis[]).map((j) => (
                  <button
                    key={j}
                    onClick={() => setJenis(j)}
                    className={`px-3.5 py-2 rounded-[10px] text-sm font-medium border transition-colors cursor-pointer ${
                      jenis === j
                        ? 'bg-[#8F2438] text-white border-[#8F2438]'
                        : 'bg-white text-[#667085] border-[#E4E7EC] hover:border-[#8F2438] hover:text-[#8F2438]'
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="ml-auto flex items-center gap-2 px-5 py-2 rounded-[10px] bg-[#8F2438] text-white text-sm font-semibold hover:bg-[#761D2E] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                </svg>
              )}
              Tampilkan
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-[#B42318] bg-[#FDECEC] rounded-[8px] px-3 py-2">{error}</p>
          )}
        </div>

        {/* Empty / Loading / Results */}
        {!hasFetched && !isLoading && (
          <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm p-16 flex flex-col items-center gap-3">
            <svg className="w-12 h-12 text-[#D9DDE3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
            </svg>
            <p className="text-[#667085] font-medium">Pilih filter dan klik <strong>Tampilkan</strong> untuk memuat laporan.</p>
          </div>
        )}

        {isLoading && (
          <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm p-16 flex flex-col items-center gap-3">
            <svg className="w-10 h-10 animate-spin text-[#8F2438]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-[#667085]">Memuat data laporan...</p>
          </div>
        )}

        {hasFetched && !isLoading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard label="Total Anggaran" value={summary.totalAnggaran} />
              <SummaryCard label="Total Realisasi" value={summary.totalRealisasi}
                sub={summary.totalAnggaran > 0 ? `Serapan ${((summary.totalRealisasi / summary.totalAnggaran) * 100).toFixed(1)}%` : undefined}
              />
              <SummaryCard label="Total OPEX" value={summary.totalOpex} />
              <SummaryCard label="Total CAPEX" value={summary.totalCapex} />
            </div>

            {/* Chart */}
            {trenRows.length > 0 && (
              <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm p-5 mb-6 print:mb-4">
                <h2 className="text-base font-semibold text-[#1F2937] mb-1">
                  Tren Realisasi per Tahun — {fkLabel}
                </h2>
                <p className="text-xs text-[#98A2B3] mb-4">OPEX & CAPEX Realisasi ({tahunLabel})</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trenRows} margin={{ top: 5, right: 24, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLOR_BORDER} />
                    <XAxis dataKey="tahun" tick={{ fontSize: 12, fill: COLOR_TEXT_SECONDARY }} />
                    <YAxis
                      tickFormatter={(v) => `Rp ${(v / 1_000_000).toFixed(0)}jt`}
                      tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }}
                      width={80}
                    />
                    <Tooltip content={<CustomTooltipChart />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    {appliedFilter.jenis !== 'CAPEX' && (
                      <Line
                        type="monotone"
                        dataKey="opexRealisasi"
                        name="OPEX Realisasi"
                        stroke={COLOR_PRIMARY}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: COLOR_PRIMARY }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {appliedFilter.jenis !== 'OPEX' && (
                      <Line
                        type="monotone"
                        dataKey="capexRealisasi"
                        name="CAPEX Realisasi"
                        stroke={CHART_COLOR_CAPEX}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: CHART_COLOR_CAPEX }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table actions */}
            <div className="flex flex-wrap items-center gap-3 mb-3 print:hidden">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari nama, NIP, atau fakultas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[#E4E7EC] rounded-[10px] text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
                  />
                </div>
              </div>
              <span className="text-sm text-[#98A2B3]">
                {filteredRows.length} dosen ditemukan
              </span>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E4E7EC] bg-white text-sm font-medium text-[#1F2937] hover:bg-[#F7F7F8] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-[#16805B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E4E7EC] bg-white text-sm font-medium text-[#1F2937] hover:bg-[#F7F7F8] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-[#8F2438]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                Export PDF
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[20px] border border-[#E4E7EC] shadow-sm overflow-hidden">
              {filteredRows.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-3">
                  <svg className="w-10 h-10 text-[#D9DDE3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                  </svg>
                  <p className="text-[#667085]">Tidak ada data ditemukan untuk filter ini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#8F2438] text-white">
                        <th className="px-4 py-3 text-left font-semibold w-10">No</th>
                        <th className="px-4 py-3 text-left font-semibold">Nama Dosen</th>
                        <th className="px-4 py-3 text-left font-semibold">NIP</th>
                        <th className="px-4 py-3 text-left font-semibold">Fak.</th>
                        <th className="px-4 py-3 text-left font-semibold">Program Studi</th>
                        {showOpexCol && <th className="px-4 py-3 text-right font-semibold">OPEX Anggaran</th>}
                        {showCapexCol && <th className="px-4 py-3 text-right font-semibold">CAPEX Anggaran</th>}
                        <th className="px-4 py-3 text-right font-semibold">Total Anggaran</th>
                        <th className="px-4 py-3 text-right font-semibold">Total Realisasi</th>
                        <th className="px-4 py-3 text-center font-semibold">Serapan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r, idx) => {
                        const serapan = r.totalAnggaran > 0 ? (r.totalRealisasi / r.totalAnggaran) * 100 : 0;
                        return (
                          <tr
                            key={r.dosenId}
                            className={`border-t border-[#EAECF0] ${idx % 2 === 1 ? 'bg-[#F9FAFB]' : 'bg-white'} hover:bg-[#F8E9ED]/40 transition-colors`}
                          >
                            <td className="px-4 py-3 text-[#98A2B3] text-center">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-[#1F2937]">{r.nama}</td>
                            <td className="px-4 py-3 text-[#667085] font-mono text-xs">{r.nip}</td>
                            <td className="px-4 py-3">
                              <span className="inline-block px-2 py-0.5 rounded-[6px] text-xs font-semibold bg-[#F8E9ED] text-[#8F2438]">
                                {r.fakultas}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#667085]">{r.programStudi}</td>
                            {showOpexCol && <td className="px-4 py-3 text-right text-[#1F2937]">{formatRupiah(r.opexAnggaran)}</td>}
                            {showCapexCol && <td className="px-4 py-3 text-right text-[#1F2937]">{formatRupiah(r.capexAnggaran)}</td>}
                            <td className="px-4 py-3 text-right font-medium text-[#1F2937]">{formatRupiah(r.totalAnggaran)}</td>
                            <td className="px-4 py-3 text-right font-medium text-[#1F2937]">{formatRupiah(r.totalRealisasi)}</td>
                            <td className="px-4 py-3 text-center">
                              <SerapanBadge persen={serapan} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F8E9ED] border-t-2 border-[#8F2438]">
                        <td className="px-4 py-3" colSpan={5}>
                          <span className="font-bold text-[#8F2438] text-sm">TOTAL ({filteredRows.length} dosen)</span>
                        </td>
                        {showOpexCol && (
                          <td className="px-4 py-3 text-right font-bold text-[#1F2937]">{formatRupiah(totals.opexAnggaran)}</td>
                        )}
                        {showCapexCol && (
                          <td className="px-4 py-3 text-right font-bold text-[#1F2937]">{formatRupiah(totals.capexAnggaran)}</td>
                        )}
                        <td className="px-4 py-3 text-right font-bold text-[#1F2937]">{formatRupiah(totals.totalAnggaran)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#1F2937]">{formatRupiah(totals.totalRealisasi)}</td>
                        <td className="px-4 py-3 text-center">
                          <SerapanBadge persen={totals.totalAnggaran > 0 ? (totals.totalRealisasi / totals.totalAnggaran) * 100 : 0} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          header, nav, .print\\:hidden { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4 landscape; }
          table { font-size: 10px !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>
    </>
  );
}
