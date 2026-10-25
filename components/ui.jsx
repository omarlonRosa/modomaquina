import Link from 'next/link';
import { EDITORIAS, SITE, editoria, fmtDate } from '@/lib/content';

export function Header() {
  return (
    <header className="hdr">
      <div className="wrap">
        <Link href="/" aria-label="Modo Máquina — início"><LogoInline /></Link>
        <nav className="nav">
          {EDITORIAS.slice(0, 4).map((e) => (
            <Link key={e.slug} href={`/editoria/${e.slug}`}>{e.name}</Link>
          ))}
        </nav>
        <a className="btn" href={SITE.instagram} target="_blank" rel="noopener">Seguir</a>
      </div>
    </header>
  );
}

export function LogoInline({ className = 'logo' }) {
  return (
    <span className={className} style={{ display: 'block' }}>
      <img src="/logo-white.svg" alt="Modo Máquina" width={543} height={117} style={{ width: '100%', height: 'auto' }} />
    </span>
  );
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="cols">
          <div>
            <LogoInline />
            <p>{SITE.description}</p>
          </div>
          <div>
            <h5>Editorias</h5>
            <ul>{EDITORIAS.map((e) => <li key={e.slug}><Link href={`/editoria/${e.slug}`}>{e.name}</Link></li>)}</ul>
          </div>
          <div>
            <h5>Modo Máquina</h5>
            <ul>
              <li><Link href="/sobre">Sobre</Link></li>
              <li><Link href="/anuncie">Anuncie</Link></li>
              <li><Link href="/contato">Contato</Link></li>
              <li><Link href="/privacidade">Privacidade</Link></li>
              <li><a href={SITE.instagram} target="_blank" rel="noopener">Instagram</a></li>
            </ul>
          </div>
        </div>
        <div className="bottom">
          <span>© {new Date().getFullYear()} Modo Máquina · Parauapebas, Pará</span>
          <span>{SITE.tagline}</span>
        </div>
      </div>
    </footer>
  );
}

export function AdSlot({ size = 'leader' }) {
  return (
    <div className={`ad ${size}`} role="complementary" aria-label="Espaço publicitário">
      <small>PUBLICIDADE</small>
      <Link href="/anuncie">Sua marca aqui → Anuncie no Modo Máquina</Link>
    </div>
  );
}

const BANDS = {
  '#FF5A1F': ['#FF5A1F', '#FAFAFA', '#2DA6FF'],
  '#2DA6FF': ['#2DA6FF', '#FAFAFA', '#FF5A1F'],
  '#FAFAFA': ['#FAFAFA', '#FF5A1F', '#2DA6FF'],
};

export function Cover({ post, big = false, label }) {
  const ed = editoria(post.editoria);
  if (post.cover) {
    return (
      <div className="cover photo" style={big ? { aspectRatio: '4/3' } : undefined}>
        <img src={post.cover.src} alt={post.cover.alt} loading={big ? 'eager' : 'lazy'} />
        {post.cover.ai && <span className="ai">IMAGEM GERADA POR IA</span>}
        <span className="lbl">{label || ed.name}</span>
      </div>
    );
  }
  const [c1, c2, c3] = BANDS[ed.color] || BANDS['#FF5A1F'];
  return (
    <div className="cover" style={big ? { aspectRatio: '4/3' } : undefined}>
      <i className="band" style={{ left: '38%', background: c1, opacity: 0.95 }} />
      <i className="band" style={{ left: '64%', width: '14%', background: c2, opacity: 0.9 }} />
      <i className="band" style={{ left: '84%', width: '10%', background: c3, opacity: 0.95 }} />
      <span className="num">MODO MÁQUINA</span>
      <span className="lbl">{label || ed.name}</span>
    </div>
  );
}

export function PostCard({ post }) {
  const ed = editoria(post.editoria);
  return (
    <Link href={`/artigos/${post.slug}`} className="card">
      <Cover post={post} label={post.coverLabel} />
      <div className="ed" style={{ color: ed.color }}>{ed.name}</div>
      <h3>{post.title}</h3>
      <p>{post.subtitle}</p>
    </Link>
  );
}

export function Meta({ post }) {
  return <>Por {post.author} · {fmtDate(post.date)} · {post.readTime} min de leitura</>;
}
