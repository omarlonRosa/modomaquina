import Link from 'next/link';
import { CATEGORIAS, produtosAtivos } from '@/lib/vitrine';

const ativos = produtosAtivos();

export const metadata = {
  title: 'Vitrine: o que a gente recomenda pro seu carro',
  description: 'Ferramentas, scanners e itens de segurança que fazem sentido pra quem cuida do próprio carro. Links de afiliado identificados.',
  alternates: { canonical: '/vitrine' },
  // Sem produto com link, a página não aparece no Google.
  robots: ativos.length ? undefined : { index: false, follow: true },
};

export default function Vitrine() {
  return (
    <div className="wrap">
      <div className="page" style={{ maxWidth: 1100 }}>
        <span className="kick o">Vitrine</span>
        <h1>O que a gente <span className="o">recomenda.</span></h1>
        <p>Ferramentas e itens que fazem diferença pra quem cuida do próprio carro, escolhidos por quem vive dentro de oficina. Sem preço aqui porque ele muda todo dia: você confere direto na loja.</p>
        <p className="aviso-afiliado">Os links desta página são <b>links de afiliado</b>: se você comprar por eles, o Modo Máquina ganha uma pequena comissão, sem custo extra pra você. É assim que a gente mantém o site no ar.</p>
        {ativos.length === 0 ? (
          <p>A vitrine está sendo montada. Volta daqui a pouco! Enquanto isso, <Link href="/">veja as últimas matérias</Link>.</p>
        ) : (
          CATEGORIAS.map((c) => {
            const itens = ativos.filter((p) => p.categoria === c.slug);
            if (!itens.length) return null;
            return (
              <section key={c.slug}>
                <h2>{c.nome}</h2>
                <div className="vitrine">
                  {itens.map((p) => (
                    <div className="item" key={p.id}>
                      <b>{p.nome}</b>
                      <p>{p.porque}</p>
                      <span className="loja">{p.loja} · link de afiliado</span>
                      <a className="btn" href={p.url} target="_blank" rel="sponsored noopener">Ver na loja</a>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
