import Link from 'next/link';

const CONVITE = 'https://chat.whatsapp.com/F3H6WYviv2kHl8ySpMCv6z';

export const metadata = {
  title: 'Achados Modo Máquina: ofertas de carro no WhatsApp',
  description: 'Entre na comunidade Achados Modo Máquina no WhatsApp e receba ofertas de acessórios, ferramentas e itens pro carro. Links de afiliado identificados.',
  alternates: { canonical: '/achados' },
};

export default function Achados() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">Achados</span>
        <h1>Ofertas de carro <span className="o">no seu WhatsApp.</span></h1>
        <p>A gente garimpa promoções de acessórios, ferramentas, limpeza, som e itens de carro elétrico e manda na comunidade <b>Achados Modo Máquina</b>. Só os administradores postam, então não vira bagunça, e o seu número fica escondido dos outros membros.</p>
        <p><a className="btn" href={CONVITE} target="_blank" rel="noopener">Entrar na comunidade do WhatsApp</a></p>
        <p className="aviso-afiliado">Os links publicados lá são <b>links de afiliado</b>: se você comprar por eles, o Modo Máquina ganha uma pequena comissão, sem custo extra pra você. Preço e estoque mudam a qualquer momento; confira na loja antes de comprar.</p>
        <p>Prefere ver com calma? Dá uma olhada na <Link href="/vitrine">vitrine</Link> com o que a gente recomenda.</p>
      </div>
    </div>
  );
}
