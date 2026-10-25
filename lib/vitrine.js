// Vitrine de afiliados: produtos que fazem sentido pro público do Modo Máquina.
// Só aparece no site o item que tiver `url` (link de afiliado gerado no painel da loja).
// Nunca colocar preço aqui (muda todo dia); o leitor vê o preço na loja.
// Lojas: 'Amazon' | 'Mercado Livre' | 'Shopee'.

export const CATEGORIAS = [
  { slug: 'diagnostico', nome: 'Diagnóstico' },
  { slug: 'ferramentas', nome: 'Ferramentas' },
  { slug: 'seguranca', nome: 'Segurança e emergência' },
  { slug: 'limpeza', nome: 'Limpeza e cuidados' },
];

export const PRODUTOS = [
  { id: 'scanner-obd2-bluetooth', categoria: 'diagnostico', nome: 'Scanner OBD2 Bluetooth (ELM327)', porque: 'Liga no conector OBD2 e mostra no celular o código da luz de injeção. O jeito mais barato de saber o que o carro tem antes de ir pra oficina.', loja: '', url: '' },
  { id: 'scanner-obd2-tela', categoria: 'diagnostico', nome: 'Scanner automotivo com tela', porque: 'Lê e apaga códigos sem precisar de celular, e mostra dados em tempo real. Bom pra quem mexe no próprio carro.', loja: '', url: '' },
  { id: 'multimetro-automotivo', categoria: 'diagnostico', nome: 'Multímetro digital', porque: 'Mede bateria, alternador, fusível e chicote. A ferramenta número 1 de diagnóstico elétrico.', loja: '', url: '' },
  { id: 'caneta-teste-12v', categoria: 'diagnostico', nome: 'Caneta de teste de polaridade 12V', porque: 'Acha fio com corrente e mau contato em segundos. Barata e salva muito tempo.', loja: '', url: '' },
  { id: 'jogo-soquetes', categoria: 'ferramentas', nome: 'Jogo de soquetes com catraca', porque: 'A base de qualquer caixa de ferramentas: troca de bateria, pastilha, vela e muito mais.', loja: '', url: '' },
  { id: 'torquimetro', categoria: 'ferramentas', nome: 'Torquímetro de estalo', porque: 'Aperta parafuso de roda, cabeçote e vela no torque certo. Evita rosca espanada e roda solta.', loja: '', url: '' },
  { id: 'macaco-jacare', categoria: 'ferramentas', nome: 'Macaco jacaré', porque: 'Bem mais estável e rápido que o macaco que vem no carro. Use sempre com cavalete.', loja: '', url: '' },
  { id: 'cavaletes', categoria: 'ferramentas', nome: 'Par de cavaletes', porque: 'Nunca fique embaixo de um carro apoiado só no macaco. Cavalete é item de segurança.', loja: '', url: '' },
  { id: 'chave-filtro-oleo', categoria: 'ferramentas', nome: 'Chave de filtro de óleo (cinta)', porque: 'Solta filtro preso sem amassar. Pra quem faz a própria troca de óleo.', loja: '', url: '' },
  { id: 'auxiliar-partida', categoria: 'seguranca', nome: 'Auxiliar de partida portátil (jump starter)', porque: 'Dá partida com bateria arriada sem precisar de outro carro. Muitos também carregam o celular.', loja: '', url: '' },
  { id: 'compressor-12v', categoria: 'seguranca', nome: 'Compressor de ar 12V', porque: 'Calibra pneu em qualquer lugar, ligado na tomada do carro.', loja: '', url: '' },
  { id: 'calibrador-digital', categoria: 'seguranca', nome: 'Calibrador digital de pneus', porque: 'Mais preciso que o do posto. Pneu calibrado economiza combustível e dura mais.', loja: '', url: '' },
  { id: 'camera-veicular', categoria: 'seguranca', nome: 'Câmera veicular (dashcam)', porque: 'Grava o trânsito o tempo todo. Ajuda muito em caso de batida ou golpe.', loja: '', url: '' },
  { id: 'kit-lavagem', categoria: 'limpeza', nome: 'Shampoo automotivo + luva de microfibra', porque: 'Lava sem tirar a cera e sem riscar. Detergente de cozinha resseca a pintura.', loja: '', url: '' },
  { id: 'aspirador-12v', categoria: 'limpeza', nome: 'Aspirador portátil 12V', porque: 'Limpa banco e tapete sem sair do carro, ligado na tomada 12V.', loja: '', url: '' },
];

export const produtosAtivos = () => PRODUTOS.filter((p) => p.url);
