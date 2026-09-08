import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-32 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Sayfa bulunamadı</h1>
      <p className="mt-3 text-ink-500">Aradığınız sayfa taşınmış veya kaldırılmış olabilir.</p>
      <Link href="/" className="mt-6 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
