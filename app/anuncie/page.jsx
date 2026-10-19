import { SITE } from '@/lib/content';

export const metadata = { title: 'Anuncie', description: 'Coloque sua marca na frente de quem ama carro em Parauapebas e região.', alternates: { canonical: '/anuncie' } };

export default function Anuncie() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">Anuncie</span>
        <h1>Sua marca na frente de <span className="o">quem ama carro.</span></h1>
        <p>Autopeças, oficinas, estética automotiva, som, pneus, concessionárias, seguros e eventos: o Modo Máquina fala direto com entusiastas e profissionais do setor em Parauapebas, Marabá e região.</p>
        <h2>Formatos</h2>
        <div className="fmt">
          <div><b>Banner topo</b><span>970×90 no desktop, 320×100 no celular. Em todas as páginas.</span></div>
          <div><b>Retângulo</b><span>300×250 no meio e na lateral dos artigos.</span></div>
          <div><b>Conteúdo patrocinado</b><span>Matéria ou carrossel sobre sua marca, sempre identificado como publicidade.</span></div>
        </div>
        <h2>Pacotes com Instagram</h2>
        <p>Combine site + carrossel ou Reels no @modomaquina.br. Montamos a proposta de acordo com o seu objetivo.</p>
        <p><a className="btn" href={SITE.instagramDM} target="_blank" rel="noopener">Pedir proposta pelo direct</a></p>
      </div>
    </div>
  );
}
