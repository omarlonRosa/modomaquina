import { SITE } from '@/lib/content';

export const metadata = { title: 'Política de Privacidade', description: 'Como o Modo Máquina trata dados de visitantes.', alternates: { canonical: '/privacidade' } };

export default function Privacidade() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">Privacidade</span>
        <h1>Política de privacidade</h1>
        <p><i>Última atualização: outubro de 2026.</i></p>
        <p>Esta política explica como o Modo Máquina trata informações de quem visita este site, em linha com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
        <h2>Que dados coletamos</h2>
        <p>Hoje o site não possui cadastro nem formulários. Podemos coletar dados técnicos e anônimos de navegação (como páginas visitadas, tipo de dispositivo e origem do acesso) por meio de ferramentas de medição de audiência, para entender quais conteúdos interessam mais.</p>
        <h2>Cookies e publicidade</h2>
        <p>Este site pode exibir anúncios. Parceiros de publicidade, como o Google, podem usar cookies para exibir anúncios com base em visitas anteriores a este e a outros sites. Você pode desativar a publicidade personalizada nas <a className="o" href="https://adssettings.google.com" target="_blank" rel="noopener">configurações de anúncios do Google</a> e gerenciar cookies no seu navegador. Saiba como o Google usa esses dados em <a className="o" href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener">policies.google.com/technologies/ads</a>.</p>
        <h2>Newsletter</h2>
        <p>Se você se inscrever na newsletter, guardamos seu e-mail, a data e a página em que você se inscreveu e um código anônimo derivado do seu endereço de IP (usado só para bloquear cadastros em massa por robôs). Esses dados ficam num banco de dados do Modo Máquina, hospedado na Cloudflare, e são usados apenas para enviar a newsletter que você pediu. Não vendemos nem compartilhamos sua lista com terceiros. Para o envio dos e-mails, poderemos usar um serviço especializado de entrega, que só processa os dados para fazer essa entrega.</p>
        <p>Todo e-mail terá um link para sair da lista, e você pode pedir a exclusão completa dos seus dados quando quiser.</p>
        <h2>Comunidade</h2>
        <p>Quando lançarmos a comunidade no WhatsApp, só vamos usar seu telefone com seu consentimento. Você poderá sair a qualquer momento.</p>
        <h2>Seus direitos</h2>
        <p>Você pode pedir acesso, correção ou exclusão de dados pessoais que tenhamos sobre você. Fale com a gente pelo <a className="o" href={SITE.instagramDM} target="_blank" rel="noopener">direct do Instagram</a>.</p>
      </div>
    </div>
  );
}
