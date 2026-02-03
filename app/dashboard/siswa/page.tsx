"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type StudentRow = {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  status: "AKTIF" | "NONAKTIF" | "LULUS";
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function SiswaPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [q, setQ] = useState("");
  const [kelas, setKelas] = useState("");
  const [status, setStatus] = useState<"" | "AKTIF" | "NONAKTIF" | "LULUS">("");

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadKelasOptions() {
    const { data, error } = await supabase.from("students").select("kelas");
    if (error) return;
    const unique = Array.from(new Set((data ?? []).map((x: any) => x.kelas)))
      .filter(Boolean)
      .sort();
    setKelasOptions(unique);
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    let query = supabase
      .from("students")
      .select("id,nis,nama,kelas,status")
      .order("kelas", { ascending: true })
      .order("nama", { ascending: true })
      .limit(800);

    if (kelas) query = query.eq("kelas", kelas);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      setMsg("Gagal memuat data siswa. Pastikan RLS select students aktif.");
      setRows([]);
      return;
    }

    let result = (data ?? []) as StudentRow[];

    const keyword = q.trim().toLowerCase();
    if (keyword) {
      result = result.filter((r) => {
        return (
          (r.nama || "").toLowerCase().includes(keyword) ||
          (r.nis || "").toLowerCase().includes(keyword)
        );
      });
    }

    setRows(result);
  }

  async function setStudentStatus(
    id: string,
    nextStatus: StudentRow["status"],
  ) {
    setMsg(null);
    const { error } = await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      setMsg("Gagal update status. Cek RLS update students.");
      return;
    }
    await load();
  }

  useEffect(() => {
    load();
    loadKelasOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Data Siswa</h1>
            <p className="mt-1 text-sm text-slate-600">
              Kelola siswa: tambah, import, ubah status (aktif/lulus).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard/siswa/tambah"
              className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white grid place-items-center hover:bg-slate-800"
            >
              + Tambah
            </Link>
            <Link
              href="/dashboard/siswa/import"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 grid place-items-center hover:bg-slate-50"
            >
              Import CSV
            </Link>
            <Link
              href="/dashboard/siswa/status"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 grid place-items-center hover:bg-slate-50"
            >
              Status
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-600">
              Cari (Nama / NIS)
            </label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="contoh: Citra / 12345"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Kelas</label>
            <select
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                kelas ? "text-slate-900" : "text-slate-400",
              )}
            >
              <option value="">Semua</option>
              {kelasOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                status ? "text-slate-900" : "text-slate-400",
              )}
            >
              <option value="">Semua</option>
              <option value="AKTIF">AKTIF</option>
              <option value="NONAKTIF">NONAKTIF</option>
              <option value="LULUS">LULUS</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Memuat..." : "Tampilkan"}
          </button>
          <button
            onClick={() => {
              setQ("");
              setKelas("");
              setStatus("");
              setTimeout(load, 0);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {msg}
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Daftar Siswa</p>
          <p className="text-xs text-slate-500">{rows.length} data</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              {/* header dibuat sedikit lebih gelap di mobile, desktop tetap sama */}
              <tr className="border-b border-slate-200 text-left text-xs text-slate-700 md:text-slate-500">
                <th className="py-3 pr-3">NIS</th>
                <th className="py-3 pr-3">Nama</th>
                <th className="py-3 pr-3">Kelas</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-3">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  {/* ✅ FIX: NIS dibuat lebih tegas di mobile, desktop tetap normal/pudar */}
                  <td className="py-3 pr-3 tabular-nums text-slate-900 md:text-slate-700 font-semibold md:font-normal">
                    {r.nis}
                  </td>

                  <td className="py-3 pr-3 font-medium text-slate-900">
                    {r.nama}
                  </td>

                  {/* ✅ FIX: Kelas dibuat lebih tegas di mobile, desktop tetap normal */}
                  <td className="py-3 pr-3 text-slate-900 md:text-slate-700 font-semibold md:font-normal">
                    {r.kelas}
                  </td>

                  <td className="py-3 pr-3">
                    <span
                      className={cx(
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        r.status === "AKTIF" &&
                          "bg-emerald-50 text-emerald-700",
                        r.status === "NONAKTIF" &&
                          "bg-slate-100 text-slate-700",
                        r.status === "LULUS" && "bg-indigo-50 text-indigo-700",
                      )}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className="py-3 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setStudentStatus(r.id, "AKTIF")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Aktif
                      </button>
                      <button
                        onClick={() => setStudentStatus(r.id, "NONAKTIF")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Nonaktif
                      </button>
                      <button
                        onClick={() => setStudentStatus(r.id, "LULUS")}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Lulus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Catatan: di HP tabel bisa digeser (scroll) ke kanan.
        </p>
      </div>
    </div>
  );
}
