'use client';
// Contador de visitas sem cookie: manda só a página e, na primeira página da aba, de onde a pessoa veio.
// Os números ficam em /api/metricas (worker/metricas.js).
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Contador() {
  const caminho = usePathname();
  useEffect(() => {
    try {
      if (!/modomaquina/.test(location.hostname)) return;
      const entrada = !sessionStorage.getItem('mm_v');
      sessionStorage.setItem('mm_v', '1');
      navigator.sendBeacon('/api/v', JSON.stringify({ p: caminho, r: entrada ? document.referrer : '', e: entrada ? 1 : 0 }));
    } catch {}
  }, [caminho]);
  return null;
}
