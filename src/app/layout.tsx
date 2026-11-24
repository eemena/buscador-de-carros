import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carros CR | Buscador y Comparador de Agencias en Costa Rica",
  description:
    "Busca, filtra y compara vehículos usados de las principales agencias de Costa Rica (Carsot, Seminuevos CR, Purdy Usados, AutoStar, Veinsa y Honda) con cálculo de recibo por agencia."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-[#0b1120] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
