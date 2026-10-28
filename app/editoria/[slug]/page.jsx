import { notFound } from 'next/navigation';
import { casaDaEditoria } from '@/lib/casa';
import { AdSlot, PostCard } from '@/components/ui';
import { EDITORIAS, editoria, sortedPosts } from '@/lib/content';

export function generateStaticParams() {
  return EDITORIAS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const ed = editoria(slug);
  return ed ? { title: ed.name, description: ed.desc, alternates: { canonical: `/editoria/${ed.slug}` } } : {};
}

export default async function Editoria({ params }) {
  const { slug } = await params;
  const ed = editoria(slug);
  if (!ed) notFound();
  const posts = sortedPosts().filter((p) => p.editoria === slug);
  return (
    <div className="wrap">
      <AdSlot size="leader" promo={casaDaEditoria(slug)} />
      <section className="sec">
        <span className="kick" style={{ color: ed.color }}>Editoria</span>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(34px,5vw,60px)', textTransform: 'uppercase', lineHeight: 1, margin: '18px 0 10px' }}>{ed.name}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 19, marginBottom: 30 }}>{ed.desc}</p>
        {posts.length ? (
          <div className="grid">{posts.map((p) => <PostCard key={p.slug} post={p} />)}</div>
        ) : (
          <p style={{ color: 'var(--dim)' }}>Os primeiros conteúdos desta editoria estão a caminho. Acompanha no Instagram.</p>
        )}
      </section>
    </div>
  );
}
