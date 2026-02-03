"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    /* 1️⃣ LOGIN */
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setMsg("Login gagal. Periksa email dan kata sandi.");
      return;
    }

    /* 2️⃣ AMBIL ROLE */
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    setLoading(false);

    if (profErr || !profile?.role) {
      setMsg("Login berhasil, tetapi role belum diatur.");
      return;
    }

    /* 3️⃣ REDIRECT SESUAI ROLE */
    const role = profile.role;

    if (role === "editor") {
      router.push("/dashboard/input");
    } else {
      router.push("/dashboard/rekap");
    }

    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 to-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <img
              src="/logo-karawang-smk.png"
              alt="Logo SMK Texmaco Karawang"
              className="h-12 w-12 object-contain"
            />
          </div>

          <h1 className="text-2xl font-semibold tracking-wide text-slate-900">
            SMK TEXMACO KARAWANG
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sistem Absensi Keterlambatan Siswa
          </p>
        </div>

        {/* Card Login */}
        <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5">
          <div className="mb-5 text-center">
            <h2 className="text-lg font-semibold text-slate-900">Masuk</h2>
            <p className="mt-1 text-xs text-slate-500">
              Gunakan akun petugas kesiswaan
            </p>
          </div>

          <form onSubmit={onLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-slate-400">
                <Mail className="h-4 w-4 text-slate-500" />
                <input
                  className="h-full w-full bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                  inputMode="email"
                  placeholder="kesiswaan.editor@smktexmaco.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Kata Sandi
              </label>

              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-slate-400">
                <Lock className="h-4 w-4 text-slate-500" />

                <input
                  className="h-full w-full bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-200/60"
                  aria-label={
                    showPassword ? "Sembunyikan sandi" : "Lihat sandi"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {msg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {msg}
              </div>
            )}

            {/* Button */}
            <button
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </button>

            <div className="pt-2 text-center text-[11px] text-slate-500">
              ©️ {new Date().getFullYear()} SMK Texmaco Karawang
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
