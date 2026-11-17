import { supabase } from '../lib/supabase';

export interface LaporanDosenRow {
  dosenId: string;
  nama: string;
  nip: string;
  fakultas: string;
  programStudi: string;
  opexAnggaran: number;
  capexAnggaran: number;
  opexRealisasi: number;
  capexRealisasi: number;
  totalAnggaran: number;
  totalRealisasi: number;
}

export interface LaporanTrenRow {
  tahun: number;
  opexAnggaran: number;
  opexRealisasi: number;
  capexAnggaran: number;
  capexRealisasi: number;
  totalAnggaran: number;
  totalRealisasi: number;
}

export const LaporanService = {
  /**
   * Ambil data per dosen dari alokasi_anggaran + realisasi_anggaran,
   * filter berdasarkan range tahun, jenis (OPEX/CAPEX/SEMUA), dan fakultas.
   */
  getDosenRows: async (
    tahunDari: number,
    tahunSampai: number,
    jenis: 'SEMUA' | 'OPEX' | 'CAPEX',
    fakultas: string
  ): Promise<LaporanDosenRow[]> => {
    let query = supabase
      .from('alokasi_anggaran')
      .select(`
        id,
        tahun,
        jenis_anggaran,
        nominal_anggaran,
        dosen:dosen_id (id, nama, nip, fakultas, program_studi),
        realisasi_anggaran (nominal)
      `)
      .gte('tahun', tahunDari)
      .lte('tahun', tahunSampai);

    if (jenis !== 'SEMUA') {
      query = query.eq('jenis_anggaran', jenis);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return [];

    // Map & group by dosen_id
    const map = new Map<string, LaporanDosenRow>();

    for (const row of data as any[]) {
      const d = row.dosen;
      if (!d) continue;
      // Client-side fakultas filter
      if (fakultas !== 'SEMUA' && d.fakultas !== fakultas) continue;

      const realisasiTotal = (row.realisasi_anggaran as { nominal: number }[])
        .reduce((s: number, r: { nominal: number }) => s + (r.nominal || 0), 0);

      const existing = map.get(d.id) ?? {
        dosenId: d.id,
        nama: d.nama,
        nip: d.nip,
        fakultas: d.fakultas,
        programStudi: d.program_studi,
        opexAnggaran: 0,
        capexAnggaran: 0,
        opexRealisasi: 0,
        capexRealisasi: 0,
        totalAnggaran: 0,
        totalRealisasi: 0,
      };

      if (row.jenis_anggaran === 'OPEX') {
        existing.opexAnggaran += row.nominal_anggaran || 0;
        existing.opexRealisasi += realisasiTotal;
      } else if (row.jenis_anggaran === 'CAPEX') {
        existing.capexAnggaran += row.nominal_anggaran || 0;
        existing.capexRealisasi += realisasiTotal;
      }

      existing.totalAnggaran = existing.opexAnggaran + existing.capexAnggaran;
      existing.totalRealisasi = existing.opexRealisasi + existing.capexRealisasi;

      map.set(d.id, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  },

  /**
   * Ambil data tren per tahun menggunakan RPC get_public_yearly_summary,
   * lalu filter sesuai range tahun yang dipilih.
   */
  getTrenData: async (
    tahunDari: number,
    tahunSampai: number,
    fakultas: string
  ): Promise<LaporanTrenRow[]> => {
    const { data, error } = await supabase.rpc('get_public_yearly_summary', {
      p_fakultas: fakultas === 'SEMUA' ? 'SEMUA' : fakultas,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as any[])
      .filter((r) => r.tahun >= tahunDari && r.tahun <= tahunSampai)
      .map((r) => ({
        tahun: r.tahun,
        opexAnggaran: r.opex || 0,
        opexRealisasi: r.opex_realisasi || 0,
        capexAnggaran: r.capex || 0,
        capexRealisasi: r.capex_realisasi || 0,
        totalAnggaran: r.total_anggaran || 0,
        totalRealisasi: r.total_realisasi || 0,
      }))
      .sort((a, b) => a.tahun - b.tahun);
  },
};
