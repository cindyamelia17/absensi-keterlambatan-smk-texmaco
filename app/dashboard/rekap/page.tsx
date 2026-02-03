"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type LateRow = {
  id: string;
  tanggal: string; // yyyy-mm-dd
  jam_datang: string; // "HH:mm" / "HH:mm:ss"
  student_id: string | null;
  nis: string | null;
  nama: string;
  kelas: string;
  alasan: string | null;
  catatan: string | null;
};

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ tanggal Indonesia (tanggal dulu)
function formatTanggalID(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatJam(jam: string) {
  return (jam || "").slice(0, 5);
}

// ====== SETTING JAM TUTUP SEKOLAH ======
const SCHOOL_CUTOFF = "06:30";

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

// ✅ nama bulan Indonesia
const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// ambil file logo dari /public lalu convert ke DataURL (buat jsPDF)
async function fetchAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal memuat logo untuk PDF.");
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function RekapPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(toISODate(today));
  const [endDate, setEndDate] = useState(toISODate(today));

  // value tetap "01".."12"
  const [month, setMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0"),
  );
  const [year, setYear] = useState(String(today.getFullYear()));

  const [kelasFilter, setKelasFilter] = useState("");
  const [kelasOptions, setKelasOptions] = useState<string[]>([]);

  const [rows, setRows] = useState<LateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadKelasOptions() {
    const { data, error } = await supabase
      .from("students")
      .select("kelas")
      .eq("status", "AKTIF");
    if (error) return;

    const unique = Array.from(new Set((data ?? []).map((x: any) => x.kelas)))
      .filter(Boolean)
      .sort();

    setKelasOptions(unique);
  }

  async function loadByDateRange() {
    setMsg(null);
    setLoading(true);

    let q = supabase
      .from("late_attendance")
      .select("id,tanggal,jam_datang,student_id,nis,nama,kelas,alasan,catatan")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate);

    if (kelasFilter) q = q.eq("kelas", kelasFilter);

    const { data, error } = await q
      .order("tanggal", { ascending: false })
      .order("jam_datang", { ascending: false });

    setLoading(false);

    if (error) {
      setMsg("Gagal memuat data. Pastikan sudah login dan RLS select aktif.");
      return;
    }
    setRows((data ?? []) as LateRow[]);
  }

  async function loadByMonth() {
    setMsg(null);
    setLoading(true);

    const start = `${year}-${month}-01`;
    const endDateObj = new Date(Number(year), Number(month), 0);
    const end = toISODate(endDateObj);

    let q = supabase
      .from("late_attendance")
      .select("id,tanggal,jam_datang,student_id,nis,nama,kelas,alasan,catatan")
      .gte("tanggal", start)
      .lte("tanggal", end);

    if (kelasFilter) q = q.eq("kelas", kelasFilter);

    const { data, error } = await q
      .order("tanggal", { ascending: false })
      .order("jam_datang", { ascending: false });

    setLoading(false);

    if (error) {
      setMsg("Gagal memuat data bulanan. Pastikan sudah login.");
      return;
    }
    setRows((data ?? []) as LateRow[]);
  }

  useEffect(() => {
    loadByDateRange();
    loadKelasOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.length;

  const uniqueStudents = useMemo(
    () => new Set(rows.map((r) => r.nama)).size,
    [rows],
  );

  // ✅ periode tampil Indonesia (biarkan seperti ini sesuai kode kamu)
  const periodeText = useMemo(() => {
    if (!rows.length) return "-";
    const start = rows[rows.length - 1]?.tanggal;
    const end = rows[0]?.tanggal;
    return `${formatTanggalID(start)} s/d ${formatTanggalID(end)}`;
  }, [rows]);

  // ✅ rows + derived late_minutes
  const rowsWithLate = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      late_minutes: calcLateMinutes(r.jam_datang, SCHOOL_CUTOFF),
    }));
  }, [rows]);

  // ✅ daftar siswa terlambat >= 5x (bukan 10x)
  const late5Plus = useMemo(() => {
    const counter = rows.reduce(
      (
        acc: Record<
          string,
          { nama: string; nis: string | null; kelas: string; count: number }
        >,
        r,
      ) => {
        const key = r.student_id || `${r.nis ?? ""}::${r.nama}::${r.kelas}`;
        if (!acc[key])
          acc[key] = { nama: r.nama, nis: r.nis, kelas: r.kelas, count: 0 };
        acc[key].count += 1;
        return acc;
      },
      {},
    );

    return Object.values(counter)
      .filter((x) => x.count >= 5)
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  async function exportPDF() {
    if (!rows.length) {
      setMsg("Tidak ada data untuk diexport. Tampilkan data dulu ya.");
      return;
    }

    try {
      setExporting(true);
      setMsg(null);

      const logoUrl = "/logo-karawang-smk.png";
      let logoDataUrl: string | null = null;

      try {
        logoDataUrl = await fetchAsDataURL(logoUrl);
      } catch (e) {
        console.log("Logo tidak bisa dimuat, lanjut tanpa logo:", e);
        logoDataUrl = null;
      }

      // ✅ A4 PORTRAIT
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const sekolah = "SMK TEXMACO KARAWANG";
      const title = "REKAP KETERLAMBATAN SISWA";

      const filterKelasText = kelasFilter
        ? `Kelas : ${kelasFilter}`
        : "Kelas : Semua";

      const periode = rows.length
        ? `${formatTanggalID(rows[rows.length - 1].tanggal)} s/d ${formatTanggalID(rows[0].tanggal)}`
        : "-";

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 10;

      const headerTopY = 10;
      const logoSize = 16;
      const logoX = marginX;
      const logoY = headerTopY;
      const centerX = pageW / 2;

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(sekolah, centerX, headerTopY + 6, { align: "center" });

      doc.setFontSize(11);
      doc.text(title, centerX, headerTopY + 13, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const infoY1 = headerTopY + 22;
      const infoY2 = headerTopY + 27;

      doc.text(`Periode : ${periode}`, marginX, infoY1);
      doc.text(filterKelasText, marginX, infoY2);

      doc.text(`Total data : ${rows.length}`, pageW - marginX, infoY1, {
        align: "right",
      });
      doc.text(`Siswa Khusus : ${uniqueStudents}`, pageW - marginX, infoY2, {
        align: "right",
      });

      doc.setDrawColor(210);
      doc.setLineWidth(0.5);
      doc.line(marginX, headerTopY + 31, pageW - marginX, headerTopY + 31);

      const tableW = pageW - marginX * 2; // 190mm

      // ✅ URUTAN PDF: Nama di depan (biar sama dengan tabel)
      const body = rowsWithLate.map((r, idx) => [
        String(idx + 1),
        r.nama,
        r.kelas,
        formatTanggalID(r.tanggal),
        formatJam(r.jam_datang),
        formatLateDuration(r.late_minutes),
        r.nis ?? "-",
        r.alasan ?? "-",
        r.catatan ?? "-",
      ]);

      autoTable(doc, {
        head: [
          [
            "No",
            "Nama",
            "Kelas",
            "Tanggal",
            "Jam",
            "Keterlambatan",
            "NIS",
            "Alasan",
            "Catatan",
          ],
        ],
        body,
        startY: 48,
        margin: { left: marginX, right: marginX },
        tableWidth: tableW,

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 1.6,
          valign: "middle",
          overflow: "linebreak",
        },

        headStyles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
        },

        alternateRowStyles: { fillColor: [245, 247, 250] },

        // ✅ TOTAL = 190mm
        // 8 + 34 + 14 + 23 + 12 + 24 + 26 + 25 + 24 = 190
        columnStyles: {
          0: { cellWidth: 8, halign: "center" }, // No
          1: { cellWidth: 34, halign: "left" }, // Nama
          2: { cellWidth: 14, halign: "center" }, // Kelas
          3: { cellWidth: 23, halign: "center" }, // Tanggal
          4: { cellWidth: 12, halign: "center" }, // Jam
          5: { cellWidth: 24, halign: "center" }, // Keterlambatan
          6: { cellWidth: 26, halign: "center", overflow: "visible" }, // NIS
          7: { cellWidth: 25, halign: "left" }, // Alasan
          8: { cellWidth: 24, halign: "left" }, // Catatan
        },

        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(
            `Halaman ${data.pageNumber} / ${pageCount}`,
            pageW - marginX,
            pageH - 8,
            { align: "right" },
          );
        },
      });

      const safeKelas = kelasFilter
        ? kelasFilter.replaceAll("/", "-")
        : "SEMUA";
      const filename = `Rekap-Terlambat-${safeKelas}-${toISODate(new Date())}.pdf`;
      doc.save(filename);
    } catch (err: any) {
      console.log(err);
      setMsg("Gagal export PDF. Cek console untuk detail error.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-900">
          Rekap Keterlambatan
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Termasuk hitung keterlambatan dari batas jam masuk{" "}
          <b>{SCHOOL_CUTOFF}</b>.
        </p>

        <div className="mt-4">
          <label className="text-xs font-medium text-slate-600">
            Filter Kelas
          </label>
          <select
            value={kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            className={[
              "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400",
              kelasFilter ? "text-slate-900" : "text-slate-400",
            ].join(" ")}
          >
            <option value="">Semua kelas</option>
            {kelasOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Filter Tanggal
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Dari
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Sampai
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={loadByDateRange}
                className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Memuat..." : "Tampilkan"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setStartDate(toISODate(now));
                  setEndDate(toISODate(now));
                  setTimeout(loadByDateRange, 0);
                }}
                className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hari ini
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Rekap Bulanan
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Bulan
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 text-slate-900"
                >
                  {MONTHS_ID.map((name, i) => {
                    const m = String(i + 1).padStart(2, "0");
                    return (
                      <option key={m} value={m}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Tahun
                </label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 text-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={loadByMonth}
                className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Memuat..." : "Tampilkan Bulan"}
              </button>

              <button
                type="button"
                onClick={exportPDF}
                disabled={loading || exporting || rows.length === 0}
                className={[
                  "h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold",
                  loading || exporting || rows.length === 0
                    ? "text-slate-400"
                    : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {exporting ? "Membuat PDF..." : "Export PDF"}
              </button>
            </div>


          </div>
        </div>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {msg}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
          <p className="text-xs font-medium text-slate-500">Total Data</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{total}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
          <p className="text-xs font-medium text-slate-500">Siswa Khusus</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {uniqueStudents}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
          <p className="text-xs font-medium text-slate-500">Periode</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {periodeText}
          </p>
          <p className="mt-1 text-xs text-slate-500">berdasarkan filter</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
          <p className="text-xs font-medium text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {loading ? "Memuat..." : "Siap"}
          </p>
          <p className="mt-1 text-xs text-slate-500">akses rekap kesiswaan</p>
        </div>
      </div>

      {/* ====== TABLE (Nama di depan + paksa warna supaya Android jelas) ====== */}
      <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Daftar Keterlambatan
          </h2>
          <span className="text-xs text-slate-500">
            {loading ? "Memuat data..." : `${rows.length} baris`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full text-sm table-fixed text-slate-900">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
                <th className="py-3 pr-3 w-[120px] whitespace-nowrap">Nama</th>
                <th className="py-3 pr-3 w-[110px] text-center whitespace-nowrap">
                  Kelas
                </th>
                <th className="py-3 pr-3 w-[140px] whitespace-nowrap">
                  Tanggal
                </th>
                <th className="py-3 pr-3 w-[90px] text-center whitespace-nowrap">
                  Jam
                </th>
                <th className="py-3 pr-3 w-[190px] text-center whitespace-nowrap">
                  Keterlambatan
                </th>
                <th className="py-3 pr-3 w-[130px] whitespace-nowrap">NIS</th>
                <th className="py-3 pr-3 w-[200px] whitespace-nowrap">
                  Alasan
                </th>
                <th className="py-3 pr-3 w-[200px] whitespace-nowrap">
                  Catatan
                </th>
              </tr>
            </thead>

            <tbody className="text-slate-900">
              {rowsWithLate.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3 font-medium text-slate-900 truncate">
                    {r.nama}
                  </td>

                  <td className="py-3 pr-3 text-center whitespace-nowrap text-slate-900">
                    {r.kelas}
                  </td>

                  <td className="py-3 pr-3 whitespace-nowrap text-slate-900">
                    {formatTanggalID(r.tanggal)}
                  </td>

                  <td className="py-3 pr-3 text-center whitespace-nowrap text-slate-900">
                    {formatJam(r.jam_datang)}
                  </td>

                  <td className="py-3 pr-3 text-center">
                    <span
                      className={[
                        "whitespace-nowrap",
                        r.late_minutes > 0
                          ? "font-semibold text-red-600"
                          : "text-slate-700",
                      ].join(" ")}
                    >
                      {formatLateDuration(r.late_minutes)}
                    </span>
                  </td>

                  <td className="py-3 pr-3 whitespace-nowrap text-slate-900">
                    {r.nis ?? "-"}
                  </td>

                  <td className="py-3 pr-3 truncate text-slate-900">
                    {r.alasan ?? "-"}
                  </td>

                  <td className="py-3 pr-3 truncate text-slate-900">
                    {r.catatan ?? "-"}
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Belum ada data untuk filter yang dipilih.
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

      {/* ====== DAFTAR SP (>=5x) ====== */}
      <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
        <h3 className="text-sm font-semibold text-slate-900">
          Siswa Terlambat ≥ 5 kali
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Berdasarkan data yang sedang tampil (sesuai filter). Cocok untuk
          kandidat SP.
        </p>

        <div className="mt-3 space-y-2">
          {late5Plus.length === 0 ? (
            <p className="text-sm text-slate-500">
              Belum ada yang mencapai 5 kali.
            </p>
          ) : (
            late5Plus.map((s, idx) => (
              <div
                key={`${s.nis ?? ""}-${s.nama}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {idx + 1}. {s.nama}
                  </p>
                  <p className="text-xs text-slate-600">
                    NIS: {s.nis ?? "-"} • Kelas: {s.kelas}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  {s.count}x
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
