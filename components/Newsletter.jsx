'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function Newsletter({ origem = 'site', compacto = false }) {
  const [estado, setEstado] = useState('livre'); // livre | enviando | ok | erro
  const [msg, setMsg] = useState('');
  const inicio = useRef(0);
  useEffect(() => { inicio.current = Date.now(); }, []);

  async function enviar(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEstado('enviando'); setMsg('');
    try {
      const r = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), aceite: f.get('aceite') === 'on', site: f.get('site'), origem, ms: Date.now() - inicio.current }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setEstado('ok'); return; }
      setEstado('erro');
      setMsg(d.erro === 'email' ? 'Confere o e-mail, parece que tem algo errado.' : d.erro === 'aceite' ? 'Marca a caixinha de autorização pra gente poder te enviar.' : d.erro === 'limite' ? 'Muitas tentativas. Tenta de novo daqui a pouco.' : 'Não deu certo agora. Tenta de novo em alguns minutos.');
    } catch { setEstado('erro'); setMsg('Sem conexão. Tenta de novo em alguns minutos.'); }
  }

  return (
    <div className={`news${compacto ? ' compacto' : ''}`}>
      <div className="news-txt">
        <span className="kick o">Newsletter</span>
        <h3>O melhor da semana <span className="o">no seu e-mail.</span></h3>
        <p>Todo domingo: as notícias que importam pro Brasil, um caso real da oficina e uma dica de manutenção. Leitura de 5 minutos, sem spam.</p>
      </div>
      {estado === 'ok' ? (
        <p className="news-ok">✅ Pronto! Você está na lista. A primeira edição chega no domingo.</p>
      ) : (
        <form className="news-form" onSubmit={enviar} noValidate>
          <div className="news-row">
            <label className="sr" htmlFor={`nl-${origem}`}>Seu e-mail</label>
            <input id={`nl-${origem}`} name="email" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" required maxLength={254} />
            <button className="btn" type="submit" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Quero receber'}</button>
          </div>
          <input className="hp" name="site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label className="news-aceite">
            <input type="checkbox" name="aceite" required />
            <span>Autorizo o Modo Máquina a me enviar a newsletter por e-mail. Posso sair quando quiser. <Link href="/privacidade">Política de privacidade</Link>.</span>
          </label>
          {estado === 'erro' && <p className="news-erro" role="alert">{msg}</p>}
        </form>
      )}
    </div>
  );
}
