import type { Locale } from "@/i18n/config";
import { posts, type Post } from "./posts";
import { postsNl } from "./posts.nl";

export type { Post };

export function getPosts(lang: Locale): Post[] {
  return lang === "nl" ? postsNl : posts;
}

export function getPostBySlug(lang: Locale, slug: string): Post | undefined {
  return getPosts(lang).find((p) => p.slug === slug);
}

/** Aynı makalenin diğer dildeki karşılığı (diziler aynı sırada tutulur). */
export function translatedPost(lang: Locale, slug: string): { lang: Locale; post: Post } | undefined {
  const idx = getPosts(lang).findIndex((p) => p.slug === slug);
  if (idx < 0) return undefined;
  const other: Locale = lang === "nl" ? "tr" : "nl";
  const post = getPosts(other)[idx];
  return post ? { lang: other, post } : undefined;
}
