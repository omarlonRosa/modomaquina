import { SITE } from '@/lib/content';
import Contato from '@/components/Contato';

export const metadata = { title: 'Contato', description: 'Fale com o Modo Máquina: sugestão de pauta, correção, parceria ou anúncio.', alternates: { canonical: '/contato' } };

export default function PaginaContato() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">Contato</span>
        <h1>Fala com <span className="o">a gente.</span></h1>
        <p>Sugestão de pauta, correção em alguma matéria, parceria ou anúncio: manda sua mensagem pelo formulário que a gente responde por e-mail.</p>
        {SITE.email && <p>Se preferir, escreve direto pra <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>}
        <p>Também dá pra falar pelo direct do Instagram: <a href={SITE.instagramDM} target="_blank" rel="noopener">@modomaquina.br</a>.</p>
        <Contato />
        <p style={{ marginTop: 28, color: 'var(--muted)', fontSize: 14 }}>O Modo Máquina é feito por Marlon Rosa, em Parauapebas, Pará.</p>
      </div>
    </div>
  );
}
