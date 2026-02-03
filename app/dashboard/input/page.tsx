"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Student = {
  id: string;
  nama: string;
  kelas: string;
  nis: string | null;
};

// ✅ FIX: jangan pakai toISOString (UTC). Pakai tanggal lokal (WIB/device).
function formatDateLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime(d: Date) {
  return d.toTimeString().slice(0, 5);
}

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

// ====== SETTING JAM TUTUP SEKOLAH ======
const SCHOOL_CUTOFF = "06:30"; // ubah kalau perlu (mis. "06:35")

function timeToMinutes(t: string) {
  const raw = (t || "").trim();
  if (!raw) return 0;
  const hh = Number(raw.slice(0, 2));
  const mm = Number(raw.slice(3, 5));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function calcLateMinutes(jamDatang: string, cutoff: string) {
  const datang = timeToMinutes(jamDatang);
  const batas = timeToMinutes(cutoff);
  return Math.max(0, datang - batas);
}

// ✅ format menit -> "X menit" / "Y jam Z menit"
function formatLateDuration(mins: number) {
  const m = Math.max(0, Number(mins) || 0);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} jam` : `${h} jam ${r} menit`;
}

export default function InputPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [tanggal, setTanggal] = useState(formatDateLocal(new Date()));
  const [jamDatang, setJamDatang] = useState(formatTime(new Date()));

  const [kelas, setKelas] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  const [alasan, setAlasan] = useState("");
  const [catatan, setCatatan] = useState("");

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);

  // ✅ dropdown kelas dinamis
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [kelasErr, setKelasErr] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ auto update jam & tanggal tiap 30 detik
  useEffect(() => {
    const i = setInterval(() => {
      const now = new Date();
      setJamDatang(formatTime(now));
      setTanggal(formatDateLocal(now));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const lateMinutes = useMemo(
    () => calcLateMinutes(jamDatang, SCHOOL_CUTOFF),
    [jamDatang],
  );

  // ✅ ambil kelas dari tabel students (status AKTIF)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingKelas(true);
      setKelasErr(null);

      try {
        const pageSize = 1000;
        let from = 0;
        let all: { kelas: string | null }[] = [];

        while (true) {
          const { data, error } = await supabase
            .from("students")
            .select("kelas")
            .eq("status", "AKTIF")
            .range(from, from + pageSize - 1);

          if (cancelled) return;

          if (error) {
            console.log("kelas options error:", error);
            setKelasErr("Gagal memuat kelas. Cek RLS tabel students.");
            setKelasOptions([]);
            return;
          }

          const batch = (data ?? []) as { kelas: string | null }[];
          all = all.concat(batch);

          if (batch.length < pageSize) break;
          from += pageSize;
        }

        const unique = Array.from(
          new Set(
            all.map((x) => (x.kelas ?? "").trim()).filter((k) => k.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b, "id-ID"));

        setKelasOptions(unique);
      } finally {
        if (!cancelled) setLoadingKelas(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // fetch siswa saat kelas berubah
  useEffect(() => {
    setStudents([]);
    setStudentId("");
    setSuccess(null);
    setWarning(null);
    setErrorMsg(null);

    if (!kelas) return;

    let cancelled = false;

    (async () => {
      setLoadingStudents(true);
      try {
        const { data, error } = await supabase
          .from("students")
          .select("id,nama,kelas,nis")
          .eq("kelas", kelas)
          .eq("status", "AKTIF")
          .order("nama", { ascending: true })
          .limit(1000);

        if (cancelled) return;

        if (error) {
          console.log("students select error:", error);
          setStudents([]);
          setErrorMsg("Gagal memuat daftar siswa. Cek RLS tabel students.");
        } else {
          setStudents((data ?? []) as Student[]);
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kelas, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccess(null);
    setWarning(null);

    if (!kelas) return setErrorMsg("Kelas wajib dipilih.");
    if (!studentId) return setErrorMsg("Nama siswa wajib dipilih.");
    if (!selectedStudent)
      return setErrorMsg("Siswa tidak ditemukan. Pilih ulang.");

    setLoadingSave(true);

    // ✅ tambahan aman: pakai waktu sekarang saat submit (mencegah tanggal nyangkut)
    const now = new Date();
    const safeTanggal = tanggal || formatDateLocal(now);
    const safeJam = jamDatang || formatTime(now);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;

    const { error } = await supabase.from("late_attendance").insert({
      tanggal: safeTanggal,
      jam_datang: safeJam,
      student_id: selectedStudent.id,
      nis: selectedStudent.nis ?? null,
      nama: selectedStudent.nama,
      kelas: selectedStudent.kelas,
      alasan: alasan || null,
      catatan: catatan || null,
      created_by: uid,
    });

    if (error) {
      setLoadingSave(false);
      return setErrorMsg(`Gagal menyimpan: ${error.message}`);
    }

    // cek total keterlambatan siswa (all-time) untuk peringatan SP
    const { count, error: countErr } = await supabase
      .from("late_attendance")
      .select("id", { count: "exact", head: true })
      .eq("student_id", selectedStudent.id);

    setLoadingSave(false);

    setSuccess("Data keterlambatan berhasil disimpan.");

    if (!countErr && typeof count === "number" && count >= 10) {
      setWarning(
        `⚠️ Peringatan: ${selectedStudent.nama} sudah terlambat ${count}x (≥ 10x).`,
      );
    }

    setStudentId("");
    setAlasan("");
    setCatatan("");
    setJamDatang(formatTime(new Date()));
    setTanggal(formatDateLocal(new Date()));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-900">
          Input Keterlambatan
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Alur: pilih <b>Kelas</b> → pilih <b>Nama</b> → NIS otomatis → simpan.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5 space-y-4"
      >
        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {warning && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            {warning}
          </div>
        )}

        {kelasErr && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {kelasErr}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">
              Tanggal
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">
              Jam Datang
            </label>
            <div className="flex gap-2 mt-1">
              <input
                value={jamDatang}
                onChange={(e) => setJamDatang(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setJamDatang(formatTime(now));
                  setTanggal(formatDateLocal(now));
                }}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900"
              >
                Sekarang
              </button>
            </div>

            <p className="mt-1 text-[12px] text-slate-500">
              Batas jam masuk: <b>{SCHOOL_CUTOFF}</b> • Terlambat:{" "}
              <b
                className={lateMinutes > 0 ? "text-red-600" : "text-slate-700"}
              >
                {formatLateDuration(lateMinutes)}
              </b>
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Kelas *</label>
          <select
            value={kelas}
            onChange={(e) => setKelas(e.target.value)}
            disabled={loadingKelas}
            className={cx(
              "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
              "disabled:bg-slate-50 disabled:text-slate-400",
              kelas ? "text-slate-900" : "text-slate-400",
            )}
            required
          >
            {loadingKelas ? (
              <option value="">Memuat kelas...</option>
            ) : (
              <option value="">-- pilih kelas --</option>
            )}

            {kelasOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <div className="mt-1 text-[12px] text-slate-500">
            {loadingKelas
              ? "Sedang memuat..."
              : `${kelasOptions.length} kelas ditemukan`}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">
              Nama Siswa *
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={!kelas || loadingStudents}
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm",
                "disabled:bg-slate-50 disabled:text-slate-400",
                studentId ? "text-slate-900" : "text-slate-400",
              )}
              required
            >
              {!kelas ? (
                <option value="">Pilih kelas terlebih dahulu</option>
              ) : loadingStudents ? (
                <option value="">Memuat daftar siswa...</option>
              ) : students.length === 0 ? (
                <option value="">Tidak ada siswa AKTIF di kelas ini</option>
              ) : (
                <>
                  <option value="">-- pilih siswa --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </>
              )}
            </select>

            <div className="mt-1 text-[12px] text-slate-500">
              {kelas
                ? loadingStudents
                  ? "Sedang memuat..."
                  : `${students.length} siswa ditemukan`
                : " "}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">NIS</label>
            <input
              value={selectedStudent?.nis ?? ""}
              readOnly
              placeholder={
                studentId ? "NIS tidak tersedia" : "NIS akan muncul otomatis"
              }
              className={cx(
                "mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm",
                "bg-slate-50 text-slate-900 placeholder:text-slate-400",
              )}
            />
            <div className="mt-1 text-[12px] text-slate-500">
              NIS otomatis terisi setelah pilih siswa.
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Alasan</label>
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Bangun kesiangan / macet / dll"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Catatan</label>
          <input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Catatan tambahan (opsional)"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <button
          disabled={loadingSave}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
        >
          {loadingSave ? "Menyimpan..." : "Simpan"}
        </button>
      </form>
    </div>
  );
}
