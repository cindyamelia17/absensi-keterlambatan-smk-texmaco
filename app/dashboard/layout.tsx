"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  UserCog,
} from "lucide-react";

type Role = "editor" | "viewer" | null;

function cx(...s: (string | false | null | undefined)[]) {
  return s.filter(Boolean).join(" ");
}

/**
 * Active rule (fixed):
 * - "/dashboard" aktif hanya jika pathname === "/dashboard"
 * - default: aktif jika pathname === href atau startsWith(href + "/")
 * - EXCEPTION:
 *   "/dashboard/siswa" JANGAN aktif ketika berada di child route
 *   yang punya menu sendiri, mis "/dashboard/siswa/status"
 */
function isActivePath(pathname: string, href: string) {
  // exact match always active
  if (pathname === href) return true;

  // dashboard only exact
  if (href === "/dashboard") return pathname === "/dashboard";

  // ✅ FIX: parent siswa jangan ikut aktif kalau sedang di "/dashboard/siswa/status"
  if (
    href === "/dashboard/siswa" &&
    pathname.startsWith("/dashboard/siswa/")
  ) {
    return false;
  }

  // default rule
  return pathname.startsWith(href + "/");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);

  const nav = useMemo(() => {
    const items = [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        show: true,
      },
      {
        label: "Input Keterlambatan",
        href: "/dashboard/input",
        icon: UserCog,
        show: role === "editor",
      },
      {
        label: "Rekap",
        href: "/dashboard/rekap",
        icon: ClipboardList,
        show: true,
      },

      // ✅ MENU SISWA
      {
        label: "Data Siswa",
        href: "/dashboard/siswa",
        icon: ClipboardList,
        show: role === "editor",
      },
      {
        label: "Status (Kenaikan/Lulus)",
        href: "/dashboard/siswa/status",
        icon: ClipboardList,
        show: role === "editor",
      },
    ];
    return items.filter((x) => x.show);
  }, [role]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.replace("/login");
        return;
      }
      setEmail(auth.user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      setRole((profile?.role as Role) ?? "viewer");
    })();
  }, [router, supabase]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-black/5">
          <img
            src="/logo-karawang-smk.png"
            alt="Logo SMK Texmaco Karawang"
            className="h-8 w-8 object-contain"
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            SMK Texmaco Karawang
          </p>
          <p className="text-xs text-slate-600">Absensi Keterlambatan</p>
        </div>
      </div>

      <div className="px-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p className="font-medium text-slate-900">Akun</p>
          <p className="mt-1 break-all">{email || "-"}</p>
          <p className="mt-1">
            Role:{" "}
            <span className="font-semibold text-slate-900">{role ?? "-"}</span>
          </p>
        </div>
      </div>

      <nav className="mt-4 flex-1 px-3">
        {nav.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cx(
                "mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          ©️ {new Date().getFullYear()} SMK Texmaco Karawang
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 to-slate-100">
      {/* Mobile Topbar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-black/5">
              <img
                src="/logo-karawang-smk.png"
                alt="Logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Absensi Terlambat
              </p>
              <p className="text-xs text-slate-600">SMK Texmaco Karawang</p>
            </div>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-sm bg-slate-50 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-slate-200 bg-slate-50 md:block">
          {Sidebar}
        </aside>

        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}