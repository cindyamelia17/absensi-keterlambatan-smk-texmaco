"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function StatusSiswaPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = useState(false);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [kelasOptions, setKelasOptions] = useState<string[]>([]);

  // kenaikan kelas
  const [fromKelas, setFromKelas] = useState("X-TP-1");
  const [toKelas, setToKelas] = useState("XI-TP-1");

  // kelulusan (dropdown)
  const [kelasXii, setKelasXii] = useState<string>("");

  const kelasXiiOptions = useMemo(() => {
    // ambil yang diawali "XII" (XII-TP-1, XII IPA 1, XII-DGM, dll)
    const list = (kelasOptions || []).filter((k) =>
      String(k).toUpperCase().startsWith("XII"),
    );
    return list;
  }, [kelasOptions]);

  async function loadKelasOptions() {
    setLoadingKelas(true);
    setMsg(null);

    const { data, error } = await supabase.from("students").select("kelas");

    setLoadingKelas(false);

    if (error) {
      setMsg("Gagal memuat pilihan kelas. Cek RLS select students.");
      return;
    }

    const unique = Array.from(new Set((data ?? []).map((x: any) => x.kelas)))
      .filter(Boolean)
      .sort();

    setKelasOptions(unique);

    // set default aman kalau nilai default belum ada di list DB
    if (unique.length) {
      if (!unique.includes(fromKelas)) setFromKelas(unique[0]);
      if (!unique.includes(toKelas)) setToKelas(unique[0]);
    }
  }

  // set default kelas XII setelah kelasOptions siap
  useEffect(() => {
    if (!kelasXii && kelasXiiOptions.length) {
      setKelasXii(kelasXiiOptions[0]);
    }
  }, [kelasXii, kelasXiiOptions]);

  useEffect(() => {
    loadKelasOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bulkNaikKelas() {
    setMsg(null);

    if (!fromKelas) return setMsg("Dari kelas wajib dipilih.");
    if (!toKelas) return setMsg("Ke kelas wajib dipilih.");
    if (fromKelas === toKelas)
      return setMsg("Dari kelas dan Ke kelas tidak boleh sama.");

    const ok = confirm(
      `Naikkan semua siswa AKTIF dari ${fromKelas} ke ${toKelas}?`,
    );
    if (!ok) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("students")
      .update({ kelas: toKelas })
      .eq("kelas", fromKelas)
      .eq("status", "AKTIF")
      .select("id");

    setLoading(false);

    if (error) return setMsg(`Gagal: ${error.message}`);

    setMsg(`✅ Berhasil. ${data?.length ?? 0} siswa dipindahkan kelas.`);
  }

  async function bulkLulusKelas(kelasTarget: string) {
    setMsg(null);

    if (!kelasTarget) return setMsg("Pilih kelas XII dulu ya.");

    const ok = confirm(
      `Set semua siswa AKTIF di ${kelasTarget} menjadi LULUS?`,
    );
    if (!ok) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("students")
      .update({ status: "LULUS" })
      .eq("kelas", kelasTarget)
      .eq("status", "AKTIF")
      .select("id");

    setLoading(false);

    if (error) return setMsg(`Gagal: ${error.message}`);

    setMsg(
      `✅ Berhasil. ${data?.length ?? 0} siswa di ${kelasTarget} menjadi LULUS.`,
    );
  }

  async function bulkLulusSemuaXii() {
    setMsg(null);

    if (!kelasXiiOptions.length) {
      return setMsg("Tidak ada kelas XII terdeteksi di database.");
    }

    const ok = confirm(
      `Set semua siswa AKTIF di SEMUA kelas XII menjadi LULUS?\nKelas: ${kelasXiiOptions.join(", ")}`,
    );
    if (!ok) return;

    setLoading(true);

    // update semua kelas XII yang statusnya AKTIF
    const { data, error } = await supabase
      .from("students")
      .update({ status: "LULUS" })
      .in("kelas", kelasXiiOptions)
      .eq("status", "AKTIF")
      .select("id");

    setLoading(false);

    if (error) return setMsg(`Gagal: ${error.message}`);

    setMsg(
      `✅ Berhasil. ${data?.length ?? 0} siswa di semua kelas XII menjadi LULUS.`,
    );
  }

  const disabledAll = loading || loadingKelas;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Status Siswa
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Untuk kesiswaan: kenaikan kelas & kelulusan tanpa buka Supabase.
            </p>
          </div>

          <Link
            href="/dashboard/siswa"
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 grid place-items-center hover:bg-slate-50"
          >
            Kembali
          </Link>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          {msg}
        </div>
      ) : null}

      {/* Kenaikan kelas */}
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-slate-900">Kenaikan Kelas</h2>
        <p className="mt-1 text-xs text-slate-500">
          Hanya siswa berstatus AKTIF yang akan dipindah.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">
              Dari Kelas
            </label>
            <select
              value={fromKelas}
              onChange={(e) => setFromKelas(e.target.value)}
              disabled={disabledAll}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                "disabled:bg-slate-50 disabled:text-slate-400",
                fromKelas ? "text-slate-900" : "text-slate-400",
              )}
            >
              {loadingKelas ? (
                <option value="">Memuat kelas...</option>
              ) : (
                <>
                  <option value="">-- pilih kelas --</option>
                  {kelasOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Ke Kelas
            </label>
            <select
              value={toKelas}
              onChange={(e) => setToKelas(e.target.value)}
              disabled={disabledAll}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                "disabled:bg-slate-50 disabled:text-slate-400",
                toKelas ? "text-slate-900" : "text-slate-400",
              )}
            >
              {loadingKelas ? (
                <option value="">Memuat kelas...</option>
              ) : (
                <>
                  <option value="">-- pilih kelas --</option>
                  {kelasOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <button
          onClick={bulkNaikKelas}
          disabled={disabledAll}
          className="mt-3 h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Proses Kenaikan"}
        </button>
      </div>

      {/* Kelulusan */}
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-slate-900">Kelulusan</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pilih kelas XII yang mau diluluskan (otomatis dari database).
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="text-xs font-medium text-slate-600">
              Kelas XII
            </label>
            <select
              value={kelasXii}
              onChange={(e) => setKelasXii(e.target.value)}
              disabled={disabledAll || kelasXiiOptions.length === 0}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                "disabled:bg-slate-50 disabled:text-slate-400",
                kelasXii ? "text-slate-900" : "text-slate-400",
              )}
            >
              {loadingKelas ? (
                <option value="">Memuat kelas...</option>
              ) : kelasXiiOptions.length === 0 ? (
                <option value="">Tidak ada kelas XII terdeteksi</option>
              ) : (
                <>
                  <option value="">-- pilih kelas XII --</option>
                  {kelasXiiOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <button
            onClick={() => bulkLulusKelas(kelasXii)}
            disabled={disabledAll || !kelasXii}
            className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Luluskan"}
          </button>
        </div>

        <div className="mt-3">
          <button
            onClick={bulkLulusSemuaXii}
            disabled={disabledAll || kelasXiiOptions.length === 0}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            Luluskan Semua Kelas XII
          </button>

          <p className="mt-2 text-[12px] text-slate-500">
            Tombol ini akan meluluskan semua siswa <b>AKTIF</b> di seluruh kelas
            yang diawali <b>XII</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
