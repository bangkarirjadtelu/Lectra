import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=([^\n]+)/);
const serviceKey = key ? key[1].trim() : env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n]+)/)[1].trim();
const url = env.match(/VITE_SUPABASE_URL=([^\n]+)/)[1].trim();
const supabase = createClient(url, serviceKey);

const sql = `
CREATE OR REPLACE FUNCTION public.get_public_penerima_anggaran(p_tahun SMALLINT, p_jenis TEXT)
RETURNS TABLE (
    dosen_id UUID,
    nip TEXT,
    nama TEXT,
    fakultas TEXT,
    program_studi TEXT,
    jenis_anggaran TEXT,
    nominal_anggaran BIGINT,
    alokasi_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id AS dosen_id,
        d.nip,
        d.nama,
        d.fakultas,
        d.program_studi,
        a.jenis_anggaran,
        a.nominal_anggaran,
        a.id AS alokasi_id
    FROM public.alokasi_anggaran a
    JOIN public.dosen d ON a.dosen_id = d.id
    WHERE a.tahun = p_tahun AND a.jenis_anggaran = p_jenis
    
    UNION ALL
    
    SELECT 
        dt.dosen_id AS dosen_id,
        d.nip,
        d.nama,
        d.fakultas,
        d.program_studi,
        a.jenis_anggaran,
        a.nominal_anggaran,
        a.id AS alokasi_id
    FROM public.alokasi_anggaran a
    JOIN public.alokasi_dosen_tambahan dt ON a.id = dt.alokasi_id
    JOIN public.dosen d ON dt.dosen_id = d.id
    WHERE a.tahun = p_tahun AND a.jenis_anggaran = p_jenis
    
    ORDER BY nama ASC;
END;
$$;
`;

// Supabase JS client doesn't support executing arbitrary SQL directly unless via an existing RPC,
// but actually, maybe we can just create a temporary RPC to run this SQL, or use psql.
// Wait! `psql` might be installed since XAMPP or Windows has it, or we can use `pg` npm package!
