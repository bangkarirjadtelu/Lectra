-- 31_laporan_rpc.sql
-- RPC untuk halaman Laporan: data anggaran & realisasi PER DOSEN PER TAHUN
-- SECURITY DEFINER agar bisa join realisasi_anggaran meskipun RLS ketat

DROP FUNCTION IF EXISTS public.get_laporan_dosen_rows(SMALLINT, SMALLINT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_laporan_dosen_rows(
  p_tahun_dari   SMALLINT,
  p_tahun_sampai SMALLINT,
  p_jenis        TEXT DEFAULT 'SEMUA',
  p_fakultas     TEXT DEFAULT 'SEMUA'
)
RETURNS TABLE (
  tahun           SMALLINT,
  dosen_id        UUID,
  nama            TEXT,
  nip             TEXT,
  fakultas        TEXT,
  program_studi   TEXT,
  opex_anggaran   BIGINT,
  capex_anggaran  BIGINT,
  opex_realisasi  BIGINT,
  capex_realisasi BIGINT,
  total_anggaran  BIGINT,
  total_realisasi BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.tahun,
    d.id                                                                AS dosen_id,
    d.nama,
    d.nip,
    d.fakultas,
    d.program_studi,
    COALESCE(SUM(CASE WHEN a.jenis_anggaran = 'OPEX'  THEN a.nominal_anggaran ELSE 0 END), 0)::BIGINT AS opex_anggaran,
    COALESCE(SUM(CASE WHEN a.jenis_anggaran = 'CAPEX' THEN a.nominal_anggaran ELSE 0 END), 0)::BIGINT AS capex_anggaran,
    COALESCE(SUM(CASE WHEN a.jenis_anggaran = 'OPEX'  THEN r_agg.total_real   ELSE 0 END), 0)::BIGINT AS opex_realisasi,
    COALESCE(SUM(CASE WHEN a.jenis_anggaran = 'CAPEX' THEN r_agg.total_real   ELSE 0 END), 0)::BIGINT AS capex_realisasi,
    COALESCE(SUM(a.nominal_anggaran), 0)::BIGINT                        AS total_anggaran,
    COALESCE(SUM(r_agg.total_real), 0)::BIGINT                          AS total_realisasi
  FROM public.alokasi_anggaran a
  JOIN public.dosen d ON d.id = a.dosen_id
  LEFT JOIN (
    SELECT alokasi_id, SUM(nominal)::BIGINT AS total_real
    FROM public.realisasi_anggaran
    GROUP BY alokasi_id
  ) r_agg ON r_agg.alokasi_id = a.id
  WHERE a.tahun >= p_tahun_dari
    AND a.tahun <= p_tahun_sampai
    AND (p_fakultas = 'SEMUA' OR d.fakultas = p_fakultas)
    AND (p_jenis    = 'SEMUA' OR a.jenis_anggaran = p_jenis)
  GROUP BY a.tahun, d.id, d.nama, d.nip, d.fakultas, d.program_studi
  ORDER BY d.nama, a.tahun;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_laporan_dosen_rows(SMALLINT, SMALLINT, TEXT, TEXT) TO anon, authenticated;
