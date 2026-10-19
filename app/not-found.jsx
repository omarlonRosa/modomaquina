import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="page">
        <span className="kick o">404</span>
        <h1>Essa peça <span className="o">não tá no estoque.</span></h1>
        <p>A página que você procurou não existe ou mudou de lugar.</p>
        <p><Link className="btn" href="/">Voltar pro início</Link></p>
      </div>
    </div>
  );
}
