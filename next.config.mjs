/** @type {import('next').NextConfig} */

// O site é 100% estático: o build gera a pasta `out/`, publicada no Cloudflare Pages.
// Os cabeçalhos de segurança (CSP etc.) ficam em `public/_headers`, que o Cloudflare aplica.
const nextConfig = {
  output: 'export',
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default nextConfig;
