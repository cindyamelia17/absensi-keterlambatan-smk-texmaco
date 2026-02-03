"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function TambahSiswaPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [nis, setNis] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [status, setStatus] = useState<"AKTIF" | "NONAKTIF" | "LULUS">("AKTIF");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!nis.trim()) return setMsg("NIS wajib diisi.");
    if (!nama.trim()) return setMsg("Nama wajib diisi.");
    if (!kelas.trim()) return setMsg("Kelas wajib diisi.");

    setLoading(true);

    // ✅ Cek NIS unik (biar rapi)
    const { data: exist } = await supabase
      .from("students")
      .select("id")
      .eq("nis", nis.trim())
      .maybeSingle();

    if (exist?.id) {
      setLoading(false);
      setMsg("NIS sudah ada. Cek lagi ya.");
      return;
    }

    const { error } = await supabase.from("students").insert({
      nis: nis.trim(),
      nama: nama.trim(),
      kelas: kelas.trim(),
      status,
    });

    setLoading(false);

    if (error) {
      setMsg("Gagal simpan. Cek RLS insert students.");
      return;
    }

    router.push("/dashboard/siswa");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-900">Tambah Siswa</h1>
        <p className="mt-1 text-sm text-slate-600">
          Input manual untuk siswa baru (kalau cuma 1–2 orang).
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5 space-y-4"
      >
        {msg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">NIS *</label>
            <input
              value={nis}
              onChange={(e) => setNis(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              inputMode="numeric"
              placeholder="contoh: 2210xxxx"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              Kelas *
            </label>
            <input
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              placeholder="contoh: X-TP-1"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Nama *</label>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            placeholder="Nama lengkap"
          />
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
            <option value="AKTIF">AKTIF</option>
            <option value="NONAKTIF">NONAKTIF</option>
            <option value="LULUS">LULUS</option>
          </select>
        </div>

        <button
          disabled={loading}
          className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </form>
    </div>
  );
}
