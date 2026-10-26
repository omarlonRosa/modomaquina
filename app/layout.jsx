import './globals.css';
import { Header, Footer } from '@/components/ui';
import { SITE } from '@/lib/content';
import Contador from '@/components/Contador';

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, locale: 'pt_BR', type: 'website', images: [{ url: '/og-default.jpg', width: 1200, height: 630 }] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  twitter: { card: 'summary_large_image' },
};

// Google AdSense (conta do Modo Máquina)
const ADSENSE = 'ca-pub-3066794208937036';

const SITE_LD = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE.name, url: SITE.url, logo: `${SITE.url}/logo-512.png`, sameAs: [SITE.instagram, 'https://x.com/modomaquinabr'] },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, inLanguage: 'pt-BR' },
];

export const viewport = { themeColor: '#0E0E10' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="google-adsense-account" content={ADSENSE} />
        <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} crossOrigin="anonymous" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
        <Header />
        <main>{children}</main>
        <Footer />
        <Contador />
      </body>
    </html>
  );
}
