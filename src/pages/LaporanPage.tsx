import React, { useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { LaporanService, type LaporanDosenRow } from '../services/laporanService';
import { exportLaporanExcel } from '../utils/exportLaporan';
import { getDynamicYearOptions, formatRupiah } from '../data/mockData';
import {
  COLOR_PRIMARY,
  CHART_COLOR_CAPEX,
  COLOR_TEXT_SECONDARY,
  COLOR_BORDER,
} from '../lib/designTokens';

const FAKULTAS_OPTIONS = [
  'SEMUA', 'FRI', 'FTE', 'FIT', 'FKS', 'FKB', 'FIF', 'FEB', 'FIK', 'TUP', 'TUS', 'TUJ',
];

type Jenis = 'SEMUA' | 'OPEX' | 'CAPEX';

function SummaryCard({
  label,
  value,
  sub,
  isCurrency = true,
}: {
  label: string;
  value: number;
  sub?: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm p-4 flex flex-col gap-0.5">
      <p className="text-xs text-[#667085] font-medium">{label}</p>
      <p className="text-base font-bold text-[#1F2937] leading-snug">
        {isCurrency ? formatRupiah(value) : `${value} Dosen`}
      </p>
      {sub && <p className="text-xs text-[#98A2B3]">{sub}</p>}
    </div>
  );
}

function CustomTooltipChart({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E4E7EC] rounded-[12px] shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-[#1F2937] mb-1">Tahun {label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium text-xs">
          {p.name}: <span className="font-bold">{p.value}</span> Dosen
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Applied filters (snapshot at fetch time, for export label)
  const [appliedFilter, setAppliedFilter] = useState({ fakultas: 'SEMUA', tahunDari: currentYear, tahunSampai: currentYear, jenis: 'SEMUA' as Jenis });

  // Search
  const [search, setSearch] = useState('');

  // Sort tahun
  const [sortTahun, setSortTahun] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    if (tahunDari > tahunSampai) {
      setError('Tahun Dari tidak boleh lebih besar dari Tahun Sampai.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearch('');
    try {
      const dosenRows = await LaporanService.getDosenRows(tahunDari, tahunSampai, jenis, fakultas);
      setRows(dosenRows);
      setAppliedFilter({ fakultas, tahunDari, tahunSampai, jenis });
      setHasFetched(true);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal mengambil data.');
    } finally {
      setIsLoading(false);
    }
  }, [tahunDari, tahunSampai, jenis, fakultas]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = rows.filter(
        (r) =>
          r.nama.toLowerCase().includes(q) ||
          r.nip.includes(q) ||
          r.fakultas.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const tahunCmp = sortTahun === 'asc' ? a.tahun - b.tahun : b.tahun - a.tahun;
      if (tahunCmp !== 0) return tahunCmp;
      return a.nama.localeCompare(b.nama, 'id');
    });
  }, [rows, search, sortTahun]);

  const totalDosenUnik = useMemo(() => new Set(rows.map((r) => r.dosenId)).size, [rows]);

  const summary = useMemo(() => ({
    totalAnggaran: rows.reduce((s, r) => s + r.opexAnggaran + r.capexAnggaran, 0),
    totalOpex: rows.reduce((s, r) => s + r.opexAnggaran, 0),
    totalCapex: rows.reduce((s, r) => s + r.capexAnggaran, 0),
  }), [rows]);

  const totals = useMemo(() => ({
    opexAnggaran: filteredRows.reduce((s, r) => s + r.opexAnggaran, 0),
    capexAnggaran: filteredRows.reduce((s, r) => s + r.capexAnggaran, 0),
  }), [filteredRows]);

  // Chart: jumlah dosen per tahun yang mendapat OPEX/CAPEX
  const chartData = useMemo(() => {
    const byTahun = new Map<number, { tahun: number; opexDosen: number; capexDosen: number }>();

    // Inisialisasi semua tahun dalam rentang agar grafik kontinyu
    const minYear = Math.min(appliedFilter.tahunDari, appliedFilter.tahunSampai);
    const maxYear = Math.max(appliedFilter.tahunDari, appliedFilter.tahunSampai);
    for (let y = minYear; y <= maxYear; y++) {
      byTahun.set(y, { tahun: y, opexDosen: 0, capexDosen: 0 });
    }

    for (const r of rows) {
      if (!byTahun.has(r.tahun)) {
        byTahun.set(r.tahun, { tahun: r.tahun, opexDosen: 0, capexDosen: 0 });
      }
      const entry = byTahun.get(r.tahun)!;
      if (r.opexAnggaran > 0) entry.opexDosen++;
      if (r.capexAnggaran > 0) entry.capexDosen++;
    }

    return Array.from(byTahun.values()).sort((a, b) => a.tahun - b.tahun);
  }, [rows, appliedFilter.tahunDari, appliedFilter.tahunSampai]);

  const handleExportExcel = async () => {
    try {
      await exportLaporanExcel(
        rows,
        appliedFilter.jenis,
        appliedFilter.fakultas,
        appliedFilter.tahunDari,
        appliedFilter.tahunSampai
      );
    } catch (e: any) {
      alert('Gagal export Excel: ' + (e?.message ?? e));
    }
  };

  const handleExportPdf = () => {
    const originalTitle = document.title;
    document.title = 'Laporan Anggaran'; // Hilangkan nama aplikasi di header cetak PDF
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

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
      <div className="hidden print:block mb-4 pb-3 border-b-2 border-[#8F2438]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#1F2937] tracking-tight">
              LAPORAN ALOKASI ANGGARAN DOSEN
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Fakultas: <span className="font-semibold text-[#1F2937]">{fkLabel}</span> &nbsp;|&nbsp;
              Periode: <span className="font-semibold text-[#1F2937]">{tahunLabel}</span> &nbsp;|&nbsp;
              Jenis: <span className="font-semibold text-[#1F2937]">{appliedFilter.jenis}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#98A2B3]">Tanggal Cetak:</p>
            <p className="text-xs font-medium text-[#1F2937]">
              {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {/* Page Header */}
        <div className="mb-4 print:hidden">
          <h1 className="text-xl font-bold text-[#1F2937]">Laporan Anggaran</h1>
          <p className="text-xs text-[#667085] mt-0.5">
            Filter, lihat, dan ekspor data anggaran dosen per fakultas dan rentang tahun.
          </p>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm p-4 mb-4 print:hidden">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Fakultas */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-medium text-[#667085]">Fakultas</label>
              <select
                value={fakultas}
                onChange={(e) => setFakultas(e.target.value)}
                className="border border-[#E4E7EC] rounded-[8px] px-2.5 py-1.5 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {FAKULTAS_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f === 'SEMUA' ? 'Semua Fakultas' : f}</option>
                ))}
              </select>
            </div>

            {/* Tahun Dari */}
            <div className="flex flex-col gap-1 min-w-[100px]">
              <label className="text-xs font-medium text-[#667085]">Tahun Dari</label>
              <select
                value={tahunDari}
                onChange={(e) => setTahunDari(Number(e.target.value))}
                className="border border-[#E4E7EC] rounded-[8px] px-2.5 py-1.5 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            {/* Tahun Sampai */}
            <div className="flex flex-col gap-1 min-w-[100px]">
              <label className="text-xs font-medium text-[#667085]">Tahun Sampai</label>
              <select
                value={tahunSampai}
                onChange={(e) => setTahunSampai(Number(e.target.value))}
                className="border border-[#E4E7EC] rounded-[8px] px-2.5 py-1.5 text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
              >
                {yearOptions.map((y) => (
                  <option key={y.value} value={y.value}>{y.label}</option>
                ))}
              </select>
            </div>

            {/* Jenis */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#667085]">Jenis</label>
              <div className="flex gap-1">
                {(['SEMUA', 'OPEX', 'CAPEX'] as Jenis[]).map((j) => (
                  <button
                    key={j}
                    onClick={() => setJenis(j)}
                    className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors cursor-pointer ${
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
              className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] bg-[#8F2438] text-white text-sm font-semibold hover:bg-[#761D2E] transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                </svg>
              )}
              Tampilkan
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-[#B42318] bg-[#FDECEC] rounded-[8px] px-3 py-2">{error}</p>
          )}
        </div>

        {/* Empty / Loading / Results */}
        {!hasFetched && !isLoading && (
          <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm p-12 flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-[#D9DDE3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
            </svg>
            <p className="text-sm text-[#667085]">Pilih filter dan klik <strong>Tampilkan</strong> untuk memuat laporan.</p>
          </div>
        )}

        {isLoading && (
          <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm p-12 flex flex-col items-center gap-2">
            <svg className="w-8 h-8 animate-spin text-[#8F2438]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-[#667085]">Memuat data laporan...</p>
          </div>
        )}

        {hasFetched && !isLoading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <SummaryCard
                label="Total Dosen Penerima"
                value={totalDosenUnik}
                isCurrency={false}
                sub={`${rows.length} alokasi anggaran`}
              />
              <SummaryCard label="Total Anggaran" value={summary.totalAnggaran} />
              <SummaryCard label="Total OPEX" value={summary.totalOpex} />
              <SummaryCard label="Total CAPEX" value={summary.totalCapex} />
            </div>

            {/* Chart: Tren Jumlah Dosen Penerima per Tahun (Grafik Garis Area dengan Gradasi) */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm p-4 mb-4 print:mb-3">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold text-[#1F2937]">
                    Tren Jumlah Dosen Penerima Anggaran — {fkLabel}
                  </h2>
                  <p className="text-xs text-[#98A2B3] mt-0.5">
                    Pergerakan jumlah dosen penerima OPEX dan CAPEX per tahun ({tahunLabel})
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradOpex" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR_PRIMARY} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={COLOR_PRIMARY} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="gradCapex" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLOR_CAPEX} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLOR_CAPEX} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLOR_BORDER} />
                    <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: COLOR_TEXT_SECONDARY }}
                      width={36}
                    />
                    <Tooltip content={<CustomTooltipChart />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    {appliedFilter.jenis !== 'CAPEX' && (
                      <Area
                        type="monotone"
                        dataKey="opexDosen"
                        name="Dosen OPEX"
                        stroke={COLOR_PRIMARY}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#gradOpex)"
                        dot={{ r: 4, fill: COLOR_PRIMARY, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {appliedFilter.jenis !== 'OPEX' && (
                      <Area
                        type="monotone"
                        dataKey="capexDosen"
                        name="Dosen CAPEX"
                        stroke={CHART_COLOR_CAPEX}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#gradCapex)"
                        dot={{ r: 4, fill: CHART_COLOR_CAPEX, strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table actions */}
            <div className="flex flex-wrap items-center gap-2 mb-2 print:hidden">
              <div className="flex-1 min-w-[180px]">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari nama, NIP, atau fakultas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-[#E4E7EC] rounded-[8px] text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#8F2438]/20 focus:border-[#8F2438]"
                  />
                </div>
              </div>
              <span className="text-xs text-[#98A2B3]">
                {filteredRows.length} baris
              </span>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#E4E7EC] bg-white text-xs font-medium text-[#1F2937] hover:bg-[#F7F7F8] transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#16805B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#E4E7EC] bg-white text-xs font-medium text-[#1F2937] hover:bg-[#F7F7F8] transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#8F2438]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                </svg>
                Export PDF
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[16px] border border-[#E4E7EC] shadow-sm overflow-hidden">
              {filteredRows.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-2">
                  <svg className="w-9 h-9 text-[#D9DDE3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                  </svg>
                  <p className="text-sm text-[#667085]">Tidak ada data ditemukan untuk filter ini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#8F2438] text-white">
                        <th className="px-3 py-2.5 text-left font-semibold w-8">No</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Nama Dosen</th>
                        <th className="px-3 py-2.5 text-left font-semibold">NIP</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Fak.</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Program Studi</th>
                        <th className="px-3 py-2.5 text-center font-semibold">
                          <button
                            onClick={() => setSortTahun(s => s === 'asc' ? 'desc' : 'asc')}
                            className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            Tahun
                            <span className="text-white/70 text-[10px]">
                              {sortTahun === 'asc' ? '↑' : '↓'}
                            </span>
                          </button>
                        </th>
                        {showOpexCol && <th className="px-3 py-2.5 text-right font-semibold">OPEX Anggaran</th>}
                        {showCapexCol && <th className="px-3 py-2.5 text-right font-semibold">CAPEX Anggaran</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r, idx) => (
                        <tr
                          key={`${r.dosenId}-${r.tahun}`}
                          className={`border-t border-[#EAECF0] ${idx % 2 === 1 ? 'bg-[#F9FAFB]' : 'bg-white'} hover:bg-[#F8E9ED]/40 transition-colors`}
                        >
                          <td className="px-3 py-2 text-[#98A2B3] text-center">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-[#1F2937]">{r.nama}</td>
                          <td className="px-3 py-2 text-[#667085] font-mono">{r.nip}</td>
                          <td className="px-3 py-2">
                            <span className="inline-block px-1.5 py-0.5 rounded-[5px] text-xs font-semibold bg-[#F8E9ED] text-[#8F2438]">
                              {r.fakultas}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#667085]">{r.programStudi}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-[5px] text-xs font-semibold bg-[#E8F5EF] text-[#16805B]">
                              {r.tahun}
                            </span>
                          </td>
                          {showOpexCol && <td className="px-3 py-2 text-right text-[#1F2937]">{formatRupiah(r.opexAnggaran)}</td>}
                          {showCapexCol && <td className="px-3 py-2 text-right text-[#1F2937]">{formatRupiah(r.capexAnggaran)}</td>}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F8E9ED] border-t-2 border-[#8F2438]">
                        <td className="px-3 py-2.5" colSpan={6}>
                          <span className="font-bold text-[#8F2438] text-xs">TOTAL ({filteredRows.length} baris)</span>
                        </td>
                        {showOpexCol && (
                          <td className="px-3 py-2.5 text-right font-bold text-[#1F2937]">{formatRupiah(totals.opexAnggaran)}</td>
                        )}
                        {showCapexCol && (
                          <td className="px-3 py-2.5 text-right font-bold text-[#1F2937]">{formatRupiah(totals.capexAnggaran)}</td>
                        )}
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
          @page {
            margin: 0.8cm 1cm;
            size: A4 landscape;
          }
          header, nav, footer, .print\\:hidden, [class*="fixed"], [class*="z-50"] {
            display: none !important;
          }
          body {
            background: white !important;
            color: #1F2937 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bg-white {
            box-shadow: none !important;
          }
          /* Summary cards grid in print */
          .grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
          }
          /* Table print styling */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
            page-break-inside: auto;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          th, td {
            padding: 4px 6px !important;
            border-bottom: 1px solid #EAECF0 !important;
          }
          th {
            background-color: #8F2438 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
          }
          tfoot tr {
            background-color: #F8E9ED !important;
            -webkit-print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}
