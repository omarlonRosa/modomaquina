import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdSlot, Meta, PostCard } from '@/components/ui';
import { POSTS, SITE, editoria, getPost, sortedPosts } from '@/lib/content';

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.subtitle,
    alternates: { canonical: `/artigos/${post.slug}` },
    openGraph: {
      type: 'article', url: `/artigos/${post.slug}`, title: post.title, description: post.subtitle,
      publishedTime: post.date, modifiedTime: post.updated || post.date, authors: [post.author], section: editoria(post.editoria)?.name,
      images: post.cover ? [{ url: post.cover.src, alt: post.cover.alt }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.subtitle, images: post.cover ? [post.cover.src] : undefined },
  };
}

function Block({ b }) {
  switch (b.type) {
    case 'h2': return <h2>{b.text}</h2>;
    case 'quote': return <blockquote>{b.text}</blockquote>;
    case 'list': return <ul>{b.items.map((i) => <li key={i}>{i}</li>)}</ul>;
    case 'img': return (
      <figure className="fig">
        <div className="frame"><img src={b.src} alt={b.alt} loading="lazy" />{b.ai && <span className="ai">IMAGEM GERADA POR IA</span>}</div>
        <figcaption>{b.caption}{b.credit ? ` ${b.credit}.` : ''}</figcaption>
      </figure>
    );
    case 'link': return <p className="more-link"><Link href={b.href}>{b.text}</Link></p>;
    case 'callout': return <div className="callout"><div className="big">{b.big}</div><p>{b.text}</p></div>;
    default: return <p>{b.text}</p>;
  }
}

export default async function Article({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const ed = editoria(post.editoria);
  const mid = Math.floor(post.body.length / 2);
  const more = sortedPosts().filter((p) => p.slug !== post.slug).slice(0, 2);
  const url = `${SITE.url}/artigos/${post.slug}`;
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'NewsArticle', headline: post.title, description: post.subtitle,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }, url,
      datePublished: `${post.date}T08:00:00-03:00`, dateModified: `${post.updated || post.date}T08:00:00-03:00`,
      image: post.cover ? [SITE.url + post.cover.src] : undefined,
      articleSection: ed.name, inLanguage: 'pt-BR',
      author: { '@type': 'Person', name: post.author, url: `${SITE.url}/sobre` },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: { '@type': 'ImageObject', url: `${SITE.url}/logo-512.png`, width: 512, height: 512 } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: ed.name, item: `${SITE.url}/editoria/${ed.slug}` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  return (
    <div className="wrap">
      <AdSlot size="leader" />
      <article className="art">
        <div>
          <Link href={`/editoria/${ed.slug}`} className="kick" style={{ color: ed.color }}>{ed.name}</Link>
          <h1>{post.title}</h1>
          <p className="sub">{post.subtitle}</p>
          <div className="meta"><Meta post={post} /></div>
          {post.cover && (
            <figure className="fig hero-img">
              <div className="frame"><img src={post.cover.src} alt={post.cover.alt} />{post.cover.ai && <span className="ai">IMAGEM GERADA POR IA</span>}</div>
              {post.cover.credit && <figcaption>{post.cover.credit}.</figcaption>}
            </figure>
          )}
          <div className="prose">
            {post.body.slice(0, mid).map((b, i) => <Block key={i} b={b} />)}
            <AdSlot size="rect" />
            {post.body.slice(mid).map((b, i) => <Block key={i + mid} b={b} />)}
          </div>
          {post.sources.length > 0 && (
            <div className="sources">
              <h4>Fontes</h4>
              <ul>{post.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener nofollow">{s.label}</a></li>)}</ul>
            </div>
          )}
          <div className="share">
            <a className="btn" href={SITE.instagram} target="_blank" rel="noopener">Comentar no Instagram</a>
            <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(post.title + ' — ' + SITE.url + '/artigos/' + post.slug)}`} target="_blank" rel="noopener">Mandar no WhatsApp</a>
          </div>
        </div>
        <aside>
          <div style={{ position: 'sticky', top: 90 }}>
            <AdSlot size="rect" />
          </div>
        </aside>
      </article>
      {more.length > 0 && (
        <section className="sec">
          <h2 className="t">Leia também</h2>
          <div className="grid">{more.map((p) => <PostCard key={p.slug} post={p} />)}</div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
