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
   * Ambil data per dosen via RPC get_laporan_dosen_rows (SECURITY DEFINER)
   * agar bisa join realisasi_anggaran meskipun RLS ketat.
   */
  getDosenRows: async (
    tahunDari: number,
    tahunSampai: number,
    jenis: 'SEMUA' | 'OPEX' | 'CAPEX',
    fakultas: string
  ): Promise<LaporanDosenRow[]> => {
    const { data, error } = await supabase.rpc('get_laporan_dosen_rows', {
      p_tahun_dari: tahunDari,
      p_tahun_sampai: tahunSampai,
      p_jenis: jenis,
      p_fakultas: fakultas,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as any[]).map((r) => ({
      dosenId: r.dosen_id,
      nama: r.nama,
      nip: r.nip,
      fakultas: r.fakultas,
      programStudi: r.program_studi,
      opexAnggaran: r.opex_anggaran || 0,
      capexAnggaran: r.capex_anggaran || 0,
      opexRealisasi: r.opex_realisasi || 0,
      capexRealisasi: r.capex_realisasi || 0,
      totalAnggaran: r.total_anggaran || 0,
      totalRealisasi: r.total_realisasi || 0,
    }));
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
