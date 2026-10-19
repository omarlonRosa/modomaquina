export const dynamic = 'force-static';
import { SITE } from '@/lib/content';

export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/' }], sitemap: `${SITE.url}/sitemap.xml` };
}
