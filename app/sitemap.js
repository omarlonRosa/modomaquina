export const dynamic = 'force-static';
import { EDITORIAS, POSTS, SITE, sortedPosts } from '@/lib/content';

export default function sitemap() {
  const base = SITE.url;
  return [
    { url: base, lastModified: sortedPosts()[0]?.date, changeFrequency: 'daily', priority: 1 },
    ...POSTS.map((p) => ({ url: `${base}/artigos/${p.slug}`, lastModified: p.updated || p.date, priority: 0.8 })),
    ...EDITORIAS.map((e) => ({ url: `${base}/editoria/${e.slug}`, priority: 0.6 })),
    { url: `${base}/sobre`, priority: 0.4 },
    { url: `${base}/anuncie`, priority: 0.4 },
    { url: `${base}/privacidade`, priority: 0.2 },
  ];
}
