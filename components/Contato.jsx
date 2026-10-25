'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const ASSUNTOS = ['Sugestão de pauta', 'Anunciar no Modo Máquina', 'Parceria', 'Correção em matéria', 'Outro'];

export default function Contato() {
  const [estado, setEstado] = useState('livre'); // livre | enviando | ok | erro
  const [msg, setMsg] = useState('');
  const inicio = useRef(0);
  useEffect(() => { inicio.current = Date.now(); }, []);

  async function enviar(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEstado('enviando'); setMsg('');
    try {
      const r = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: f.get('nome'), email: f.get('email'), assunto: f.get('assunto'), mensagem: f.get('mensagem'),
          aceite: f.get('aceite') === 'on', site: f.get('site'), ms: Date.now() - inicio.current,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setEstado('ok'); return; }
      setEstado('erro');
      setMsg(d.erro === 'email' ? 'Confere o e-mail, parece que tem algo errado.' : d.erro === 'mensagem' ? 'Escreve uma mensagem um pouco maior (pelo menos 10 caracteres).' : d.erro === 'aceite' ? 'Marca a caixinha de autorização pra gente poder te responder.' : d.erro === 'limite' ? 'Muitas mensagens seguidas. Tenta de novo daqui a pouco.' : 'Não deu certo agora. Tenta de novo em alguns minutos.');
    } catch { setEstado('erro'); setMsg('Sem conexão. Tenta de novo em alguns minutos.'); }
  }

  if (estado === 'ok') return <p className="news-ok">✅ Mensagem enviada! A gente responde no e-mail que você informou.</p>;

  return (
    <form className="contato" onSubmit={enviar} noValidate>
      <label>Seu nome<input name="nome" type="text" autoComplete="name" required maxLength={80} /></label>
      <label>Seu e-mail<input name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254} /></label>
      <label>Assunto
        <select name="assunto" defaultValue={ASSUNTOS[0]}>{ASSUNTOS.map((a) => <option key={a}>{a}</option>)}</select>
      </label>
      <label>Mensagem<textarea name="mensagem" rows={6} required minLength={10} maxLength={3000} /></label>
      <input className="hp" name="site" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="news-aceite">
        <input type="checkbox" name="aceite" required />
        <span>Autorizo o Modo Máquina a guardar meus dados pra responder esta mensagem. <Link href="/privacidade">Política de privacidade</Link>.</span>
      </label>
      {estado === 'erro' && <p className="news-erro" role="alert">{msg}</p>}
      <button className="btn" type="submit" disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviar mensagem'}</button>
    </form>
  );
}
