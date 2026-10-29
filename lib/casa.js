// Anúncios da casa: os outros projetos do Marlon nos espaços de publicidade enquanto o AdSense não preenche.
// Só fatos que vieram dele ou dos sites de cada projeto; nada de inventar serviço, preço ou endereço.
const UTM = 'utm_source=modomaquina&utm_medium=site&utm_campaign=casa';

export const CASA = {
  lockup: {
    marca: 'Lock-up Auto Center',
    titulo: 'Especialista em transmissão automática',
    texto: 'Certificada pela APTTA Brasil. Diagnóstico eletrônico, manutenção, reparos especializados e troca de óleo ATF, em Parauapebas (PA).',
    cta: 'Chamar no WhatsApp',
    href: `https://wa.me/559484035552?text=${encodeURIComponent('Olá! Vim pelo Modo Máquina e quero falar com a Lock-up.')}`,
    img: '/media/casa/lockup.jpg',
    alt: 'Logo da Lock-up Auto Center, especialista em transmissão automática',
    cor: '#E1251B',
  },
  ofiapp: {
    marca: 'OfiApp',
    titulo: 'Sistema para oficina mecânica',
    texto: 'Ordem de serviço, orçamento aprovado pelo WhatsApp, Pix sem taxa, estoque e nota fiscal. Feito dentro de uma oficina, em Parauapebas.',
    cta: 'Conhecer o OfiApp',
    href: `https://ofiapp.com.br/?${UTM}`,
    img: '/media/casa/ofiapp.jpg',
    alt: 'Tela inicial do OfiApp com as ordens de serviço da oficina',
    cor: '#F07A2A',
  },
  bobinho: {
    marca: 'Bobinho',
    titulo: 'Futebol com resenha e informação checada',
    texto: 'Brasileirão, divisões de acesso, Europa e a base. Da roda de bobo ao profissional.',
    cta: 'Conhecer o Bobinho',
    href: `https://bobinho.com.br/?${UTM}`,
    img: '/media/casa/bobinho.jpg',
    alt: 'Logo do Bobinho, site de futebol',
    cor: '#E8253A',
  },
};

const ESPORTE = /\b(f1|fórmula 1|grande prêmio|gp d|piloto|stock car|futebol)\b/i;

// Ordem dos anúncios num artigo: o primeiro é o que mais combina com o assunto.
export function casaDoPost(post) {
  if (post.casa) return post.casa;
  const texto = [post.title, post.subtitle, ...post.body.map((b) => b.text || '')].join(' ');
  if (ESPORTE.test(texto)) return ['bobinho', 'lockup', 'ofiapp'];
  if (post.editoria === 'oficina-em-evolucao') return ['ofiapp', 'lockup', 'bobinho'];
  return ['lockup', 'ofiapp', 'bobinho'];
}

export const casaDaEditoria = (slug) =>
  slug === 'oficina-em-evolucao' ? 'ofiapp' : slug === 'cultura-de-garagem' ? 'bobinho' : 'lockup';
