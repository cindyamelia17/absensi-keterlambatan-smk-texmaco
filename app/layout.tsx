import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Absensi Keterlambatan | SMK Texmaco Karawang",
  description:
    "Sistem absensi keterlambatan siswa SMK Texmaco Karawang berbasis web.",

  openGraph: {
    title: "Absensi Keterlambatan SMK Texmaco Karawang",
    description:
      "Website resmi absensi keterlambatan siswa SMK Texmaco Karawang.",
    url: "https://absensi-keterlambatan-smk-texmaco.vercel.app/",
    siteName: "Absensi SMK Texmaco",
    images: [
      {
        url: "/logo-karawang-smk.png",
        width: 1200,
        height: 630,
        alt: "Logo SMK Texmaco Karawang",
      },
    ],
    locale: "id_ID",
    type: "website",
  },

  icons: {
    icon: "/logo-karawang-smk.png", // favicon tab browser
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
