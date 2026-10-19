import Link from 'next/link';
import { AdSlot, Cover, Meta, PostCard } from '@/components/ui';
import Newsletter from '@/components/Newsletter';
import { EDITORIAS, SITE, editoria, sortedPosts } from '@/lib/content';

export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  const [lead, ...rest] = sortedPosts();
  const ed = editoria(lead.editoria);
  return (
    <div className="wrap">
      <AdSlot size="leader" />

      <section className="hero">
        <Link href={`/artigos/${lead.slug}`}>
          <span className="kick" style={{ color: ed.color }}>{ed.name}</span>
          <h1>{lead.title}</h1>
          <p>{lead.subtitle}</p>
          <div className="meta"><Meta post={lead} /></div>
        </Link>
        <Link href={`/artigos/${lead.slug}`}><Cover post={lead} big label={lead.coverLabel} /></Link>
      </section>

      <section className="sec">
        <h2 className="t">Últimas</h2>
        <div className="grid">
          {rest.map((p) => <PostCard key={p.slug} post={p} />)}
          <div className="ad rect" style={{ margin: 0, width: '100%', minHeight: 250 }}>
            <small>PUBLICIDADE</small>
            <Link href="/anuncie">Sua marca aqui → Anuncie</Link>
          </div>
        </div>
      </section>

      <Newsletter origem="home" />

      <section className="sec">
        <h2 className="t">Editorias</h2>
        <div className="eds">
          {EDITORIAS.map((e) => (
            <Link key={e.slug} href={`/editoria/${e.slug}`} className="ed-tile">
              <i style={{ background: e.color }} />
              <b>{e.name}</b>
              <span>{e.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="cta">
          <div>
            <h3>Ative o <span className="o">modo máquina.</span></h3>
            <p>Conteúdo novo toda semana no Instagram. Comunidade no WhatsApp chegando em breve.</p>
          </div>
          <a className="btn" href={SITE.instagram} target="_blank" rel="noopener">Seguir @modomaquina.br</a>
        </div>
      </section>
    </div>
  );
}
