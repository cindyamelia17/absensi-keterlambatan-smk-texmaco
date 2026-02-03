"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type ImportRow = {
  nis: string;
  nama: string;
  kelas: string;
  status: "AKTIF" | "NONAKTIF" | "LULUS";
};

function parseCSV(text: string): ImportRow[] {
  // sederhana: split baris, split koma. (cukup untuk CSV basic)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0]
    .toLowerCase()
    .split(",")
    .map((s) => s.trim());
  const idxNis = header.indexOf("nis");
  const idxNama = header.indexOf("nama");
  const idxKelas = header.indexOf("kelas");
  const idxStatus = header.indexOf("status");

  if (idxNis === -1 || idxNama === -1 || idxKelas === -1) return [];

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
    const nis = cols[idxNis] ?? "";
    const nama = cols[idxNama] ?? "";
    const kelas = cols[idxKelas] ?? "";
    const statusRaw = (idxStatus >= 0 ? cols[idxStatus] : "") ?? "";

    if (!nis || !nama || !kelas) continue;

    const status =
      statusRaw.toUpperCase() === "LULUS"
        ? "LULUS"
        : statusRaw.toUpperCase() === "NONAKTIF"
          ? "NONAKTIF"
          : "AKTIF";

    rows.push({ nis, nama, kelas, status });
  }

  return rows;
}

export default function ImportSiswaPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPickFile(file: File | null) {
    setMsg(null);
    setPreview([]);
    if (!file) return;

    setFileName(file.name);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      setMsg(
        "CSV tidak valid. Pastikan header: nis,nama,kelas,status (status opsional).",
      );
      return;
    }

    setPreview(rows.slice(0, 50));
    setMsg(`Terbaca ${rows.length} baris. Preview tampil max 50.`);
    // simpan semua baris di state tersembunyi? kita simpan pakai dataset di window? cukup simpan preview + re-read saat upload? lebih aman simpan full:
    (window as any).__IMPORT_ROWS__ = rows;
  }

  async function onImport() {
    const rows: ImportRow[] = (window as any).__IMPORT_ROWS__ ?? [];
    if (!rows.length) {
      setMsg("file CSV tidak valid.");
      return;
    }

    setLoading(true);
    setMsg(null);

    // batching biar aman (Supabase limit payload)
    const chunkSize = 300;
    let success = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const { error } = await supabase
        .from("students")
        .upsert(chunk, { onConflict: "nis" });

      if (error) {
        setLoading(false);
        setMsg(`Gagal import di batch ${i / chunkSize + 1}: ${error.message}`);
        return;
      }

      success += chunk.length;
    }

    setLoading(false);
    setMsg(`✅ Import selesai. ${success} baris diproses (insert/update).`);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Import Siswa (CSV)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Format CSV: <b>nis,nama,kelas,status</b> (status opsional, default
              AKTIF)
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

      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5 space-y-4">
        {msg ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {msg}
          </div>
        ) : null}

        <div>
          <label className="text-xs font-medium text-slate-600">
            Pilih file CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            File dipilih: {fileName || "-"}
          </p>
        </div>

        <button
          onClick={onImport}
          disabled={loading}
          className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Mengimport..." : "Import"}
        </button>

        {preview.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-3 pr-3">NIS</th>
                  <th className="py-3 pr-3">Nama</th>
                  <th className="py-3 pr-3">Kelas</th>
                  <th className="py-3 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 pr-3">{r.nis}</td>
                    <td className="py-3 pr-3">{r.nama}</td>
                    <td className="py-3 pr-3">{r.kelas}</td>
                    <td className="py-3 pr-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Preview max 50 baris.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
