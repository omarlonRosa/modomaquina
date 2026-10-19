import { SITE } from '@/lib/content';

export const metadata = { title: 'Sobre', description: 'O que é o Modo Máquina e quem está por trás dele.', alternates: { canonical: '/sobre' } };

export default function Sobre() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">Sobre</span>
        <h1>Mais que carros. <span className="o">É sobre o que nos move.</span></h1>
        <p>O Modo Máquina é uma marca de conteúdo sobre cultura automotiva, tecnologia e a vida real da oficina. Nasceu em Parauapebas, no Pará, pra quem cresceu apaixonado por carro e se afastou — e pra quem nunca saiu.</p>
        <p>Por trás dele está Marlon Rosa: engenheiro de software, ex-designer de campanhas, gestor de um auto center e eterno colecionador de revista de carro. A ideia é aprender em público, pesquisar com cuidado e dividir tudo com a comunidade.</p>
        <h2>Nossos compromissos</h2>
        <ul>
          <li><b>Fonte sempre.</b> Notícias e dados vêm com a origem citada.</li>
          <li><b>Imagem honesta.</b> Fotos de carros e fatos reais são reais. Ilustrações feitas com IA são identificadas.</li>
          <li><b>Publicidade identificada.</b> Conteúdo patrocinado e links de afiliado são sempre sinalizados.</li>
          <li><b>Precisão técnica.</b> Dica de manutenção é geral; cada carro tem suas particularidades — na dúvida, procure um profissional.</li>
        </ul>
        <h2>Fale com a gente</h2>
        <p>Pauta, correção, parceria ou carro antigo com história pra contar: chama no <a className="o" href={SITE.instagramDM} target="_blank" rel="noopener">direct do Instagram</a>.</p>
      </div>
    </div>
  );
}
