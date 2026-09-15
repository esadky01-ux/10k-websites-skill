import { getDictionary } from "@/i18n/getDictionary";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-extrabold">{dict.hero.title}</h1>
      <Button className="mt-4">{dict.common.bookNow}</Button>
    </main>
  );
}
