"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Role = "editor" | "viewer" | null;

export default function DashboardPage() {
  const supabase = supabaseBrowser();
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      setRole((profile?.role as Role) ?? "viewer");
    })();
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pilih menu untuk input keterlambatan atau melihat rekap.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {role === "editor" ? (
          <Link
            href="/dashboard/input"
            className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5 hover:ring-black/10"
          >
            <p className="text-sm font-semibold text-slate-900">
              Input Keterlambatan
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Dipakai petugas pos (HP) untuk input cepat.
            </p>
          </Link>
        ) : (
          <div className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5 opacity-60">
            <p className="text-sm font-semibold text-slate-900">
              Input Keterlambatan
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Hanya tersedia untuk akun editor.
            </p>
          </div>
        )}

        <Link
          href="/dashboard/rekap"
          className="rounded-2xl bg-white p-6 shadow ring-1 ring-black/5 hover:ring-black/10"
        >
          <p className="text-sm font-semibold text-slate-900">Rekap</p>
          <p className="mt-1 text-xs text-slate-600">
            Filter per tanggal, rekap bulanan, export.
          </p>
        </Link>
      </div>
    </div>
  );
}
