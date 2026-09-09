import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-32 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Pagina niet gevonden · Sayfa bulunamadı</h1>
      <p className="mt-3 text-ink-500">De pagina die u zoekt bestaat niet meer. · Aradığınız sayfa taşınmış olabilir.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">Home</Link>
        <Link href="/tr" className="rounded-full border border-cream-200 px-6 py-3 text-sm font-semibold text-ink-800 hover:border-ink-300">Ana Sayfa</Link>
      </div>
    </div>
  );
}
